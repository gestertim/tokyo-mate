import type { ProtectedEndpoint } from './cost-price-table';
import { errorResponse } from './error-envelope';
import type { QuotaEngine } from './quota-engine';
import type { RateLimiter, SessionVerifier, TrustedIngressContext } from './protected-endpoint-pipeline';
import { withStoreTimeout } from './shared-store';
import { INPUT_POLICY } from './local-protection-policy';
import { readBoundedBytes, readBoundedJson, RequestBoundaryError } from './bounded-request';
import { validateImageEnvelope, validatePaidJson, validatePcmMultipart } from './paid-input-validation';
import { isRecord } from './http';
import type { RequestEpochVerifier } from './request-epoch-execution';

interface ConfiguredPaidBoundaryOptions {
  origin?: string;
  epochs?: RequestEpochVerifier;
  rejectLegacy?: boolean;
  sessions: SessionVerifier;
  cookieName: string;
  engine: Pick<QuotaEngine, 'getSnapshot'>;
  admission: RateLimiter;
  rate?: RateLimiter;
  images?: PaidImageVerifier;
  ingress(request: Request): TrustedIngressContext;
  maxBytes: number;
  dependencyTimeoutMs: number;
  now(): Date;
  audit(event: { endpoint: ProtectedEndpoint; outcome: string }): void;
}

export interface PaidImageVerifier {
  verify(bytes: Uint8Array, mime: string): Promise<{ width: number; height: number } | null>;
}

export interface TestOnlyPaidPipeline {
  scope: 'TEST_ONLY';
  endpoint: ProtectedEndpoint;
  execute(request: Request): Promise<Response>;
}

export type PaidBoundaryOptions = ConfiguredPaidBoundaryOptions | {
  testOnlyPipeline: TestOnlyPaidPipeline;
  audit(event: { endpoint: ProtectedEndpoint; outcome: string }): void;
};

