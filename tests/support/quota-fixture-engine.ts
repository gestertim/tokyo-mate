import { createQuotaEngine, type QuotaEngineOptions } from '../../api/_lib/quota-engine';
import type { CostModelRef, ProtectedEndpoint } from '../../api/_lib/cost-price-table';
import type { EstimateInputs } from '../../api/_lib/quota-estimate-inputs';
import type { RequestContent } from '../../api/_lib/quota-fingerprint';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';

interface FixtureReserveRequest {
  identitySubject: string;
  endpoint: ProtectedEndpoint;
  amountMicroUsd: number;
  idempotencyKey: string;
  costModel: CostModelRef;
  estimateInputs?: EstimateInputs;
  content: RequestContent;
}

// 保留歷史 M1 測試情境的呼叫形狀；成本與上限僅在測試 adapter 中注入，正式程式不得引用。
export function createFixtureQuotaEngine(options: QuotaEngineOptions) {
  const base = createQuotaEngine({ ...options, fingerprintKey: FIXTURE_FINGERPRINT_KEY });
  return {
    ...base,
    reserve: (fixture: FixtureReserveRequest) => {
      // 固定測試價表：每個 input/output token 為 1 µUSD、輸出上限 1。
      // 歷史指定金額僅轉為 inputTokens，正式 engine 仍必須經 registry 與估算器。
      const table = {
        ...FIXTURE_ALL_LIVE, ...fixture.costModel,
        endpoints: {
          ...FIXTURE_ALL_LIVE.endpoints,
          assistant: {
            live: true, modelAllowlist: ['FIXTURE_MODEL'],
            priceScale: { numerator: 1, denominator: 1 },
            pricing: {
              kind: 'tokens' as const, inputMicroUsdPerMTok: 1_000_000, outputMicroUsdPerMTok: 1_000_000,
              maxInputTokens: Number.MAX_SAFE_INTEGER - 1, maxOutputTokens: 1,
            },
          },
        },
      };
      const costRegistry = { resolve: async () => fixture.costModel ? fixtureRegistryEntry(fixture.endpoint, table) : null };
      const engine = createQuotaEngine({ ...options, fingerprintKey: FIXTURE_FINGERPRINT_KEY, costRegistry });
      return engine.reserve({
        identitySubject: fixture.identitySubject,
        endpoint: fixture.endpoint,
        idempotencyKey: fixture.idempotencyKey,
        content: fixture.content,
      }, fixture.estimateInputs ?? {
        inputTokens: typeof fixture.amountMicroUsd === 'number' && Number.isSafeInteger(fixture.amountMicroUsd) &&
          fixture.amountMicroUsd > 0 ? fixture.amountMicroUsd - 1 : NaN,
      });
    },
  };
}
