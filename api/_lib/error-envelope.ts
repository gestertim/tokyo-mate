import type { ProductError } from '../../src/types/error';
import { failure } from './http';

type PipelineCode = 'AUTH_REQUIRED' | 'ACCESS_NOT_APPROVED' | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'INVALID_INPUT'
  | 'DUPLICATE_REQUEST' | 'IDEMPOTENCY_CONFLICT' | 'PROTECTION_SERVICE_UNAVAILABLE'
  | 'PLACES_SERVICE_UNAVAILABLE' | 'MAP_TILE_QUOTA_EXHAUSTED' | 'INVALID_TILE_COORDINATE'
  | 'OPERATION_NOT_FOUND' | 'OPERATION_NO_LONGER_EXECUTABLE'
  | 'REQUEST_NOT_FOUND' | 'REQUEST_ALREADY_RESOLVED';
export type QuotaState = 'exhausted' | 'below_floor' | 'request_insufficient';
export type TrustedPublicRejection =
  | { kind: 'code'; code: PipelineCode; retryAfterSeconds?: number }
  | { kind: 'quota'; state: QuotaState; window: 'day' | 'week'; retryAfterSeconds?: number };

const copy: Record<PipelineCode, readonly [number, string, string, string]> = {
  OPERATION_NOT_FOUND: [404, '找不到操作紀錄', '找不到可供此帳號查詢的操作紀錄。', '請確認目前帳號與原操作；不要自動重送付費請求。'],
  OPERATION_NO_LONGER_EXECUTABLE: [410, '這個操作已不能再送出', '這個操作目前不能取得新的執行授權；既有記帳或預留不會因此取消。', '請手動查看原操作狀態；若確實需要再次處理，請明確建立新操作。'],
  REQUEST_NOT_FOUND: [404, '找不到申請', '找不到可供此帳號查看的申請。', '請重新查詢本人申請清單。'],
  REQUEST_ALREADY_RESOLVED: [409, '申請已處理', '此申請已處理，無法撤回。', '請確認最新申請狀態；撤回不會撤銷已核准權利。'],
  AUTH_REQUIRED: [401, '需要登入', '需要登入才能使用這項付費功能。', '請先登入，並確認帳號已有有效核准資格，再手動重試。'],
  ACCESS_NOT_APPROVED: [403, '尚無有效核准資格', '此帳號目前沒有有效的付費功能核准資格。你仍可查看公開內容。', '請聯絡管理者確認核准資格，或查看公開內容。'],
  METHOD_NOT_ALLOWED: [405, '操作方式不支援', '此功能僅接受應用程式內既有的操作方式。', '請回到應用程式，使用既有操作方式。'],
  PAYLOAD_TOO_LARGE: [413, '內容過大', '檔案或請求內容過大，無法處理。', '請減少內容或檔案大小，再手動重試。'],
  RATE_LIMITED: [429, '請求過於頻繁', '短時間內請求太多，請稍後再試。', '請稍後再手動重試。'],
  INVALID_INPUT: [400, '輸入無法處理', '請求內容格式不正確或超出支援範圍。', '請確認輸入內容，再手動重試。'],
  DUPLICATE_REQUEST: [409, '操作已送出', '此操作已送出，請查看目前狀態。', '請勿重複送出；此提示不代表操作成功。'],
  IDEMPOTENCY_CONFLICT: [409, '操作識別碼不一致', '操作識別碼與原請求不一致，請重新確認操作。', '請重新確認操作，不要沿用原識別碼重送。'],
  PROTECTION_SERVICE_UNAVAILABLE: [503, '無法確認使用狀態', '保護服務暫時無法確認使用狀態，付費功能先暫停。請稍後再試。', '你仍可查看公開內容，稍後再手動重試付費功能。'],
  PLACES_SERVICE_UNAVAILABLE: [503, '地點搜尋暫時無法使用', '目前無法取得地點搜尋結果。', '請保留輸入，稍後再手動重試。'],
  MAP_TILE_QUOTA_EXHAUSTED: [429, '地圖使用次數暫不可用', '目前地圖請求次數已達上限，公開內容仍可查看。', '請稍後手動重新確認地圖使用狀態。'],
  INVALID_TILE_COORDINATE: [400, '圖磚座標無效', '無法處理此地圖圖磚請求。', '請回到應用程式，重新確認地圖使用狀態。'],
};
const quotaCopy: Record<QuotaState, Record<'day' | 'week', readonly [string, string, string]>> = {
  exhausted: {
    day: ['當日額度已滿', '當日額度已滿，請在下一個日額度週期後再試。你仍可查看公開內容。', '請在下一個日額度週期後確認最新額度，再手動重試。'],
    week: ['每週額度已滿', '每週額度已滿，本週需由管理者核准追加額度才能繼續使用付費功能。你仍可查看公開內容。', '請聯絡管理者申請本週追加額度；核准或進入下一個週額度週期後，確認日／週額度均足夠再手動重試。'],
  },
  below_floor: {
    day: ['今日剩餘額度不足預留門檻', '今日額度尚未用完，但剩餘額度不足目前可用付費功能的預留門檻，付費功能暫時無法使用。你仍可查看公開內容。', '請稍後確認最新額度，或在下一個日額度週期後再確認；週額度追加不會提高當日上限。額度足夠後再手動重試。'],
    week: ['本週剩餘額度不足預留門檻', '本週額度尚未用完，但剩餘額度不足目前可用付費功能的預留門檻，付費功能暫時無法使用。你仍可查看公開內容。', '請稍後確認最新額度，或聯絡管理者申請本週追加額度；追加不保證恢復，仍須確認日／週額度均足夠，再手動重試。'],
  },
  request_insufficient: {
    day: ['今日剩餘額度不足以處理這次請求', '今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。', '請依這項功能支援的方式減少輸入量，或改用其他較低成本功能；確認最新額度後再手動重試。'],
    week: ['本週剩餘額度不足以處理這次請求', '今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。', '請依這項功能支援的方式減少輸入量，或改用其他較低成本功能；確認最新額度後再手動重試。'],
  },
};

