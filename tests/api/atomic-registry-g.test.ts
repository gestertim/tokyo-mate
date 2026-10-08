import { describe, expect, it, vi } from 'vitest';
import { createRegistryBundle, registryDecision } from '../../api/_lib/cost-registry';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { createQuotaEngine } from '../../api/_lib/quota-engine';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';

const at = '2026-10-06T02:00:00.000Z';
function setup(day = 10_000, week = 10_000, storeTimeoutMs = 1000) {
  let time = new Date(at);
  let id = 0;
  const store = new InMemorySharedStoreMock(() => time);
  const table = structuredClone(FIXTURE_ALL_LIVE);
  const entries = PROTECTED_ENDPOINTS.map((endpoint) => fixtureRegistryEntry(endpoint, table));
  store.publishRegistry(createRegistryBundle(1, table, entries));
  store.seed({ identitySubject: 'user', status: 'approved', tier: 'tier1', expiresAt: null });
  const registry = { snapshot: () => store.registrySnapshot(),
    resolve: async () => { throw new Error('不得逐端點重新 resolve'); } };
  const engine = createQuotaEngine({
    store, costRegistry: registry, fingerprintKey: FIXTURE_FINGERPRINT_KEY,
    now: () => time, newId: () => `r-${++id}`, leaseMs: 60_000,
    storeTimeoutMs,
    tierLimits: { tier1: { dayLimitMicroUsd: day, weekBaseLimitMicroUsd: week },
      tier2: { dayLimitMicroUsd: day, weekBaseLimitMicroUsd: week } },
  });
  const request = (key = 'one') => ({ identitySubject: 'user', endpoint: 'assistant' as const,
    idempotencyKey: key, content: '僅限本機 fixture' });
  return { store, table, entries, engine, request, setTime: (iso: string) => { time = new Date(iso); } };
}

