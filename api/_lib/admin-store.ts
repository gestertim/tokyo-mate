import type { AccessTier, EligibilityStatus, EligibilityRecord, TopUpRecord, QuotaUsage } from './shared-store';
import type { AdminOverviewView } from '../../src/types/access';

export interface AdminOverviewData extends AdminOverviewView {
  nearLimits?: { identitySubject: string; window: 'day' | 'week'; usedEstimatedUsd: string; limitEstimatedUsd: string }[];
}

export interface AdminUser {
  identitySubject: string;
  displayName?: string;
  maskedContact?: string;
  status: EligibilityStatus;
  tier: AccessTier | null;
  daily?: AdminQuotaWindow;
  weekly?: AdminQuotaWindow;
}
export interface AdminQuotaWindow {
  limitEstimatedUsd: string;
  usedEstimatedUsd: string;
  reservedEstimatedUsd: string;
  remainingEstimatedUsd: string;
  resetAt: string;
}
export interface AdminUserDetail extends AdminUser {
  daily: AdminQuotaWindow;
  weekly: AdminQuotaWindow & { windowKey: string; activeTopUpEstimatedUsd: string };
  endpointUsage: { endpoint: string; requestCount: number; estimatedUsd: string }[];
  topUps: { topUpId: string; amountEstimatedUsd: string; status: 'active' | 'revoked' | 'expired'; expiresAt: string }[];
}
export interface AdminReview {
  reviewId: string;
  targetIdentitySubject: string;
  kind: 'paid_access' | 'weekly_top_up';
  createdAt: string;
  status: 'pending' | 'resolved' | 'withdrawn';
  reasonCode?: string;
  weekWindowKey?: string;
  tier?: AccessTier | null;
  weekly?: AdminQuotaWindow;
}
export type AdminAction = 'approve' | 'reject' | 'change_tier' | 'revoke' | 'top_up' | 'top_up_revoke';
export interface AdminAudit {
  auditId: string;
  idempotencyKey: string;
  adminSubject: string;
  targetIdentitySubject: string;
  action: AdminAction;
  createdAt: string;
  reasonCode: string;
  before: { status?: string; tier?: AccessTier | null; cumulativeWeeklyTopUpMicroUsd?: number };
  after: { status?: string; tier?: AccessTier | null; cumulativeWeeklyTopUpMicroUsd?: number };
  weekWindowKey?: string;
  expiresAt?: string;
  amountEstimatedUsd?: string;
  scope?: 'all_protected_endpoints';
  topUpId?: string;
}
export interface AdminMutation {
  action: AdminAction;
  idempotencyKey: string;
  adminSubject: string;
  targetIdentitySubject: string;
  confirmed: true;
  reasonCode: string;
  tier?: AccessTier;
  reviewId?: string;
  topUpId?: string;
  weekWindowKey?: string;
  amountMicroUsd?: number;
  expiresAt?: string;
  scope?: 'all_protected_endpoints';
  nowIso: string;
}
export interface AdminMutationResult {
  outcome: 'applied' | 'duplicate' | 'conflict' | 'not_found' | 'invalid';
  auditId?: string;
}
export interface AdminPage<T> { items: T[]; nextOffset: number | null }
export interface AdminStore {
  users(offset: number, limit: number): Promise<AdminPage<AdminUser>>;
  detail(subject: string, nowIso: string): Promise<AdminUserDetail | null>;
  reviews(offset: number, limit: number): Promise<AdminPage<AdminReview>>;
  audits(offset: number, limit: number): Promise<AdminPage<AdminAudit>>;
  mutate(command: AdminMutation): Promise<AdminMutationResult>;
}

// 與 quota authority 共用的 wire records；UI 不直接回傳這些內部資料。
export interface AdminAuthorityRecords {
  eligibility: EligibilityRecord;
  topUps: TopUpRecord[];
  usage: QuotaUsage;
}
export const adminSubjectValid = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u0020\u007f]/.test(value);
export const adminIdValid = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const adminMoney = (micro: number) => (micro / 1_000_000).toFixed(2);