// Production route 預設 fail closed；只有明確 TEST_ONLY 注入可接隔離 mock pipeline。
export function createPaidEndpointBoundary(endpoint: ProtectedEndpoint, options?: PaidBoundaryOptions) {
  return async (request: Request): Promise<Response> => {
    const reject = (code: 'METHOD_NOT_ALLOWED' | 'INVALID_INPUT' | 'PAYLOAD_TOO_LARGE' |
      'AUTH_REQUIRED' | 'ACCESS_NOT_APPROVED' | 'PROTECTION_SERVICE_UNAVAILABLE' | 'RATE_LIMITED' |
      'OPERATION_NO_LONGER_EXECUTABLE', retryAfterSeconds?: number) => {
      if (options) options.audit({ endpoint, outcome: code });
      else console.info(JSON.stringify({ event: 'tokyo-mate.protection', endpoint, outcome: code }));
      return errorResponse({ kind: 'code', code, ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) });
    };
    if (request.method !== 'POST') return reject('METHOD_NOT_ALLOWED');
    if (!options) return reject('PROTECTION_SERVICE_UNAVAILABLE');
    if ('testOnlyPipeline' in options) {
      const testOnly = options.testOnlyPipeline;
      if (!testOnly || testOnly.scope !== 'TEST_ONLY' || testOnly.endpoint !== endpoint ||
          typeof testOnly.execute !== 'function') return reject('PROTECTION_SERVICE_UNAVAILABLE');
      return testOnly.execute(request);
    }
    try {
      if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0 ||
          !Number.isSafeInteger(options.dependencyTimeoutMs) || options.dependencyTimeoutMs <= 0 ||
          !/^[A-Za-z0-9_-]{1,64}$/.test(options.cookieName)) return reject('PROTECTION_SERVICE_UNAVAILABLE');
      const now = options.now();
      if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return reject('PROTECTION_SERVICE_UNAVAILABLE');
      const length = request.headers.get('content-length');
      if (length !== null) {
        if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) return reject('INVALID_INPUT');
        if (Number(length) > Math.min(options.maxBytes, INPUT_POLICY.maxBytes[endpoint])) return reject('PAYLOAD_TOO_LARGE');
      }
      const context = options.ingress(request);
      if (!/^[A-Za-z0-9_.:@/-]{1,128}$/.test(context.admissionKey)) return reject('PROTECTION_SERVICE_UNAVAILABLE');
      const admission = await withStoreTimeout(
        options.admission.consume(context.admissionKey, endpoint, now), options.dependencyTimeoutMs);
      if (admission.kind === 'limited') return reject('RATE_LIMITED', admission.retryAfterSeconds);
      if (admission.kind !== 'allowed') return reject('PROTECTION_SERVICE_UNAVAILABLE');
      const cookies = (request.headers.get('cookie') ?? '').split(';').map((part) => part.trim())
        .filter((part) => part.startsWith(`${options.cookieName}=`));
      if (cookies.length !== 1 || !cookies[0].slice(options.cookieName.length + 1)) return reject('AUTH_REQUIRED');
      const session = await withStoreTimeout(
        options.sessions.lookup(cookies[0].slice(options.cookieName.length + 1), now), options.dependencyTimeoutMs);
      if (session.kind === 'unauthenticated') return reject('AUTH_REQUIRED');
      if (session.kind !== 'authenticated') return reject('PROTECTION_SERVICE_UNAVAILABLE');
      if (!Number.isSafeInteger(session.expiresAt) || session.revokedAt !== null ||
          session.expiresAt <= options.now().getTime()) return reject('AUTH_REQUIRED');
      if (!/^[A-Za-z0-9_.:@/-]{1,128}$/.test(session.subject)) return reject('PROTECTION_SERVICE_UNAVAILABLE');
      const quota = await withStoreTimeout(options.engine.getSnapshot({
        identitySubject: session.subject,
      }), options.dependencyTimeoutMs);
      if (!quota.ok) return reject(quota.status === 403 ? 'ACCESS_NOT_APPROVED' : 'PROTECTION_SERVICE_UNAVAILABLE');
      if (!options.rate) return reject('PROTECTION_SERVICE_UNAVAILABLE');
      const rate = await withStoreTimeout(options.rate.consume(session.subject, endpoint, options.now()),
        options.dependencyTimeoutMs);
      if (rate.kind === 'limited') return reject('RATE_LIMITED', rate.retryAfterSeconds);
      if (rate.kind !== 'allowed') return reject('PROTECTION_SERVICE_UNAVAILABLE');
      const limits = { ...INPUT_POLICY, maxBytes: Math.min(options.maxBytes, INPUT_POLICY.maxBytes[endpoint]) };
      const audit = (event: { stage: string; outcome: string }) => options.audit({ endpoint, outcome: event.outcome });
      let handle: string | null = null;
      if (endpoint === 'transcribe') {
        handle = await validatePcmMultipart(request, await readBoundedBytes(request, limits, audit));
      } else {
        const body = await readBoundedJson(request, limits, audit);
        if (!validatePaidJson(endpoint, body)) return reject('INVALID_INPUT');
        if (isRecord(body) && typeof body.idempotencyKey === 'string') handle = body.idempotencyKey;
        if (endpoint === 'photo-ocr') {
          if (!isRecord(body) || typeof body.imageDataUrl !== 'string') return reject('INVALID_INPUT');
          const image = validateImageEnvelope(body.imageDataUrl);
          if (!options.images) return reject('PROTECTION_SERVICE_UNAVAILABLE');
          const size = await withStoreTimeout(options.images.verify(image.bytes, image.mime), options.dependencyTimeoutMs);
          if (size === null) return reject('INVALID_INPUT');
          if (![size.width, size.height].every((v) => Number.isSafeInteger(v) && v > 0))
            return reject('INVALID_INPUT');
          if (Math.max(size.width, size.height) > 2048) return reject('PAYLOAD_TOO_LARGE');
        }
        const token = request.headers.get('x-request-capability');
        if (options.rejectLegacy && !token) return reject('OPERATION_NO_LONGER_EXECUTABLE');
        if (token) {
          if (!options.origin) return reject('PROTECTION_SERVICE_UNAVAILABLE');
          if (request.headers.get('origin') !== options.origin ||
              (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin'))
            return reject('INVALID_INPUT');
          if (!handle || request.headers.get('idempotency-key') !== handle) return reject('INVALID_INPUT');
          if (!options.epochs) return reject('PROTECTION_SERVICE_UNAVAILABLE');
          const verified = await withStoreTimeout(options.epochs.verify(session.subject, endpoint, handle, token), options.dependencyTimeoutMs);
          if (!verified.ok) return reject(verified.code);
        } else if (handle) return reject('INVALID_INPUT');
      }
      return reject('PROTECTION_SERVICE_UNAVAILABLE');
    } catch (error) {
      if (error instanceof RequestBoundaryError) return reject(error.code);
      if (!(error instanceof Error)) throw error;
      return reject('PROTECTION_SERVICE_UNAVAILABLE');
    }
  };
}
