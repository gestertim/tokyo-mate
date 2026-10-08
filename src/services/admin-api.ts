import type { AdminUser, AdminUserDetail, AdminReview, AdminAudit, AdminPage, AdminAction, AdminMutationResult, AdminOverviewData } from '../../api/_lib/admin-store';
import { requestReasonValid } from '../types/self-service';
import type { EpochLifecycleInput, EpochLifecycleResult } from '../../api/_lib/epoch-lifecycle';
export type { AdminUser, AdminUserDetail, AdminReview, AdminAudit, AdminPage, AdminAction, AdminMutationResult };
export interface AdminMutationInput {
  action: AdminAction;
  idempotencyKey: string;
  targetIdentitySubject: string;
  confirmed: true;
  reasonCode: string;
  tier?: 'tier1' | 'tier2';
  reviewId?: string;
  topUpId?: string;
  weekWindowKey?: string;
  amountEstimatedUsd?: string;
  scope?: 'all_protected_endpoints';
  expiresAt?: string;
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const money = (v: unknown) => typeof v === 'string' && /^-?\d{1,16}\.\d{2}$/.test(v);
const timestamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const user = (v: unknown): v is AdminUser => record(v) && str(v.identitySubject) &&
  ['pending', 'approved', 'rejected', 'revoked', 'expired'].includes(String(v.status)) &&
  (v.status === 'approved' ? ['tier1', 'tier2'].includes(String(v.tier)) : v.tier === null) &&
  (v.daily === undefined || quota(v.daily)) && (v.weekly === undefined || quota(v.weekly));
const quota = (v: unknown) => record(v) &&
  ['limitEstimatedUsd', 'usedEstimatedUsd', 'reservedEstimatedUsd', 'remainingEstimatedUsd'].every((k) => money(v[k])) && timestamp(v.resetAt);
const detail = (v: unknown): v is AdminUserDetail => user(v) && record(v) && quota(v.daily) && quota(v.weekly) &&
  record(v.weekly) && /^\d{4}-W\d{2}$/.test(String(v.weekly.windowKey)) && money(v.weekly.activeTopUpEstimatedUsd) &&
  Array.isArray(v.endpointUsage) && v.endpointUsage.length <= 6 && v.endpointUsage.every((e) =>
    record(e) && ['assistant', 'photo-ocr', 'photo-translate', 'places', 'transcribe', 'speech'].includes(String(e.endpoint)) &&
    Number.isSafeInteger(e.requestCount) && Number(e.requestCount) >= 0 && money(e.estimatedUsd)) &&
  Array.isArray(v.topUps) && v.topUps.length <= 100 && v.topUps.every((t) => record(t) &&
    str(t.topUpId, 128) && money(t.amountEstimatedUsd) && ['active', 'revoked', 'expired'].includes(String(t.status)) && timestamp(t.expiresAt));
const review = (v: unknown): v is AdminReview => record(v) && str(v.reviewId, 128) && str(v.targetIdentitySubject) &&
  ['paid_access', 'weekly_top_up'].includes(String(v.kind)) && v.status === 'pending' && timestamp(v.createdAt) &&
  (v.reasonCode === undefined || requestReasonValid(v.kind, v.reasonCode)) &&
  (v.weekWindowKey === undefined || /^\d{4}-W\d{2}$/.test(String(v.weekWindowKey))) &&
  (v.tier === undefined || ['tier1', 'tier2', null].includes(v.tier as never)) && (v.weekly === undefined || quota(v.weekly));
const audit = (v: unknown): v is AdminAudit => record(v) && str(v.auditId, 128) && str(v.idempotencyKey, 128) &&
  str(v.adminSubject) && str(v.targetIdentitySubject) && str(v.reasonCode, 128) && timestamp(v.createdAt) &&
  ['approve', 'reject', 'change_tier', 'revoke', 'top_up', 'top_up_revoke'].includes(String(v.action)) && record(v.before) && record(v.after);
const overview = (v: unknown): v is AdminOverviewData => record(v) && record(v.approvalCounts) &&
  ['pending', 'approved', 'rejected', 'revoked', 'expired'].every((key) => record(v.approvalCounts) &&
    Number.isSafeInteger(v.approvalCounts[key]) && Number(v.approvalCounts[key]) >= 0) &&
  record(v.estimatedUsage) && money(v.estimatedUsage.dailyUsedEstimatedUsd) && money(v.estimatedUsage.weeklyUsedEstimatedUsd) &&
  typeof v.protectionAvailable === 'boolean' && (v.nearLimits === undefined || (Array.isArray(v.nearLimits) &&
    v.nearLimits.length <= 100 && v.nearLimits.every((a) => record(a) && str(a.identitySubject) &&
      ['day', 'week'].includes(String(a.window)) && money(a.usedEstimatedUsd) && money(a.limitEstimatedUsd))));
const page = <T,>(guard: (v: unknown) => v is T) => (v: unknown): v is AdminPage<T> =>
  record(v) && Array.isArray(v.items) && v.items.length <= 100 && v.items.every(guard) &&
  (v.nextOffset === null || (Number.isSafeInteger(v.nextOffset) && Number(v.nextOffset) >= 0));
export class AdminApiError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'AdminApiError'; }
}
async function send<T>(path: string, guard: (v: unknown) => v is T, signal?: AbortSignal, body?: AdminMutationInput | EpochLifecycleInput): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AdminApiError('NETWORK_ERROR', body ?
      '無法確認異動結果。請勿建立新的操作；可用相同操作鍵手動重新確認。' : '目前無法讀取管理資料，請稍後手動重新確認。');
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new AdminApiError('INVALID_RESPONSE', '無法確認管理結果，請手動重新確認。'); }
  if (!response.ok || !record(payload) || payload.success !== true) {
    if (record(payload) && record(payload.error) && str(payload.error.code) && str(payload.error.userMessage, 1000))
      throw new AdminApiError(payload.error.code, payload.error.userMessage);
    throw new AdminApiError(response.status === 409 ? 'CONFLICT' : 'UNAVAILABLE',
      response.status === 409 ? '此項目已被處理或操作鍵內容不一致。請手動更新資料，不會自動重送。' : '目前無法確認管理結果。');
  }
  if (!guard(payload.data)) throw new AdminApiError('INVALID_RESPONSE', '管理資料格式無法確認，請手動重新整理。');
  return payload.data;
}
export const loadAdminUsers = (offset = 0, signal?: AbortSignal) =>
  send(`/api/admin/users?offset=${offset}&limit=25`, page(user), signal);
