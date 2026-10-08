// 功能 005 T131：G-B「額度不可用」判定（plan.md §4.5）。
// G ＝ E_live 內各端點 R_max 的最小值；E_live 只取價表 live:true 的端點。
// 此檔不含任何 G 數值常數；G 一律由傳入價表重算。
import { estimateMaxReservation } from './cost-estimators';
import { PROTECTED_ENDPOINTS, costModelOf, isCostModelEffective, type CostPriceTable, type ProtectedEndpoint } from './cost-price-table';
import { remainingMicroUsd, type QuotaSnapshot, type WindowSnapshot } from './quota-engine';

export type GlobalFloorResult =
  | { ok: true; floorMicroUsd: number; liveEndpoints: ProtectedEndpoint[] }
  | { ok: false; reason: 'COST_MODEL_INVALID' };

export function computeGlobalFloor(table: CostPriceTable): GlobalFloorResult {
  if (!table || typeof table.version !== 'string' || table.version.length === 0) {
    return { ok: false, reason: 'COST_MODEL_INVALID' };
  }
  const liveEndpoints: ProtectedEndpoint[] = [];
  let floor = Number.POSITIVE_INFINITY;
  for (const endpoint of PROTECTED_ENDPOINTS) {
    if (!table.endpoints?.[endpoint]?.live) continue; // live:false 的價格不影響 G
    const max = estimateMaxReservation(endpoint, table);
    // live:true 卻無法算出 R_max（含 speech 被標 live）代表價表自相矛盾 → fail closed
    if (!max.ok) return { ok: false, reason: 'COST_MODEL_INVALID' };
    liveEndpoints.push(endpoint);
    floor = Math.min(floor, max.amountMicroUsd);
  }
  if (liveEndpoints.length === 0) return { ok: false, reason: 'COST_MODEL_INVALID' };
  return { ok: true, floorMicroUsd: floor, liveEndpoints };
}

export type AvailabilityResult =
  | { state: 'available'; floorMicroUsd: number; mapAvailable: true }
  | { state: 'cost_model_invalid'; status: 503; publicCode: 'PROTECTION_SERVICE_UNAVAILABLE'; mapAvailable: false }
  | {
      state: 'exhausted' | 'below_floor';
      status: 429;
      code: 'DAILY_QUOTA_EXHAUSTED' | 'WEEKLY_QUOTA_EXHAUSTED';
      quotaScope: 'all';
      window: 'day' | 'week';
      mapReason: 'daily_quota' | 'weekly_quota';
      mapAvailable: false;
      floorMicroUsd: number;
    }
  | {
      state: 'request_insufficient';
      status: 429;
      code: 'DAILY_QUOTA_EXHAUSTED' | 'WEEKLY_QUOTA_EXHAUSTED';
      quotaScope: 'request';
      window: 'day' | 'week';
      mapAvailable: true;
      floorMicroUsd: number;
    };

export interface AvailabilityInput {
  snapshot: QuotaSnapshot;
  table: CostPriceTable;
  /** 該請求的 R_e；地圖 gate 不傳（不預留、不扣款）。 */
  requestReservationMicroUsd?: number;
  /** 呼叫端估算 R_e 時使用的價表版本；與 table.version 不同視為成本模型無效。 */
  costModelVersion?: string;
  /** 提供時檢查價表有效期；過期或尚未生效視為成本模型無效。 */
  now?: Date;
}

type WindowClass = 'available' | 'request_insufficient' | 'below_floor' | 'exhausted';
const RANK: Record<WindowClass, number> = { available: 0, request_insufficient: 1, below_floor: 2, exhausted: 3 };

function classifyWindow(w: WindowSnapshot, floor: number, request: number | undefined): WindowClass {
  if (w.limitEstimatedUsdMicro - w.usedEstimatedUsdMicro <= 0) return 'exhausted';
  const remaining = remainingMicroUsd(w);
  if (remaining < floor) return 'below_floor';
  if (request !== undefined && request > remaining) return 'request_insufficient';
  return 'available';
}

export function classifyAtomicAvailability(snapshot: QuotaSnapshot, floor: number, request?: number) {
  if (!Number.isSafeInteger(floor) || floor <= 0) throw new RangeError('原子 G 必須為正安全整數');
  const day = classifyWindow(snapshot.day, floor, request);
  const week = classifyWindow(snapshot.week, floor, request);
  const window = RANK[day] >= RANK[week] ? 'day' : 'week';
  return { state: window === 'day' ? day : week, window } as const;
}

const invalid: AvailabilityResult = {
  state: 'cost_model_invalid',
  status: 503,
  publicCode: 'PROTECTION_SERVICE_UNAVAILABLE',
  mapAvailable: false,
};

/**
 * 優先序：成本模型無效 → 實際額度耗盡 → 無啟用端點可負擔 → 個別請求預留不足。
 * 跨日／週取較高優先的類別；同類別時日優先。
 */
export function evaluateAvailability(input: AvailabilityInput): AvailabilityResult {
  const { snapshot, table, requestReservationMicroUsd: request, costModelVersion } = input;
  if (costModelVersion !== undefined && costModelVersion !== table.version) return invalid;
  if (input.now !== undefined && !isCostModelEffective(costModelOf(table), input.now.getTime())) return invalid;
  if (request !== undefined && !(Number.isSafeInteger(request) && request > 0)) return invalid;

  const floor = computeGlobalFloor(table);
  if (!floor.ok) return invalid;

  const day = classifyWindow(snapshot.day, floor.floorMicroUsd, request);
  const week = classifyWindow(snapshot.week, floor.floorMicroUsd, request);
  if (day === 'available' && week === 'available') {
    return { state: 'available', floorMicroUsd: floor.floorMicroUsd, mapAvailable: true };
  }

  const window: 'day' | 'week' = RANK[day] >= RANK[week] ? 'day' : 'week';
  const state = (window === 'day' ? day : week) as Exclude<WindowClass, 'available'>;
  const code = window === 'day' ? 'DAILY_QUOTA_EXHAUSTED' : 'WEEKLY_QUOTA_EXHAUSTED';

  if (state === 'request_insufficient') {
    return { state, status: 429, code, quotaScope: 'request', window, mapAvailable: true, floorMicroUsd: floor.floorMicroUsd };
  }
  return {
    state,
    status: 429,
    code,
    quotaScope: 'all',
    window,
    mapReason: window === 'day' ? 'daily_quota' : 'weekly_quota',
    mapAvailable: false,
    floorMicroUsd: floor.floorMicroUsd,
  };
}
