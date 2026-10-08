export interface QuotaWindowView {
  limitEstimatedUsd: string;
  usedEstimatedUsd: string;
  reservedEstimatedUsd: string;
  remainingEstimatedUsd: string;
  resetAt: string;
}
export interface OwnQuotaView {
  tier: 'tier1' | 'tier2';
  currency: 'USD';
  timezone: 'Asia/Taipei';
  daily: QuotaWindowView;
  weekly: QuotaWindowView & { baseLimitEstimatedUsd: string; activeTopUpEstimatedUsd: string; weekWindowKey?: string };
  requestEpoch?: { epochId: string };
}
export interface AdminOverviewView {
  approvalCounts: { pending: number; approved: number; rejected: number; revoked: number; expired: number };
  estimatedUsage: { dailyUsedEstimatedUsd: string; weeklyUsedEstimatedUsd: string };
  protectionAvailable: boolean;
}
export interface MapAccessView {
  eligibleForInteractiveMap: boolean;
  reason: 'eligible' | 'auth_required' | 'not_approved' | 'daily_quota' | 'weekly_quota' |
    'map_tile_quota' | 'protection_unavailable' | 'unknown';
  fetchedAt: string;
  resetAt?: string;
}
