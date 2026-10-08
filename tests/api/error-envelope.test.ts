// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { errorResponse, toProductError } from '../../api/_lib/error-envelope';

const root = new URL('../../specs/005-api-protection-access-modes/', import.meta.url);
const rows = (file: string) => readFileSync(new URL(file, root), 'utf8').split(/\r?\n/)
  .filter((line) => /^\| (日耗盡|週耗盡|below_floor|request 不足)/.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim().replaceAll('`', '')));

describe('P22 A6 精確信封', () => {
  it('Spec／UX／contract 六列逐字一致，request 不承諾其他功能可用', () => {
    const table = rows('spec.md');
    expect(table).toHaveLength(6);
    expect(rows('ux-ui-design-handoff.md')).toEqual(table);
    expect(rows('contracts/error-and-quota-contract.md')).toEqual(table);
    for (const row of table.slice(4)) expect(row[4]).toBe(
      '今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。');
  });
  for (const [index, row] of rows('spec.md').entries()) {
    it(`P10/P11/P22 ${row[0]}`, async () => {
      const state = index < 2 ? 'exhausted' as const : index < 4 ? 'below_floor' as const : 'request_insufficient' as const;
      const rejection = { kind: 'quota' as const, state, window: index % 2 === 0 ? 'day' as const : 'week' as const };
      const response = errorResponse(rejection);
      expect(response.status).toBe(429);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ success: false, error: {
        code: row[1], quotaScope: row[2], userTitle: row[3], userMessage: row[4], actionableStep: row[5],
      } });
      expect(toProductError(rejection)).not.toHaveProperty('state');
    });
  }
  it('P07 可靠秒數才同時輸出 header／body', async () => {
    for (const seconds of [undefined, 0, -1, NaN, 1.5, 30]) {
      const response = errorResponse({ kind: 'code', code: 'RATE_LIMITED', retryAfterSeconds: seconds });
      const body = await response.json();
      if (seconds === 30) {
        expect(response.headers.get('retry-after')).toBe('30');
        expect(body.error.retryAfterSeconds).toBe(30);
      } else {
        expect(response.headers.has('retry-after')).toBe(false);
        expect(body.error).not.toHaveProperty('retryAfterSeconds');
      }
    }
  });
  it('P22 409／503 精確文案、未知原因不輸出、無 quotaScope', async () => {
    for (const [code, message] of [
      ['DUPLICATE_REQUEST', '此操作已送出，請查看目前狀態。'],
      ['IDEMPOTENCY_CONFLICT', '操作識別碼與原請求不一致，請重新確認操作。'],
      ['PROTECTION_SERVICE_UNAVAILABLE', '保護服務暫時無法確認使用狀態，付費功能先暫停。請稍後再試。'],
    ] as const) {
      const response = errorResponse({ kind: 'code', code });
      const { error } = await response.json();
      expect(error.userMessage).toBe(message);
      expect(Object.keys(error).sort()).toEqual(['actionableStep', 'code', 'userMessage', 'userTitle']);
      expect(response.status).toBe(code === 'PROTECTION_SERVICE_UNAVAILABLE' ? 503 : 409);
    }
  });
});
