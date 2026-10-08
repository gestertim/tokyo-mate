// 功能 005 T020：Asia/Taipei 日／週窗口與 resetAt。
// 不讀取瀏覽器時鐘；呼叫端傳入伺服器端 now。Asia/Taipei 固定 UTC+8、無日光節約，
// 以固定位移計算，並由測試與 Intl 結果交叉比對。
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface QuotaWindowInfo {
  windowKey: string;
  /** 下一次重置（含）起算時間，UTC ISO。 */
  resetAt: string;
}

export interface QuotaWindows {
  day: QuotaWindowInfo;
  week: QuotaWindowInfo;
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

function toEpochMs(now: Date | number): number {
  const ms = now instanceof Date ? now.getTime() : now;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new RangeError('now 必須為有效時間');
  return ms;
}

/** 回傳台北當地日 00:00 對應的 UTC epoch（毫秒）。 */
function taipeiDayStart(ms: number): number {
  return Math.floor((ms + TAIPEI_OFFSET_MS) / DAY_MS) * DAY_MS - TAIPEI_OFFSET_MS;
}

export function getDayWindow(now: Date | number): QuotaWindowInfo {
  const start = taipeiDayStart(toEpochMs(now));
  const local = new Date(start + TAIPEI_OFFSET_MS);
  return {
    windowKey: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    resetAt: new Date(start + DAY_MS).toISOString(),
  };
}

/** ISO 8601 週（週一 00:00 起算），key 形如 2026-W39。 */
export function getWeekWindow(now: Date | number): QuotaWindowInfo {
  const dayStart = taipeiDayStart(toEpochMs(now));
  const local = new Date(dayStart + TAIPEI_OFFSET_MS);
  const isoDow = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  const weekStart = dayStart - (isoDow - 1) * DAY_MS;
  // ISO 週所屬年份由該週週四決定
  const thursday = new Date(weekStart + TAIPEI_OFFSET_MS + 3 * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const weekNumber = Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1;
  return {
    windowKey: `${isoYear}-W${pad(weekNumber)}`,
    resetAt: new Date(weekStart + 7 * DAY_MS).toISOString(),
  };
}

export function getQuotaWindows(now: Date | number): QuotaWindows {
  return { day: getDayWindow(now), week: getWeekWindow(now) };
}
