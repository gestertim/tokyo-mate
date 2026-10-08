// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateIsolatedEnvironment } from '../../api/_lib/isolated-environment';
import { isolatedEnvironmentFixture } from '../fixtures/isolated-environment-fixture';

describe('D14 TEST_ONLY 隔離schema，不讀取環境或秘密', () => {
  it('有效合成設定可載入並複製，沒有正式預設', () => {
    const input = isolatedEnvironmentFixture(), result = validateIsolatedEnvironment(input);
    expect(result.namespace).toBe('{preview-local-fixture}');
    input.keyrings.rate.entries[0].key.fill(9);
    expect(result.keyrings.rate.entries[0].key[0]).toBe(4);
    expect(() => validateIsolatedEnvironment(undefined)).toThrow('TEST_ONLY_ENVIRONMENT_INVALID');
  });
  it.each(['scope', 'network', 'namespace', 'rest', 'oidc', 'adminSubjects', 'keyrings',
    'epochFloor', 'authority', 'registry', 'runner'])('缺少%s拒絕', (name) => {
    const input: Record<string, unknown> = { ...isolatedEnvironmentFixture() };
    delete input[name];
    expect(() => validateIsolatedEnvironment(input)).toThrow('TEST_ONLY_ENVIRONMENT_INVALID');
  });
  it.each([
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.rest.url = 'http://fixture-only.upstash.io'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.rest.url = 'https://fixture-only.upstash.io:5432'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.rest.token = ''; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.oidc.config.origin = 'http://fixture.invalid'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.oidc.config.callbackUrl += '?code=secret'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.oidc.config.callbackUrl = 'https://other.invalid/api/auth/callback'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.oidc.policy.maxTokenAgeSeconds = 0; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.oidc.policy.allowedAlgorithms = ['none']; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.oidc.policy.allowedAlgorithms = ['RS256', 'RS256']; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.oidc.config.stateLifetimeMs--; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.adminSubjects = []; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.adminSubjects = ['A'.repeat(129)]; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.adminSubjects.push(c.adminSubjects[0]); },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.namespace = 'tokyomate:{preview-test}'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.namespace = '{production}'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.namespace = `{preview-${'A'.repeat(57)}}`; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.epochFloor.namespace = '{preview-other}'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.epochFloor.highestGeneration++; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.epochFloor.evidenceDigest = ''; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.authority.epochs[c.authority.currentEpochId].scopeKeyVersion = 'missing'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.authority.revokedKids = [c.keyrings.capability.current]; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => {
      Object.assign(c.authority.epochs[c.authority.currentEpochId], {
        issueStartsAtMs: Number.MAX_SAFE_INTEGER - 2, issueExpiresAtMs: Number.MAX_SAFE_INTEGER - 1,
        validUntilMs: Number.MAX_SAFE_INTEGER,
      });
    },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.registry.bundle.bundleDigest = 'b'.repeat(64); },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.runner.namespace = '{preview-other}'; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.runner.totalCommands = 10001; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.runner.windowMs = 7200001; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.runner.metering.execute = NaN; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.runner.reserves.cleanup = 1; },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.runner.inventory.push('{preview-other}:users'); },
    (c: ReturnType<typeof isolatedEnvironmentFixture>) => { c.runner.maxBatches = 100; },
  ])('非法或矛盾設定拒絕 #%#，錯誤不帶原值', (mutate) => {
    const input = isolatedEnvironmentFixture(); mutate(input);
    expect(() => validateIsolatedEnvironment(input)).toThrow('TEST_ONLY_ENVIRONMENT_INVALID');
  });
  it.each(['capability', 'fingerprint', 'oauth_state', 'rate'] as const)('%s ring版本／current／key驗證', (family) => {
    const input = isolatedEnvironmentFixture();
    input.keyrings[family].current = 'missing';
    expect(() => validateIsolatedEnvironment(input)).toThrow();
    const ring = isolatedEnvironmentFixture(); ring.keyrings[family].entries[0].key = new Uint8Array(31);
    expect(() => validateIsolatedEnvironment(ring)).toThrow();
    const duplicate = isolatedEnvironmentFixture();
    duplicate.keyrings[family].entries.push(duplicate.keyrings[family].entries[0]);
    expect(() => validateIsolatedEnvironment(duplicate)).toThrow();
  });
  it('不同family共用key bytes拒絕，即使version不同', () => {
    const input = isolatedEnvironmentFixture();
    input.keyrings.rate.entries[0].key = Uint8Array.from(input.keyrings.oauth_state.entries[0].key);
    expect(() => validateIsolatedEnvironment(input)).toThrow();
  });
  it('額外設定與未知計量欄位拒絕', () => {
    expect(() => validateIsolatedEnvironment({ ...isolatedEnvironmentFixture(), productionFallback: true })).toThrow();
    expect(() => validateIsolatedEnvironment({ ...isolatedEnvironmentFixture(), network: 'external' })).toThrow();
    expect(() => validateIsolatedEnvironment({ ...isolatedEnvironmentFixture(), scope: 'PRODUCTION' })).toThrow();
    const input = isolatedEnvironmentFixture();
    Object.assign(input.runner.metering, { evalCountsAsOne: true });
    expect(() => validateIsolatedEnvironment(input)).toThrow();
  });
  it('已批准command／time上限等值可用，總預留扣除後才允許batch', () => {
    const input = isolatedEnvironmentFixture();
    input.runner.totalCommands = 10000; input.runner.windowMs = 7200000;
    expect(validateIsolatedEnvironment(input).runner.totalCommands).toBe(10000);
    input.runner.totalCommands = 470;
    expect(() => validateIsolatedEnvironment(input)).toThrow();
    input.runner.totalCommands = 670;
    expect(validateIsolatedEnvironment(input).runner.maxBatches).toBe(2);
  });
});