export const loadAdminOverviewData = (signal?: AbortSignal) => send('/api/admin/overview', overview, signal);
export const loadAdminUserDetail = (subject: string, signal?: AbortSignal) =>
  send(`/api/admin/users/${encodeURIComponent(subject)}`, detail, signal);
export const loadAdminReviews = (offset = 0, signal?: AbortSignal) =>
  send(`/api/admin/review-queue?offset=${offset}&limit=25`, page(review), signal);
export const loadAdminAudit = (offset = 0, signal?: AbortSignal) =>
  send(`/api/admin/audit?offset=${offset}&limit=25`, page(audit), signal);
export const submitAdminMutation = (body: AdminMutationInput, signal?: AbortSignal) => send(
  body.action === 'top_up' || body.action === 'top_up_revoke' ? '/api/admin/top-ups' : '/api/admin/approvals',
  (v): v is AdminMutationResult => record(v) && ['applied', 'duplicate'].includes(String(v.outcome)) && str(v.auditId, 128), signal, body);
export const submitEpochLifecycleStep = (body: EpochLifecycleInput) => send('/api/admin/epoch-lifecycle',
  (v): v is EpochLifecycleResult => record(v) && ['inspected', 'applied', 'duplicate', 'dry_run'].includes(String(v.outcome)) &&
    str(v.auditId, 128), undefined, body);