export function toProductError(rejection: TrustedPublicRejection): ProductError {
  const text = rejection.kind === 'quota' ? quotaCopy[rejection.state][rejection.window]
    : [copy[rejection.code][1], copy[rejection.code][2], copy[rejection.code][3]];
  const [userTitle, userMessage, actionableStep] = text;
  const error: ProductError = {
    code: rejection.kind === 'quota'
      ? rejection.window === 'day' ? 'DAILY_QUOTA_EXHAUSTED' : 'WEEKLY_QUOTA_EXHAUSTED'
      : rejection.code,
    userTitle, userMessage, actionableStep,
  };
  if (rejection.kind === 'quota') error.quotaScope = rejection.state === 'request_insufficient' ? 'request' : 'all';
  if ((rejection.kind === 'quota' || rejection.code === 'RATE_LIMITED') &&
      typeof rejection.retryAfterSeconds === 'number' && Number.isSafeInteger(rejection.retryAfterSeconds) && rejection.retryAfterSeconds > 0) {
    error.retryAfterSeconds = rejection.retryAfterSeconds;
  }
  return error;
}

export function errorResponse(rejection: TrustedPublicRejection, allowedMethod: 'POST' | 'GET' = 'POST'): Response {
  const error = toProductError(rejection);
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (error.retryAfterSeconds !== undefined) headers.set('Retry-After', String(error.retryAfterSeconds));
  if (rejection.kind === 'code' && rejection.code === 'METHOD_NOT_ALLOWED') headers.set('Allow', allowedMethod);
  return new Response(JSON.stringify(failure(error)), {
    status: rejection.kind === 'quota' ? 429 : copy[rejection.code][0], headers,
  });
}
