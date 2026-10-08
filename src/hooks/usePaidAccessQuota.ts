import { useCallback } from 'react';
import { isOwnQuotaView, loadOwnQuota } from '../services/access-api';
import type { OwnQuotaView } from '../types/access';
import { useAccessQuery } from './useAccessQuery';
import type { AccessFreshnessPolicy } from './accessFreshness';

export type PaidQuotaFreshnessPolicy = AccessFreshnessPolicy;
const unknownMessage = '目前無法確認最新額度。你仍可查看公開內容；確認狀態後請手動操作。';
const expiresAt = (data: OwnQuotaView) => Math.min(Date.parse(data.daily.resetAt), Date.parse(data.weekly.resetAt));
export function usePaidAccessQuota(
  load: (signal?: AbortSignal) => Promise<OwnQuotaView> = loadOwnQuota,
  freshness?: PaidQuotaFreshnessPolicy,
) {
  const validated = useCallback(async (signal?: AbortSignal) => {
    const data = await load(signal);
    if (!isOwnQuotaView(data)) throw new Error(unknownMessage);
    return data;
  }, [load]);
  return useAccessQuery(validated, { freshness, expiresAt, unknownMessage });
}
