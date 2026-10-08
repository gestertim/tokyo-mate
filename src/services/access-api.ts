import type { AdminOverviewView, MapAccessView, OwnQuotaView, QuotaWindowView } from '../types/access';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const money = (value: unknown): value is string => typeof value === 'string' && /^-?\d+\.\d{2}$/.test(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const windowView = (value: unknown): value is QuotaWindowView => record(value) &&
  money(value.limitEstimatedUsd) && money(value.usedEstimatedUsd) && money(value.reservedEstimatedUsd) &&
  money(value.remainingEstimatedUsd) && timestamp(value.resetAt);
export const isOwnQuotaView = (value: unknown): value is OwnQuotaView => record(value) &&
  (value.tier === 'tier1' || value.tier === 'tier2') && value.currency === 'USD' && value.timezone === 'Asia/Taipei' &&
  windowView(value.daily) && windowView(value.weekly) && record(value.weekly) &&
  money(value.weekly.baseLimitEstimatedUsd) && money(value.weekly.activeTopUpEstimatedUsd) &&
  (value.requestEpoch === undefined || (record(value.requestEpoch) &&
    typeof value.requestEpoch.epochId === 'string' && /^g[1-9][0-9]*_[A-Za-z0-9_-]{22}$/.test(value.requestEpoch.epochId)));
const overview = (value: unknown): value is AdminOverviewView => record(value) && record(value.approvalCounts) &&
  ['pending', 'approved', 'rejected', 'revoked', 'expired'].every((key) =>
    typeof value.approvalCounts === 'object' && value.approvalCounts !== null &&
    record(value.approvalCounts) && typeof value.approvalCounts[key] === 'number' &&
    Number.isSafeInteger(value.approvalCounts[key]) && Number(value.approvalCounts[key]) >= 0) &&
  record(value.estimatedUsage) && money(value.estimatedUsage.dailyUsedEstimatedUsd) &&
  money(value.estimatedUsage.weeklyUsedEstimatedUsd) && typeof value.protectionAvailable === 'boolean';
const mapAccess = (value: unknown): value is MapAccessView => record(value) &&
  typeof value.eligibleForInteractiveMap === 'boolean' && timestamp(value.fetchedAt) &&
  typeof value.reason === 'string' && ['eligible', 'auth_required', 'not_approved', 'daily_quota', 'weekly_quota',
    'map_tile_quota', 'protection_unavailable', 'unknown'].includes(value.reason) &&
  value.eligibleForInteractiveMap === (value.reason === 'eligible') &&
  (!value.eligibleForInteractiveMap || timestamp(value.resetAt));

export class AccessApiError extends Error {
  constructor(readonly code: string, message: string, readonly details?: {
    userTitle?: string; quotaScope?: 'all' | 'request'; retryAfterSeconds?: number;
  }) { super(message); this.name = 'AccessApiError'; }
}

async function read<T>(path: string, guard: (value: unknown) => value is T, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AccessApiError('NETWORK_ERROR', '目前無法確認使用狀態。請確認網路後手動重新整理。');
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '目前無法確認使用狀態。你仍可查看公開內容。'); }
  if (!response.ok || !record(payload) || payload.success !== true) {
    if (record(payload) && payload.success === false && record(payload.error) &&
        typeof payload.error.code === 'string' && typeof payload.error.userMessage === 'string' &&
        typeof payload.error.actionableStep === 'string') {
      const error = payload.error;
      const quotaError = error.code === 'DAILY_QUOTA_EXHAUSTED' || error.code === 'WEEKLY_QUOTA_EXHAUSTED';
      if (quotaError && (response.status !== 429 || (error.quotaScope !== 'all' && error.quotaScope !== 'request')))
        throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '使用狀態資料無法確認，請稍後手動重新整理。');
      throw new AccessApiError(String(error.code), `${error.userMessage} ${error.actionableStep}`, {
        userTitle: typeof error.userTitle === 'string' ? error.userTitle : undefined,
        quotaScope: quotaError ? error.quotaScope as 'all' | 'request' : undefined,
        retryAfterSeconds: typeof error.retryAfterSeconds === 'number' &&
          Number.isSafeInteger(error.retryAfterSeconds) && error.retryAfterSeconds >= 0 ? error.retryAfterSeconds : undefined,
      });
    }
    throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '目前無法確認使用狀態。你仍可查看公開內容。');
  }
  if (!guard(payload.data)) throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '使用狀態資料無法確認，請稍後手動重新整理。');
  return payload.data;
}

export const loadOwnQuota = (signal?: AbortSignal) => read('/api/me/quota', isOwnQuotaView, signal);
export const loadAdminOverview = (signal?: AbortSignal) => read('/api/admin/overview', overview, signal);
export const loadMapAccess = (signal?: AbortSignal) => read('/api/me/map-eligibility', mapAccess, signal);