describe('T143–T145 原子 registry／G（僅 memory mock）', () => {
  it.each([[8035, 10000, 'day'], [10000, 8035, 'week'], [8035, 8035, 'day']] as const)(
    'R_e ≤ remaining < G：day=%s week=%s 無 grant', async (day, week, window) => {
      const c = setup(day, week);
      const call = vi.spyOn(c.store, 'reserve');
      expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({
        status: 429, denialClass: 'below_floor', deniedWindow: window,
        registryDecision: { floorMicroUsd: 8036 },
      });
      expect(call).toHaveBeenCalledTimes(1);
      expect(await c.store.readUsage('user', '2026-10-06', '2026-W41')).toEqual({
        day: { usedMicroUsd: 0, reservedMicroUsd: 0 }, week: { usedMicroUsd: 0, reservedMicroUsd: 0 },
      });
    });

  it('remaining = G，R_e < G 只扣 R_e；下一筆重判 below_floor', async () => {
    const c = setup(8036, 8036);
    const first = await c.engine.reserve(c.request(), { inputTokens: 0 });
    expect(first).toMatchObject({ ok: true, reservation: { estimatedCostUpperBoundUsdMicro: 2400 },
      snapshot: { day: { remainingEstimatedUsdMicro: 5636 } } });
    expect(await c.engine.reserve(c.request('two'), { inputTokens: 0 })).toMatchObject({
      status: 429, denialClass: 'below_floor',
    });
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ code: 'DUPLICATE_REQUEST' });
  });

  it('兩窗口剛好 R_e 皆可通過相應比較', async () => {
    const c = setup(9630, 9630);
    expect(await c.engine.reserve(c.request())).toMatchObject({ ok: true,
      snapshot: { day: { remainingEstimatedUsdMicro: 0 }, week: { remainingEstimatedUsdMicro: 0 } } });
  });

  it.each([[9629, 10000, 'day'], [10000, 9629, 'week'], [9629, 9629, 'day']] as const)(
    'remaining = R_e−1：%s/%s 分類 request，不誤判 all', async (day, week, window) => {
      const c = setup(day, week);
      expect(await c.engine.reserve(c.request())).toMatchObject({
        status: 429, denialClass: 'request_insufficient', deniedWindow: window,
      });
    });

  it.each(['topup-first', 'reserve-first'] as const)('週追加排序 %s', async (order) => {
    const c = setup(10000, 8035);
    const add = () => c.engine.addWeeklyTopUp({ identitySubject: 'user', amountMicroUsd: 1,
      idempotencyKey: 'topup', adminSubject: 'admin', reasonCode: 'FIXTURE' });
    if (order === 'topup-first') {
      expect(await add()).toMatchObject({ ok: true });
      expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ ok: true });
    } else {
      expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 429 });
      expect(await add()).toMatchObject({ ok: true });
      expect(await c.engine.reserve(c.request('next'), { inputTokens: 0 })).toMatchObject({ ok: true });
    }
  });

  it.each(['revoke-first', 'reserve-first'] as const)('週撤回排序 %s', async (order) => {
    const c = setup(10000, 8035);
    const added = await c.engine.addWeeklyTopUp({ identitySubject: 'user', amountMicroUsd: 1,
      idempotencyKey: 'topup', adminSubject: 'admin', reasonCode: 'FIXTURE' });
    if (!added.ok) throw new Error('fixture 追加失敗');
    const revoke = () => c.engine.revokeWeeklyTopUp({ identitySubject: 'user',
      topUpId: added.topUp.topUpId, adminSubject: 'admin' });
    if (order === 'revoke-first') {
      await revoke();
      expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 429 });
    } else {
      const r = await c.engine.reserve(c.request(), { inputTokens: 0 });
      expect(r).toMatchObject({ ok: true });
      await revoke();
      expect(await c.engine.reserve(c.request('next'), { inputTokens: 0 })).toMatchObject({ status: 429 });
    }
  });

  it.each(['revision', 'reprice', 'disable', 'non-target-block', 'target-block'] as const)(
    'barrier：%s 先成立 → 舊快照 503，無預留', async (change) => {
      const c = setup();
      const original = c.store.reserve.bind(c.store);
      vi.spyOn(c.store, 'reserve').mockImplementation(async (command) => {
        if (change.endsWith('block')) {
          const target = change === 'target-block' ? 'assistant' : 'photo-translate';
          c.store.blockParameters(c.entries.find((entry) => entry.endpoint === target)!.approval.parametersDigest);
        } else {
          const table = structuredClone(c.table);
          if (change === 'disable') table.endpoints['photo-translate'].live = false;
          if (change === 'reprice') {
            table.version = `${table.version}-REPRICE`;
            const pricing = table.endpoints.assistant.pricing;
            if (pricing?.kind !== 'tokens') throw new Error('fixture 缺少 tokens 價格');
            pricing.inputMicroUsdPerMTok += 1;
          }
          c.store.publishRegistry(createRegistryBundle(2, table,
            PROTECTED_ENDPOINTS.map((endpoint) => fixtureRegistryEntry(endpoint, table))));
        }
        return original(command);
      });
      expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 503 });
      expect(c.store.dumpState()).not.toContain('"reservationId"');
    });

  it('reserve 先成立 → 發布不追溯取消 grant，原窗口仍可结算', async () => {
    const c = setup();
    const first = await c.engine.reserve(c.request(), { inputTokens: 0 });
    if (!first.ok) throw new Error('fixture 首次預留失敗');
    c.store.publishRegistry(createRegistryBundle(2, c.table, c.entries));
    expect(await c.engine.settle({ identitySubject: 'user', reservationId: first.reservation.reservationId,
      outcome: { kind: 'explicit_unbilled_failure' } })).toMatchObject({ settlementStatus: 'accounted' });
  });

  it.each(['reprice', 'disable', 'non-target-block', 'target-block'] as const)(
    'reserve 先成立 → %s 不取消既有 grant／原窗口結算，新操作重新查驗', async (change) => {
      const c = setup();
      const first = await c.engine.reserve(c.request(), { inputTokens: 0 });
      if (!first.ok) throw new Error('fixture 首次預留失敗');
      if (change.endsWith('block')) {
        const target = change === 'target-block' ? 'assistant' : 'photo-translate';
        c.store.blockParameters(c.entries.find((entry) => entry.endpoint === target)!.approval.parametersDigest);
      } else {
        const table = structuredClone(c.table);
        if (change === 'disable') table.endpoints['photo-translate'].live = false;
        else {
          table.version = `${table.version}-REPRICE`;
          const pricing = table.endpoints.assistant.pricing;
          if (pricing?.kind !== 'tokens') throw new Error('fixture 缺少 tokens 價格');
          pricing.inputMicroUsdPerMTok += 1;
        }
        c.store.publishRegistry(createRegistryBundle(2, table,
          PROTECTED_ENDPOINTS.map((endpoint) => fixtureRegistryEntry(endpoint, table))));
      }
      expect(first.reservation.registryDecision?.registryRevision).toBe(1);
      expect(await c.engine.settle({ identitySubject: 'user', reservationId: first.reservation.reservationId,
        outcome: { kind: 'explicit_unbilled_failure' } })).toMatchObject({ settlementStatus: 'accounted' });
      const next = await c.engine.reserve(c.request('next'), { inputTokens: 0 });
      expect(next).toMatchObject(change === 'target-block' ? { status: 503 } : { ok: true });
    });

  it.each(['revoke-first', 'reserve-first'] as const)('資格撤銷與 reserve 排序 %s', async (order) => {
    const c = setup();
    const revoke = () => c.store.setEligibility({ identitySubject: 'user', status: 'revoked', tier: 'tier1',
      expiresAt: null, nowIso: at });
    if (order === 'revoke-first') {
      await revoke();
      expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 403 });
      expect(c.store.dumpState()).not.toContain('"reservationId"');
    } else {
      const first = await c.engine.reserve(c.request(), { inputTokens: 0 });
      if (!first.ok) throw new Error('fixture 首次預留失敗');
      await revoke();
      expect(await c.engine.reserve(c.request('next'), { inputTokens: 0 })).toMatchObject({ status: 403 });
      expect(await c.engine.settle({ identitySubject: 'user', reservationId: first.reservation.reservationId,
        outcome: { kind: 'explicit_unbilled_failure' } })).toMatchObject({ settlementStatus: 'accounted' });
    }
  });

  it('同成本參數封鎖不能以新 revision 解封；非目標封鎖提高 G', async () => {
    const c = setup(8500, 8500);
    c.store.blockParameters(c.entries.find((e) => e.endpoint === 'photo-translate')!.approval.parametersDigest);
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({
      status: 429, registryDecision: { floorMicroUsd: 9630 }, denialClass: 'below_floor',
    });
    c.store.publishRegistry(createRegistryBundle(3, c.table, c.entries.map((e) => ({
      ...e, blocked: e.endpoint === 'photo-translate',
    }))));
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 429 });
  });

  it.each(['expiry', 'window', 'week', 'clock'] as const)('原子時間 %s 不沿用 command', async (change) => {
    const c = setup();
    const original = c.store.reserve.bind(c.store);
    vi.spyOn(c.store, 'reserve').mockImplementation(async (command) => {
      c.setTime(change === 'expiry' ? c.table.expiresAt :
        change === 'window' ? '2026-10-06T16:00:00.000Z' :
          change === 'week' ? '2026-10-11T16:00:00.000Z' : '2026-10-06T01:59:59.000Z');
      return original(command);
    });
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 503 });
  });

  it('當下資格撤銷優先於舊 revision／duplicate', async () => {
    const c = setup();
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ ok: true });
    await c.store.setEligibility({ identitySubject: 'user', status: 'revoked', tier: 'tier1',
      expiresAt: null, nowIso: at });
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 403 });
  });

  it.each(['floor', 'revision', 'digest', 'members', 'time'] as const)(
    '錯誤 %s evidence → 503，不退款或重授權', async (field) => {
    const c = setup();
    const original = c.store.reserve.bind(c.store);
    vi.spyOn(c.store, 'reserve').mockImplementation(async (command) => {
      const r = await original(command);
      if (r.status === 'reserved' && r.registryDecision) {
        const evidence = r.registryDecision;
        if (field === 'floor') evidence.floorMicroUsd = 1;
        if (field === 'revision') evidence.registryRevision += 1;
        if (field === 'digest') evidence.bundleDigest = '0'.repeat(64);
        if (field === 'members') evidence.liveEndpoints = evidence.liveEndpoints.slice(1);
        if (field === 'time') evidence.decisionAt = '2026-10-06T02:00:01.000Z';
      }
      return r;
    });
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 503 });
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ code: 'DUPLICATE_REQUEST' });
  });

  it('已原子成立但回覆 timeout：保留預留、不退款、不刷新重試或再發 grant', async () => {
    const c = setup(10000, 10000, 20);
    const original = c.store.reserve.bind(c.store);
    let finish: () => void = () => { throw new Error('fixture 尚未執行原子預留'); };
    const reserve = vi.spyOn(c.store, 'reserve').mockImplementation(async (command) => {
      const result = await original(command);
      await new Promise<void>((resolve) => { finish = resolve; });
      return result;
    });
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ status: 503 });
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(await c.store.readUsage('user', '2026-10-06', '2026-W41')).toEqual({
      day: { usedMicroUsd: 0, reservedMicroUsd: 2400 }, week: { usedMicroUsd: 0, reservedMicroUsd: 2400 },
    });
    finish();
    reserve.mockRestore();
    expect(await c.engine.reserve(c.request(), { inputTokens: 0 })).toMatchObject({ code: 'DUPLICATE_REQUEST' });
  });

  it('不允許 ABA revision 或缺少完整成員', () => {
    const c = setup();
    expect(() => c.store.publishRegistry(createRegistryBundle(1, c.table, c.entries))).toThrow();
    expect(() => registryDecision(createRegistryBundle(2, c.table, c.entries.slice(1)),
      new Date(at), { versions: new Set(), parameters: new Set() })).toThrow();
  });
});
