import { createSecretKey } from 'node:crypto';
import type { ProtectedEndpoint } from '../../api/_lib/cost-price-table';
import type { FingerprintKey, TrustedFingerprintCost } from '../../api/_lib/quota-fingerprint';
import type { EstimateBounds } from '../../api/_lib/quota-estimate-inputs';
import { FIXTURE_ALL_LIVE } from './cost-price-fixtures';

// 公開且可預測的測試材料，不得用於正式服務。
export const FIXTURE_FINGERPRINT_KEY: FingerprintKey = {
  version: 'TEST_KEY_v1',
  key: createSecretKey(Buffer.from('TEST_ONLY_NOT_A_PRODUCTION_KEY_01')),
};

export function fixtureTrustedCost(
  endpoint: ProtectedEndpoint = 'assistant',
  amountMicroUsd = 5_000,
): TrustedFingerprintCost {
  return {
    endpoint,
    amountMicroUsd,
    costModel: {
      version: FIXTURE_ALL_LIVE.version,
      effectiveFrom: FIXTURE_ALL_LIVE.effectiveFrom,
      expiresAt: FIXTURE_ALL_LIVE.expiresAt,
    },
    model: endpoint === 'places' ? null : 'FIXTURE_MODEL',
    billingTier: 'standard',
    attempts: 1,
    estimateInputs: {},
    estimateBounds: fixtureBounds(endpoint),
  };
}

function fixtureBounds(endpoint: ProtectedEndpoint): EstimateBounds {
  switch (endpoint) {
    case 'assistant': return { inputTokens: 100_000, maxOutputTokens: 10_000 };
    case 'photo-ocr':
    case 'photo-translate': return { inputTokens: 100_000, maxOutputTokens: 10_000, imageBytes: 4_200_000 };
    case 'transcribe': return { audioDataBytes: 1_920_000, billedMinutes: 1 };
    case 'places': return {};
    case 'speech': return { characterCount: 4_096, speed: 4 };
  }
}
