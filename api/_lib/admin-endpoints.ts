import { requireAdmin, requireAdminMutation, type AdminAuthOptions } from './admin-auth';
import { errorResponse } from './error-envelope';
import { success, isRecord } from './http';
import { withStoreTimeout } from './shared-store';
import { getWeekWindow } from './quota-window';
import { adminIdValid, adminSubjectValid, type AdminMutation, type AdminStore } from './admin-store';
import { requestReasonValid } from '../../src/types/self-service';

export interface AdminEndpointOptions extends AdminAuthOptions { store: AdminStore }
type Operation = 'users' | 'detail' | 'reviews' | 'audits' | 'approvals' | 'topups';
const bad = () => errorResponse({ kind: 'code', code: 'INVALID_INPUT' });
const unavailable = () => errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
const json = (data: unknown, status = 200) =>
  Response.json(success(data), { status, headers: { 'Cache-Control': 'no-store' } });
const statuses = ['pending', 'approved', 'rejected', 'revoked', 'expired'];
const endpoints = ['assistant', 'photo-ocr', 'photo-translate', 'places', 'transcribe', 'speech'];
const money = (v: unknown) => typeof v === 'string' && /^-?\d{1,16}\.\d{2}$/.test(v);
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
function user(value: unknown) {
  if (!isRecord(value) || !adminSubjectValid(value.identitySubject) ||
      !statuses.includes(String(value.status)) ||
      (value.status === 'approved' ? !['tier1', 'tier2'].includes(String(value.tier)) : value.tier !== null)) throw new Error('無效管理資料');
  return { identitySubject: value.identitySubject, status: value.status, tier: value.tier,
    ...(value.daily !== undefined ? { daily: windowDto(value.daily) } : {}),
    ...(value.weekly !== undefined ? { weekly: windowDto(value.weekly) } : {}),
    ...(typeof value.displayName === 'string' && value.displayName.length <= 100 ? { displayName: value.displayName } : {}),
    ...(typeof value.maskedContact === 'string' && value.maskedContact.length <= 100 ? { maskedContact: value.maskedContact } : {}) };
}
function windowDto(value: unknown) {
  if (!isRecord(value) || !['limitEstimatedUsd', 'usedEstimatedUsd', 'reservedEstimatedUsd', 'remainingEstimatedUsd']
    .every((k) => money(value[k])) || !date(value.resetAt)) throw new Error('無效額度資料');
  return { limitEstimatedUsd: value.limitEstimatedUsd, usedEstimatedUsd: value.usedEstimatedUsd,
    reservedEstimatedUsd: value.reservedEstimatedUsd, remainingEstimatedUsd: value.remainingEstimatedUsd, resetAt: value.resetAt };
}
function project(operation: Operation, data: unknown, limit: number): unknown {
  if (operation === 'detail') {
    if (data === null) return null;
    if (!isRecord(data) || !isRecord(data.weekly) || !money(data.weekly.activeTopUpEstimatedUsd) ||
      !/^\d{4}-W\d{2}$/.test(String(data.weekly.windowKey)) || !Array.isArray(data.endpointUsage) ||
      data.endpointUsage.length > 6 || !Array.isArray(data.topUps) || data.topUps.length > 100) throw new Error('無效詳情');
    return { ...user(data), daily: windowDto(data.daily), weekly: { ...windowDto(data.weekly),
      windowKey: data.weekly.windowKey, activeTopUpEstimatedUsd: data.weekly.activeTopUpEstimatedUsd },
    endpointUsage: data.endpointUsage.map((v: unknown) => {
      if (!isRecord(v) || !endpoints.includes(String(v.endpoint)) || !Number.isSafeInteger(v.requestCount) ||
        Number(v.requestCount) < 0 || !money(v.estimatedUsd)) throw new Error('無效端點摘要');
      return { endpoint: v.endpoint, requestCount: v.requestCount, estimatedUsd: v.estimatedUsd };
    }), topUps: data.topUps.map((v: unknown) => {
      if (!isRecord(v) || !adminIdValid(v.topUpId) || !money(v.amountEstimatedUsd) ||
        !['active', 'revoked', 'expired'].includes(String(v.status)) || !date(v.expiresAt)) throw new Error('無效追加摘要');
      return { topUpId: v.topUpId, amountEstimatedUsd: v.amountEstimatedUsd, status: v.status, expiresAt: v.expiresAt };
    }) };
  }
  if (!isRecord(data) || !Array.isArray(data.items) || data.items.length > limit ||
    !(data.nextOffset === null || (Number.isSafeInteger(data.nextOffset) && Number(data.nextOffset) >= 0))) throw new Error('無效清單');
  return { nextOffset: data.nextOffset, items: data.items.map((v: unknown) => {
    if (operation === 'users') return user(v);
    if (!isRecord(v) || !adminSubjectValid(v.targetIdentitySubject) || !date(v.createdAt)) throw new Error('無效管理清單');
    if (operation === 'reviews') {
      if (!adminIdValid(v.reviewId) || !['paid_access', 'weekly_top_up'].includes(String(v.kind)) ||
        v.status !== 'pending') throw new Error('無效審核資料');
      if (v.tier !== undefined && !['tier1', 'tier2', null].includes(v.tier as never)) throw new Error('無效申請等級');
      if (v.reasonCode !== undefined && !requestReasonValid(v.kind, v.reasonCode)) throw new Error('無效申請原因');
      if (v.weekWindowKey !== undefined && !/^\d{4}-W\d{2}$/.test(String(v.weekWindowKey))) throw new Error('無效申請週次');
      return { reviewId: v.reviewId, targetIdentitySubject: v.targetIdentitySubject, createdAt: v.createdAt, kind: v.kind, status: v.status,
        ...(v.reasonCode !== undefined ? { reasonCode: v.reasonCode } : {}),
        ...(v.weekWindowKey !== undefined ? { weekWindowKey: v.weekWindowKey } : {}),
        ...(v.tier !== undefined ? { tier: v.tier } : {}),
        ...(v.weekly !== undefined ? { weekly: windowDto(v.weekly) } : {}) };
    }
    if (!adminIdValid(v.auditId) || !adminIdValid(v.idempotencyKey) || !adminSubjectValid(v.adminSubject) ||
      !['approve', 'reject', 'change_tier', 'revoke', 'top_up', 'top_up_revoke'].includes(String(v.action)) ||
      !adminIdValid(v.reasonCode) || !isRecord(v.before) || !isRecord(v.after)) throw new Error('無效稽核資料');
    const state = (s: Record<string, unknown>) => {
      if (s.status !== undefined && !['active', 'revoked', ...statuses].includes(String(s.status))) throw new Error('無效狀態');
      if (s.tier !== undefined && !['tier1', 'tier2', null].includes(s.tier as never)) throw new Error('無效等級');
      if (s.cumulativeWeeklyTopUpMicroUsd !== undefined && (!Number.isSafeInteger(s.cumulativeWeeklyTopUpMicroUsd) ||
        Number(s.cumulativeWeeklyTopUpMicroUsd) < 0)) throw new Error('無效累計');
      return { ...(s.status !== undefined ? { status: s.status } : {}),
        ...(s.tier !== undefined ? { tier: s.tier } : {}),
        ...(s.cumulativeWeeklyTopUpMicroUsd !== undefined ? { cumulativeWeeklyTopUpMicroUsd: s.cumulativeWeeklyTopUpMicroUsd } : {}) };
    };
    const extra: Record<string, unknown> = {};
    if (v.weekWindowKey !== undefined) {
      if (!/^\d{4}-W\d{2}$/.test(String(v.weekWindowKey)) || !date(v.expiresAt) ||
        typeof v.amountEstimatedUsd !== 'string' || !/^\d{1,10}\.\d{1,6}$/.test(v.amountEstimatedUsd) ||
        v.scope !== 'all_protected_endpoints') throw new Error('無效追加稽核');
      Object.assign(extra, { weekWindowKey: v.weekWindowKey, expiresAt: v.expiresAt,
        amountEstimatedUsd: v.amountEstimatedUsd, scope: v.scope });
      if (v.topUpId !== undefined) {
        if (!adminIdValid(v.topUpId)) throw new Error('無效追加ID');
        extra.topUpId = v.topUpId;
      }
    }
    return { auditId: v.auditId, idempotencyKey: v.idempotencyKey, adminSubject: v.adminSubject,
      targetIdentitySubject: v.targetIdentitySubject, action: v.action, createdAt: v.createdAt,
      reasonCode: v.reasonCode, before: state(v.before), after: state(v.after), ...extra };
  }) };
}
async function boundedBody(request: Request): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) throw new Error('本文過大');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('缺少本文');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error('本文過大'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function command(body: unknown, operation: Operation, subject: string, now: Date): AdminMutation {
  if (!isRecord(body) || Object.keys(body).some((k) => ![
    'action', 'idempotencyKey', 'targetIdentitySubject', 'confirmed', 'reasonCode', 'tier', 'reviewId',
    'topUpId', 'weekWindowKey', 'amountEstimatedUsd', 'expiresAt', 'scope',
  ].includes(k)) || !adminIdValid(body.idempotencyKey) || !adminSubjectValid(body.targetIdentitySubject) ||
      !adminIdValid(body.reasonCode) || body.confirmed !== true ||
      (body.reviewId !== undefined && !adminIdValid(body.reviewId))) throw new Error('無效異動');
  const action = String(body.action ?? (operation === 'topups' ? 'top_up' : ''));
  if (!(operation === 'approvals' ? ['approve', 'reject', 'change_tier', 'revoke'] : ['top_up', 'top_up_revoke']).includes(action))
    throw new Error('無效操作');
  const result: AdminMutation = { action: action as AdminMutation['action'], idempotencyKey: body.idempotencyKey,
    adminSubject: subject, targetIdentitySubject: body.targetIdentitySubject, confirmed: true,
    reasonCode: body.reasonCode, nowIso: now.toISOString(), ...(body.reviewId ? { reviewId: String(body.reviewId) } : {}) };
  if (operation === 'approvals') {
    if (['approve', 'change_tier'].includes(action)) {
      if (!['tier1', 'tier2'].includes(String(body.tier))) throw new Error('缺少等級');
      result.tier = body.tier as AdminMutation['tier'];
    } else if (body.tier !== undefined) throw new Error('無效等級');
    if (['topUpId', 'weekWindowKey', 'amountEstimatedUsd', 'expiresAt', 'scope'].some((k) => body[k] !== undefined)) throw new Error('無效欄位');
  } else {
    if (body.tier !== undefined) throw new Error('无效欄位');
    const week = getWeekWindow(now);
    if (body.weekWindowKey !== week.windowKey || (body.expiresAt !== undefined &&
      (!date(body.expiresAt) || Date.parse(String(body.expiresAt)) !== Date.parse(week.resetAt)))) throw new Error('週窗口不符');
    Object.assign(result, { weekWindowKey: week.windowKey, expiresAt: week.resetAt, scope: 'all_protected_endpoints' });
    if (action === 'top_up') {
      if (body.scope !== 'all_protected_endpoints' || body.topUpId !== undefined ||
        typeof body.amountEstimatedUsd !== 'string' || !/^\d{1,10}(\.\d{1,6})?$/.test(body.amountEstimatedUsd)) throw new Error('無效金額');
      const [whole, fraction = ''] = body.amountEstimatedUsd.split('.');
      const amount = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'));
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('無效金額');
      result.amountMicroUsd = amount;
    } else {
      if (!adminIdValid(body.topUpId) || body.amountEstimatedUsd !== undefined ||
        (body.scope !== undefined && body.scope !== 'all_protected_endpoints')) throw new Error('無效追加撤銷');
      result.topUpId = body.topUpId;
    }
  }
  return result;
}
export function createAdminHandler(operation: Operation, options?: AdminEndpointOptions) {
  return async (request: Request): Promise<Response> => {
    const mutation = operation === 'approvals' || operation === 'topups';
    if (request.method !== (mutation ? 'POST' : 'GET')) return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' }, mutation ? 'POST' : 'GET');
    const principal = await (mutation ? requireAdminMutation : requireAdmin)(request, options);
    if (principal instanceof Response) return principal;
    if (!options) return unavailable();
    const url = new URL(request.url);
    if (url.search.length > 512) return bad();
    try {
      if (mutation) {
        if (url.search) return bad();
        let value: AdminMutation;
        try { value = command(await withStoreTimeout(boundedBody(request), options.timeoutMs), operation, principal.subject, options.now()); }
        catch { return bad(); }
        const result = await withStoreTimeout(options.store.mutate(value), options.timeoutMs);
        if (!['applied', 'duplicate', 'conflict', 'not_found', 'invalid'].includes(result.outcome)) throw new Error('無效異動結果');
        if (result.outcome === 'conflict') return json({ outcome: 'conflict' }, 409);
        if (result.outcome === 'not_found') return json({ outcome: 'not_found' }, 404);
        if (result.outcome === 'invalid') return bad();
        if (!adminIdValid(result.auditId)) throw new Error('缺少稽核證據');
        return json({ outcome: result.outcome, auditId: result.auditId });
      }
      if ([...url.searchParams.keys()].some((k) => !['offset', 'limit'].includes(k)) ||
        [...url.searchParams.keys()].some((k) => url.searchParams.getAll(k).length !== 1)) return bad();
      const offsetText = url.searchParams.get('offset') ?? '0', limitText = url.searchParams.get('limit') ?? '25';
      if (!/^\d{1,6}$/.test(offsetText) || !/^\d{1,3}$/.test(limitText)) return bad();
      const offset = Number(offsetText), limit = Number(limitText);
      if (limit < 1 || limit > 100) return bad();
      let read: Promise<unknown>;
      if (operation === 'detail') {
        if (url.search) return bad();
        let subject: string;
        try { subject = decodeURIComponent(url.pathname.slice('/api/admin/users/'.length)); } catch { return bad(); }
        if (!url.pathname.startsWith('/api/admin/users/') || !adminSubjectValid(subject)) return bad();
        read = options.store.detail(subject, options.now().toISOString());
      } else read = options.store[operation === 'audits' ? 'audits' : operation === 'reviews' ? 'reviews' : 'users'](offset, limit);
      const projected = project(operation, await withStoreTimeout(read, options.timeoutMs), limit);
      return json(projected, projected === null ? 404 : 200);
    } catch {
      options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
      return unavailable();
    }
  };
}
