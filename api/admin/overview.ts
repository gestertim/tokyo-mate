import { requireAdmin, type AdminAuthOptions } from '../_lib/admin-auth';
import { errorResponse } from '../_lib/error-envelope';
import { success } from '../_lib/http';
import { withStoreTimeout } from '../_lib/shared-store';
import { adminSubjectValid, type AdminOverviewData } from '../_lib/admin-store';

export interface AdminOverviewOptions extends AdminAuthOptions {
  readOverview(): Promise<AdminOverviewData>;
}
export const createHandler = (options?: AdminOverviewOptions) => async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' }, 'GET');
  const principal = await requireAdmin(request, options);
  if (principal instanceof Response || !options) return principal instanceof Response ? principal :
    errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
  if (new URL(request.url).search) return errorResponse({ kind: 'code', code: 'INVALID_INPUT' });
  try {
    const data = await withStoreTimeout(options.readOverview(), options.timeoutMs);
    const counts = data.approvalCounts, usage = data.estimatedUsage;
    if (![counts.pending, counts.approved, counts.rejected, counts.revoked, counts.expired]
      .every((n) => Number.isSafeInteger(n) && n >= 0) ||
        ![usage.dailyUsedEstimatedUsd, usage.weeklyUsedEstimatedUsd].every((v) => /^\d+\.\d{2}$/.test(v)) ||
        typeof data.protectionAvailable !== 'boolean') throw new TypeError('無效管理總覽 DTO');
    const projected: AdminOverviewData = {
      approvalCounts: { pending: counts.pending, approved: counts.approved, rejected: counts.rejected,
        revoked: counts.revoked, expired: counts.expired },
      estimatedUsage: { dailyUsedEstimatedUsd: usage.dailyUsedEstimatedUsd, weeklyUsedEstimatedUsd: usage.weeklyUsedEstimatedUsd },
      protectionAvailable: data.protectionAvailable,
    };
    if (data.nearLimits !== undefined) {
      if (!Array.isArray(data.nearLimits) || data.nearLimits.length > 100) throw new TypeError('無效接近上限提示');
      projected.nearLimits = data.nearLimits.map((v) => {
        if (!adminSubjectValid(v.identitySubject) || !['day', 'week'].includes(v.window) ||
          ![v.usedEstimatedUsd, v.limitEstimatedUsd].every((n) => /^\d{1,16}\.\d{2}$/.test(n))) throw new TypeError('無效上限摘要');
        return { identitySubject: v.identitySubject, window: v.window, usedEstimatedUsd: v.usedEstimatedUsd, limitEstimatedUsd: v.limitEstimatedUsd };
      });
    }
    return Response.json(success(projected), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
    if (!(error instanceof Error)) throw error;
    return errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
  }
};
export const GET = createHandler();
