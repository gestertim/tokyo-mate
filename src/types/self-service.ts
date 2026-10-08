export type RequestKind = 'paid_access' | 'weekly_top_up';
export interface OwnRequestInput {
  kind: RequestKind;
  idempotencyKey: string;
  reasonCode: 'paid_feature_access' | 'weekly_limit_review' | 'weekly_floor_review';
  weekWindowKey?: string;
}
export interface OwnRequest {
  reviewId: string;
  kind: RequestKind;
  reasonCode: OwnRequestInput['reasonCode'];
  createdAt: string;
  status: 'pending' | 'resolved' | 'withdrawn';
  weekWindowKey?: string;
}
export interface OwnRequestPage { items: OwnRequest[]; nextOffset: number | null }
export type OperationState = 'reserved' | 'settled' | 'released' | 'uncertain';
export interface OperationView { state: OperationState; updatedAt: string; userMessage: string }
export const operationMessages: Record<OperationState, string> = {
  reserved: '此操作已預留額度，目前尚未確認完成。',
  settled: '此操作已有記帳紀錄；這不代表結果內容已成功取得。',
  released: '此操作的預留已釋放；這不代表已有結果內容。',
  uncertain: '目前無法確認此操作結果，預留仍保留；請勿自動重送。',
};
export const meRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
export const meId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
export const meDate = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 64 && Number.isFinite(Date.parse(v));
export const requestReasonValid = (kind: unknown, reason: unknown) =>
  kind === 'paid_access' ? reason === 'paid_feature_access' :
    kind === 'weekly_top_up' && (reason === 'weekly_limit_review' || reason === 'weekly_floor_review');
export const isOwnRequest = (v: unknown): v is OwnRequest => meRecord(v) && meId(v.reviewId) &&
  requestReasonValid(v.kind, v.reasonCode) && meDate(v.createdAt) &&
  ['pending', 'resolved', 'withdrawn'].includes(String(v.status)) &&
  (v.kind === 'paid_access' ? v.weekWindowKey === undefined : /^\d{4}-W\d{2}$/.test(String(v.weekWindowKey)));
export const isOwnRequestPage = (v: unknown): v is OwnRequestPage => meRecord(v) &&
  Array.isArray(v.items) && v.items.length <= 100 && v.items.every(isOwnRequest) &&
  (v.nextOffset === null || (Number.isSafeInteger(v.nextOffset) && Number(v.nextOffset) >= 0 &&
    Number(v.nextOffset) <= 999999 && v.items.length > 0));
export function projectOwnRequest(v: unknown): OwnRequest {
  if (!isOwnRequest(v)) throw new TypeError('無效本人申請資料');
  return { reviewId: v.reviewId, kind: v.kind, reasonCode: v.reasonCode, createdAt: v.createdAt, status: v.status,
    ...(v.kind === 'weekly_top_up' ? { weekWindowKey: v.weekWindowKey } : {}) };
}
export const isOperationView = (v: unknown): v is OperationView => meRecord(v) &&
  Object.hasOwn(operationMessages, String(v.state)) && meDate(v.updatedAt) &&
  v.userMessage === operationMessages[v.state as OperationState];
