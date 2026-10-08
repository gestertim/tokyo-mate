import { costParametersDigest, type CostRegistryEntry } from '../../api/_lib/cost-registry';
import { type CostPriceTable, type ProtectedEndpoint } from '../../api/_lib/cost-price-table';
import { FIXTURE_TRANSCRIBE_LIVE } from './cost-price-fixtures';

/** 核准／上界 references 全是示意資料，不是正式成本證據。 */
export function fixtureRegistryEntry(
  endpoint: ProtectedEndpoint = 'assistant',
  table: CostPriceTable = FIXTURE_TRANSCRIBE_LIVE,
): CostRegistryEntry {
  const pricing = table.endpoints[endpoint].pricing;
  const estimateBounds = pricing?.kind === 'tokens'
    ? { inputTokens: pricing.maxInputTokens, maxOutputTokens: pricing.maxOutputTokens,
        ...(endpoint.startsWith('photo-') ? { imageBytes: 4_200_000 } : {}) }
    : pricing?.kind === 'audio_minute'
      ? { audioDataBytes: pricing.maxAudioSeconds * 32_000, billedMinutes: Math.ceil(pricing.maxAudioSeconds / 60) }
      : endpoint === 'speech' ? { characterCount: 4_096, speed: 4 } : {};
  const entry: CostRegistryEntry = {
    endpoint, version: table.version, table: structuredClone(table),
    model: endpoint === 'places' ? null : table.endpoints[endpoint].modelAllowlist[0] ?? 'FIXTURE_MODEL',
    billingTier: 'standard', attempts: 1, estimateBounds,
    detailAllowlist: endpoint.startsWith('photo-') ? ['low', 'high', 'auto'] : [],
    blocked: false,
    approval: {
      approved: true, activated: true, upperBoundProven: true, singleAttemptVerified: true,
      priceSourceRef: 'FIXTURE_PRICE', approvalEvidenceRef: 'FIXTURE_APPROVAL',
      boundEvidenceRef: 'FIXTURE_BOUND', parametersDigest: '',
    },
  };
  entry.approval.parametersDigest = costParametersDigest(entry);
  return entry;
}
