// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { estimateRegistryCost, costParametersDigest } from '../../api/_lib/cost-registry';
import { computeGlobalFloor } from '../../api/_lib/quota-threshold';
import { estimateMaxReservation } from '../../api/_lib/cost-estimators';
import { PRODUCTION_COST_PRICE_TABLE, PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { createProtectedPipelineFixture } from '../support/protected-pipeline-fixture';

describe('同次 pinned cost 與 G-B 隔離邊界', () => {
  it.each(['missing', 'unapproved', 'expired', 'unproven', 'inactive', 'blocked', 'wrong-version', 'missing-evidence', 'wrong-digest', 'empty', 'failure'])
    ('P09/P12 %s 統一503，不預留或洩漏 context', async (kind) => {
      const f = createProtectedPipelineFixture();
      const entry = f.pinned.entries.find((e) => e.endpoint === 'places')!;
      if (kind === 'missing') f.cost.resolve.mockResolvedValue(null);
      if (kind === 'unapproved') entry.approval.approved = false;
      if (kind === 'expired') f.clock.advance(Date.parse(f.pinned.table.expiresAt) - f.clock.now().getTime());
      if (kind === 'unproven') entry.approval.upperBoundProven = false;
      if (kind === 'inactive') entry.approval.activated = false;
      if (kind === 'blocked') {
        entry.blocked = true;
        f.pinned.blockEvidence.find((e) => e.endpoint === 'places')!.versionBlocked = true;
      }
      if (kind === 'wrong-version') entry.version = 'forged-version';
      if (kind === 'missing-evidence') f.pinned.blockEvidence.pop();
      if (kind === 'wrong-digest') f.pinned.blockEvidence[0].digest = 'forged-digest';
      if (kind === 'empty') for (const e of Object.values(f.pinned.table.endpoints)) e.live = false;
      if (kind === 'failure') f.cost.resolve.mockRejectedValue(new Error('private-secret'));
      const response = await f.execute();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        success: false, error: {
          code: 'PROTECTION_SERVICE_UNAVAILABLE', userTitle: '無法確認使用狀態',
          userMessage: '保護服務暫時無法確認使用狀態，付費功能先暫停。請稍後再試。',
          actionableStep: '你仍可查看公開內容，稍後再手動重試付費功能。',
        },
      });
      expect(f.spies.reserve).not.toHaveBeenCalled();
      expect(f.upstream.execute).not.toHaveBeenCalled();
    });
  it('P12 每個合法 Places 同次成本 R_e＝R_max,places≥G，不硬編碼門檻', async () => {
    for (const unit of [20_000, 40_000, 80_000]) {
      const f = createProtectedPipelineFixture();
      const pricing = f.pinned.table.endpoints.places.pricing;
      if (!pricing || pricing.kind !== 'request') throw new Error('fixture SKU 缺失');
      pricing.perRequestMicroUsd = unit;
      for (const entry of f.pinned.entries) {
        entry.table = structuredClone(f.pinned.table);
        entry.approval.parametersDigest = costParametersDigest(entry);
        const evidence = f.pinned.blockEvidence.find((e) => e.endpoint === entry.endpoint)!;
        evidence.digest = entry.approval.parametersDigest;
      }
      const registry = { resolve: async () => f.pinned.entries.find((e) => e.endpoint === 'places')! };
      const cost = await estimateRegistryCost(registry, 'places', {}, f.clock.now());
      const max = estimateMaxReservation('places', f.pinned.table);
      const floor = computeGlobalFloor(f.pinned.table);
      f.upstream.execute.mockResolvedValue({ kind: 'success', data: { places: [] }, settlementEstimateMicroUsd: unit });
      expect(max.ok && max.amountMicroUsd).toBe(cost.amountMicroUsd);
      expect(floor.ok && floor.floorMicroUsd).toBeLessThanOrEqual(cost.amountMicroUsd);
      expect((await f.execute()).status).toBe(200);
      expect(f.spies.reserve.mock.calls[0][0].amountMicroUsd).toBe(cost.amountMicroUsd);
    }
  });
  it.each([['day', 8_035, 'all'], ['day', 8_036, 'request'], ['day', 49_999, 'request'],
    ['week', 8_035, 'all'], ['week', 8_036, 'request'], ['week', 49_999, 'request']] as const)
    ('P10/P11/P12 %s 剩餘 %s scope %s', async (window, remaining, scope) => {
      const f = createProtectedPipelineFixture({ [window]: remaining });
      const response = await f.execute();
      expect({ status: response.status, audit: response.status === 429 ? [] : f.spies.audit.mock.calls }).toEqual({ status: 429, audit: [] });
      const error = (await response.json()).error;
      expect(error.quotaScope).toBe(scope);
      expect(error.code).toBe(window === 'day' ? 'DAILY_QUOTA_EXHAUSTED' : 'WEEKLY_QUOTA_EXHAUSTED');
      expect(f.upstream.execute).not.toHaveBeenCalled();
      expect(f.spies.readQuota).toHaveBeenCalledOnce();
    });
  it('P12 G=R_e 與 R_e 邊界可合法執行', async () => {
    const f = createProtectedPipelineFixture({ day: 50_000, week: 50_000 });
    for (const e of PROTECTED_ENDPOINTS) if (e !== 'places') f.pinned.table.endpoints[e].live = false;
    f.pinned.entries = f.pinned.entries.filter((e) => e.endpoint === 'places');
    f.pinned.entries[0].table = structuredClone(f.pinned.table);
    f.pinned.blockEvidence = f.pinned.blockEvidence.filter((e) => e.endpoint === 'places');
    expect((await f.execute()).status).toBe(200);
    expect(f.upstream.execute).toHaveBeenCalledOnce();
  });
  it('P12 便宜端點封鎖後重算 G；缺任一雙封鎖證據503', async () => {
    const f = createProtectedPipelineFixture({ day: 8_100 });
    const first = await f.execute();
    expect((await first.json()).error.quotaScope).toBe('request');
    for (const e of f.pinned.entries) {
      if (e.endpoint === 'places') continue;
      e.blocked = true;
      f.pinned.blockEvidence.find((b) => b.endpoint === e.endpoint)!.parametersBlocked = true;
    }
    const second = await f.execute();
    expect((await second.json()).error.quotaScope).toBe('all');
    expect(f.spies.reserve).toHaveBeenCalledTimes(2);
    expect(f.upstream.execute).not.toHaveBeenCalled();
  });
  it('production 六端點保持 live:false', () => {
    for (const endpoint of PROTECTED_ENDPOINTS) expect(PRODUCTION_COST_PRICE_TABLE.endpoints[endpoint].live).toBe(false);
  });
  it.each(['day', 'week'] as const)('P10 %s 實際耗盡，與 below_floor 不混文案', async (window) => {
    const f = createProtectedPipelineFixture({ [window]: 50_000 });
    f.upstream.execute.mockResolvedValue({ kind: 'success', data: { places: [] }, settlementEstimateMicroUsd: 50_000 });
    expect((await f.execute()).status).toBe(200);
    const response = await f.execute(f.request({ query: '下一次' }, 'next'));
    expect(response.status).toBe(429);
    const error = (await response.json()).error;
    expect(error.userTitle).toBe(window === 'day' ? '當日額度已滿' : '每週額度已滿');
    expect(error.quotaScope).toBe('all');
    expect(f.upstream.execute).toHaveBeenCalledOnce();
  });
  it.each(['same', 'cross'] as const)('P10 同類／跨類優先 %s 只用原子snapshot', async (kind) => {
    const f = createProtectedPipelineFixture({ day: 50_000, week: kind === 'same' ? 50_000 : 55_000 });
    f.upstream.execute.mockResolvedValue({ kind: 'success', data: { places: [] }, settlementEstimateMicroUsd: 50_000 });
    await f.execute();
    const response = await f.execute(f.request({ query: '下一次' }, 'next'));
    const error = (await response.json()).error;
    expect(error.code).toBe('DAILY_QUOTA_EXHAUSTED');
    expect(error.userTitle).toBe('當日額度已滿');
  });
  it.each(['explicit_unbilled_failure', 'success', 'uncertain'] as const)
    ('P12 預留占額後 %s 恢復／保留，再手動操作', async (kind) => {
      const f = createProtectedPipelineFixture({ day: 55_000 });
      let finish!: (value: Awaited<ReturnType<typeof f.upstream.execute>>) => void;
      f.upstream.execute.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
      const initial = f.execute();
      await vi.waitFor(() => expect(f.upstream.execute).toHaveBeenCalledOnce());
      const denied = await f.execute(f.request({ query: '第二次' }, 'next'));
      expect(denied.status).toBe(429);
      expect((await denied.json()).error.userTitle).toBe('今日剩餘額度不足預留門檻');
      finish(kind === 'success' ? { kind, data: { places: [] }, settlementEstimateMicroUsd: 1_000 } : { kind });
      await initial;
      expect((await f.execute(f.request({ query: '第二次' }, 'next'))).status).toBe(kind === 'uncertain' ? 429 : 200);
      expect(f.upstream.execute).toHaveBeenCalledTimes(kind === 'uncertain' ? 1 : 2);
    });
  it('P12 日重置／週追加重新判定，不把追加當日上限或恢復保證', async () => {
    const f = createProtectedPipelineFixture({ day: 50_000, week: 50_000 });
    f.upstream.execute.mockResolvedValue({ kind: 'success', data: { places: [] }, settlementEstimateMicroUsd: 50_000 });
    await f.execute();
    expect((await f.engine.addWeeklyTopUp({ identitySubject: 'fixture-subject', adminSubject: 'fixture-admin',
      idempotencyKey: 'topup', amountMicroUsd: 50_000, reasonCode: 'FIXTURE' })).ok).toBe(true);
    const denied = await f.execute(f.request({ query: '第二次' }, 'next'));
    expect((await denied.json()).error.code).toBe('DAILY_QUOTA_EXHAUSTED');
    f.clock.advance(86_400_000);
    expect((await f.execute(f.request({ query: '第二次' }, 'next'))).status).toBe(200);
    const low = createProtectedPipelineFixture({ week: 8_035 });
    await low.engine.addWeeklyTopUp({ identitySubject: 'fixture-subject', adminSubject: 'fixture-admin',
      idempotencyKey: 'small', amountMicroUsd: 1, reasonCode: 'FIXTURE' });
    const stillDenied = await low.execute();
    expect(stillDenied.status).toBe(429);
    expect((await stillDenied.json()).error.quotaScope).toBe('request');
    const dayLow = createProtectedPipelineFixture({ day: 8_035 });
    await dayLow.engine.addWeeklyTopUp({ identitySubject: 'fixture-subject', adminSubject: 'fixture-admin',
      idempotencyKey: 'large', amountMicroUsd: 1_000_000, reasonCode: 'FIXTURE' });
    expect((await (await dayLow.execute()).json()).error.quotaScope).toBe('all');
  });
  it('P15 read後撤回週追加，原子snapshot拒絕而非舊read授權', async () => {
    const f = createProtectedPipelineFixture({ week: 8_000 });
    const topup = await f.engine.addWeeklyTopUp({ identitySubject: 'fixture-subject', adminSubject: 'fixture-admin',
      idempotencyKey: 'topup', amountMicroUsd: 100_000, reasonCode: 'FIXTURE' });
    if (!topup.ok) throw new Error('fixture 追加失敗');
    const original = f.spies.reserve.getMockImplementation()!;
    f.spies.reserve.mockImplementationOnce(async (command) => {
      await f.engine.revokeWeeklyTopUp({ identitySubject: 'fixture-subject', adminSubject: 'fixture-admin', topUpId: topup.topUp.topUpId });
      return original.call(f.store, command);
    });
    const response = await f.execute();
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe('WEEKLY_QUOTA_EXHAUSTED');
    expect(f.upstream.execute).not.toHaveBeenCalled();
  });
  it('P09/P12 舊摘要封鎖不能只換版本；真正不同參數重新舉證才可放行', async () => {
    const f = createProtectedPipelineFixture();
    f.upstream.execute.mockResolvedValueOnce({ kind: 'success', data: { places: [] }, settlementEstimateMicroUsd: 50_001 });
    expect((await f.execute()).status).toBe(503);
    f.pinned.table.version = 'FIXTURE_REAPPROVED_v2';
    const refresh = () => {
      for (const entry of f.pinned.entries) {
        entry.version = f.pinned.table.version;
        entry.table = structuredClone(f.pinned.table);
        entry.approval.parametersDigest = costParametersDigest(entry);
        const evidence = f.pinned.blockEvidence.find((e) => e.endpoint === entry.endpoint)!;
        evidence.version = entry.version;
        evidence.digest = entry.approval.parametersDigest;
      }
    };
    refresh();
    expect((await f.execute(f.request({ query: '東京' }, 'v2'))).status).toBe(503);
    const pricing = f.pinned.table.endpoints.places.pricing;
    if (!pricing || pricing.kind !== 'request') throw new Error('fixture SKU 缺失');
    pricing.perRequestMicroUsd = 48_000;
    f.pinned.table.version = 'FIXTURE_REAPPROVED_v3';
    refresh();
    expect((await f.execute(f.request({ query: '東京' }, 'v3'))).status).toBe(200);
    expect(f.upstream.execute).toHaveBeenCalledTimes(2);
  });
});
