import { errorResponse } from './error-envelope';
import { success } from './http';
import type { QuotaEngine } from './quota-engine';
import { createSessionEndpoints, type SessionEndpointOptions } from './session-endpoints';
import { withStoreTimeout } from './shared-store';

export interface SelfServiceOptions extends SessionEndpointOptions {
  engine: Pick<QuotaEngine, 'getSnapshot' | 'getAtomicSnapshot'>;
  requestEpochHint?: (subject: string) => Promise<string>;
}

export function estimatedUsd(micro: number): string {
  if (!Number.isSafeInteger(micro)) throw new TypeError('額度金額必須為安全整數');
  const negative = micro < 0;
  const cents = (BigInt(Math.abs(micro)) + 5000n) / 10000n;
  return `${negative ? '-' : ''}${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export function createSelfServiceEndpoints(options?: SelfServiceOptions) {
  const unavailable = () => errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
  const session = createSessionEndpoints(options);
  return {
    async quota(request: Request): Promise<Response> {
      if (request.method !== 'GET') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' }, 'GET');
      if (!options) return unavailable();
      try {
        const principal = await session.lookup(request);
        if (principal.kind === 'unauthenticated') return errorResponse({ kind: 'code', code: 'AUTH_REQUIRED' });
        if (principal.kind !== 'authenticated') return unavailable();
        const outcome = await withStoreTimeout(options.engine.getSnapshot({
          identitySubject: principal.subject,
        }), options.timeoutMs);
        if (!outcome.ok) return outcome.status === 403 ?
          errorResponse({ kind: 'code', code: 'ACCESS_NOT_APPROVED' }) : unavailable();
        const requestEpochId = options.requestEpochHint
          ? await withStoreTimeout(options.requestEpochHint(principal.subject), options.timeoutMs) : undefined;
        if (requestEpochId !== undefined && !/^g[1-9][0-9]*_[A-Za-z0-9_-]{22}$/.test(requestEpochId))
          throw new Error('INVALID_REQUEST_EPOCH_HINT');
        const day = outcome.snapshot.day, week = outcome.snapshot.week;
        const format = (w: typeof day) => ({
          limitEstimatedUsd: estimatedUsd(w.limitEstimatedUsdMicro), usedEstimatedUsd: estimatedUsd(w.usedEstimatedUsdMicro),
          reservedEstimatedUsd: estimatedUsd(w.reservedEstimatedUsdMicro), remainingEstimatedUsd: estimatedUsd(w.remainingEstimatedUsdMicro),
          resetAt: w.resetAt,
        });
        return Response.json(success({ tier: outcome.tier, currency: 'USD', timezone: 'Asia/Taipei',
          daily: format(day), weekly: { ...format(week),
            weekWindowKey: week.windowKey,
            baseLimitEstimatedUsd: estimatedUsd(week.baseLimitEstimatedUsdMicro),
            activeTopUpEstimatedUsd: estimatedUsd(week.cumulativeTopUpEstimatedUsdMicro) },
          ...(requestEpochId ? { requestEpoch: { epochId: requestEpochId } } : {}),
        }), { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
        if (!(error instanceof Error)) throw error;
        return unavailable();
      }
    },
    async mapEligibility(request: Request): Promise<Response> {
      if (request.method !== 'GET') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' }, 'GET');
      if (!options) return unavailable();
      try {
        const principal = await session.lookup(request);
        let reason: 'eligible' | 'auth_required' | 'not_approved' | 'daily_quota' | 'weekly_quota';
        let resetAt: string | undefined;
        if (principal.kind === 'unauthenticated') reason = 'auth_required';
        else if (principal.kind !== 'authenticated') return unavailable();
        else {
          const result = await withStoreTimeout(options.engine.getAtomicSnapshot(principal.subject), options.timeoutMs);
          if (result.ok) {
            reason = 'eligible';
            resetAt = new Date(Math.min(Date.parse(result.snapshot.day.resetAt),
              Date.parse(result.snapshot.week.resetAt))).toISOString();
          }
          else if (result.status === 403) reason = 'not_approved';
          else if (result.status === 429) reason = result.window === 'day' ? 'daily_quota' : 'weekly_quota';
          else return unavailable();
        }
        return Response.json(success({ eligibleForInteractiveMap: reason === 'eligible', reason,
          ...(resetAt ? { resetAt } : {}),
          fetchedAt: options.now().toISOString() }), { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
        if (!(error instanceof Error)) throw error;
        return unavailable();
      }
    },
  };
}
