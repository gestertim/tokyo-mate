import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SessionResult, SessionVerifier } from './protected-endpoint-pipeline';
import { SharedStoreUnavailableError, withStoreTimeout } from './shared-store';

export interface SessionRecord {
  sessionId: string;
  identitySubject: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface SessionStore {
  create(record: SessionRecord): Promise<void>;
  get(sessionId: string): Promise<SessionRecord | null>;
  revoke(sessionId: string, nowIso: string): Promise<void>;
}

export interface SessionOptions {
  store: SessionStore;
  signingKey: Uint8Array;
  lifetimeMs: number;
  storeTimeoutMs: number;
  cookieName: string;
  now(): Date;
  audit(event: { operation: 'session'; outcome: 'unavailable' | 'invalid_store_data' }): void;
}

const TOKEN = /^[0-9a-f]{64}$/;
export function createSessionService(options: SessionOptions): SessionVerifier & {
  create(identitySubject: string): Promise<string>;
  logout(signedCookie: string | null): Promise<string>;
  readCookie(request: Request): string | null;
} {
  if (!(options.signingKey instanceof Uint8Array) || options.signingKey.byteLength < 32 ||
      !Number.isSafeInteger(options.lifetimeMs) || options.lifetimeMs <= 0 ||
      !Number.isSafeInteger(options.storeTimeoutMs) || options.storeTimeoutMs <= 0 ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(options.cookieName))
    throw new TypeError('Session 需要可信金鑰及明確期限／timeout／cookie 設定');
  const key = Buffer.from(options.signingKey);
  const sign = (id: string) => createHmac('sha256', key).update(`tokyo-mate/session/v1:${id}`).digest('hex');
  const verify = (value: string): string | null => {
    const parts = value.split('.');
    if (parts.length !== 2 || !TOKEN.test(parts[0]) || !TOKEN.test(parts[1])) return null;
    return timingSafeEqual(Buffer.from(sign(parts[0]), 'hex'), Buffer.from(parts[1], 'hex')) ? parts[0] : null;
  };
  const cookie = (value: string, age: number) =>
    `${options.cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
  const clock = () => {
    const time = options.now();
    if (!(time instanceof Date) || !Number.isFinite(time.getTime()))
      throw new SharedStoreUnavailableError('INVALID_SESSION_CLOCK');
    return time;
  };
  const call = <T>(work: Promise<T>) => withStoreTimeout(work, options.storeTimeoutMs);
  return {
    readCookie(request) {
      const candidates = (request.headers.get('cookie') ?? '').split(';')
        .map((part) => part.trim()).filter((part) => part.startsWith(`${options.cookieName}=`));
      return candidates.length === 1 ? candidates[0].slice(options.cookieName.length + 1) : null;
    },
    async create(identitySubject) {
      if (!/^[A-Za-z0-9_.:@/-]{1,128}$/.test(identitySubject)) throw new TypeError('無效 OIDC subject');
      const now = clock();
      const record: SessionRecord = {
        sessionId: randomBytes(32).toString('hex'), identitySubject, createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + options.lifetimeMs).toISOString(), revokedAt: null,
      };
      try {
        await call(options.store.create(record));
      } catch (error) {
        options.audit({ operation: 'session', outcome: 'unavailable' });
        throw error;
      }
      return cookie(`${record.sessionId}.${sign(record.sessionId)}`, Math.floor(options.lifetimeMs / 1000));
    },
    async lookup(value, now): Promise<SessionResult> {
      const id = verify(value);
      if (!id) return { kind: 'unauthenticated' };
      try {
        if (!Number.isFinite(now.getTime())) throw new SharedStoreUnavailableError('INVALID_SESSION_CLOCK');
        const record = await call(options.store.get(id));
        if (!record) return { kind: 'unauthenticated' };
        const from = Date.parse(record.createdAt), until = Date.parse(record.expiresAt);
        if (record.sessionId !== id || !/^[A-Za-z0-9_.:@/-]{1,128}$/.test(record.identitySubject) ||
            !Number.isFinite(from) || !Number.isFinite(until) || from >= until ||
            (record.revokedAt !== null && !Number.isFinite(Date.parse(record.revokedAt)))) {
          options.audit({ operation: 'session', outcome: 'invalid_store_data' });
          return { kind: 'unavailable' };
        }
        if (now.getTime() < from) {
          options.audit({ operation: 'session', outcome: 'invalid_store_data' });
          return { kind: 'unavailable' };
        }
        if (until <= now.getTime() || record.revokedAt !== null) return { kind: 'unauthenticated' };
        return { kind: 'authenticated', subject: record.identitySubject, expiresAt: until, revokedAt: null };
      } catch (error) {
        options.audit({ operation: 'session', outcome: 'unavailable' });
        if (!(error instanceof Error)) throw error;
        return { kind: 'unavailable' };
      }
    },
    async logout(value) {
      const id = value ? verify(value) : null;
      if (id) {
        try {
          await call(options.store.revoke(id, clock().toISOString()));
        } catch (error) {
          options.audit({ operation: 'session', outcome: 'unavailable' });
          throw error;
        }
      }
      return cookie('', 0);
    },
  };
}
