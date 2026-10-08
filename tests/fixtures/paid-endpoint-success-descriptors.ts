// TEST_ONLY descriptor data. Cost, model, tier and output-cap values come only from cost-price-fixtures.ts.
import { buildPcmWav } from '../../api/_lib/audio-pcm';
import { FIXTURE_ALL_LIVE, FIXTURE_EXPECTED_R_MAX, FIXTURE_TRANSCRIBE_LIVE } from './cost-price-fixtures';
import type { CostPriceTable, ProtectedEndpoint } from '../../api/_lib/cost-price-table';

interface PipelineDescriptor {
  scope: 'TEST_ONLY';
  mode: 'pipeline';
  endpoint: Exclude<ProtectedEndpoint, 'speech'>;
  quotaTier: 'tier1';
  table: CostPriceTable;
  body: Record<string, unknown> | Uint8Array;
  response: unknown;
  settlementEstimateMicroUsd: number;
}

interface MockOnlySpeechDescriptor {
  scope: 'TEST_ONLY';
  mode: 'mock_only';
  endpoint: 'speech';
  quotaTier: 'tier1';
  body: Record<string, unknown>;
  response: {
    audioUrl: string;
    mimeType: 'audio/mpeg';
    speed: 'normal' | 'slow';
  };
}

export type PaidEndpointSuccessDescriptor = PipelineDescriptor | MockOnlySpeechDescriptor;

export const TEST_ONLY_QUOTA_LIMITS = {
  tier1: { dayLimitMicroUsd: 55_000, weekBaseLimitMicroUsd: 500_000 },
  tier2: { dayLimitMicroUsd: 100_000, weekBaseLimitMicroUsd: 1_000_000 },
};

export const TEST_ONLY_PAID_ENDPOINT_DESCRIPTORS: Record<ProtectedEndpoint, PaidEndpointSuccessDescriptor> = {
  assistant: {
    scope: 'TEST_ONLY',
    mode: 'pipeline',
    endpoint: 'assistant',
    quotaTier: 'tier1',
    table: FIXTURE_ALL_LIVE,
    body: { text: 'TEST_ONLY_ASSISTANT_INPUT', inputType: 'text', tone: 'default' },
    response: { conclusion: 'TEST_ONLY_ASSISTANT_OUTPUT', action: ['TEST_ONLY_ACTION'], caution: [] },
    settlementEstimateMicroUsd: FIXTURE_EXPECTED_R_MAX.assistant,
  },
  transcribe: {
    scope: 'TEST_ONLY',
    mode: 'pipeline',
    endpoint: 'transcribe',
    quotaTier: 'tier1',
    table: FIXTURE_TRANSCRIBE_LIVE,
    body: buildPcmWav(new Uint8Array(32)),
    response: { text: 'TEST_ONLY_TRANSCRIPT', detectedLanguage: 'ja' },
    settlementEstimateMicroUsd: FIXTURE_EXPECTED_R_MAX.transcribe,
  },
  places: {
    scope: 'TEST_ONLY',
    mode: 'pipeline',
    endpoint: 'places',
    quotaTier: 'tier1',
    table: FIXTURE_ALL_LIVE,
    body: {
      location: { type: 'manual', manualArea: 'TEST_ONLY_TOKYO' },
      category: 'food',
      query: 'TEST_ONLY_PLACE_QUERY',
    },
    response: { places: [{ id: 'TEST_ONLY_PLACE', name: 'TEST_ONLY_PLACE_NAME' }] },
    settlementEstimateMicroUsd: FIXTURE_EXPECTED_R_MAX.places,
  },
  speech: {
    scope: 'TEST_ONLY',
    mode: 'mock_only',
    endpoint: 'speech',
    quotaTier: 'tier1',
    body: { text: 'TEST_ONLY_SPEECH_INPUT', language: 'ja', speed: 'normal' },
    response: { audioUrl: 'data:audio/mpeg;base64,VEVTVF9PTkxZ', mimeType: 'audio/mpeg', speed: 'normal' },
  },
  'photo-ocr': {
    scope: 'TEST_ONLY',
    mode: 'pipeline',
    endpoint: 'photo-ocr',
    quotaTier: 'tier1',
    table: FIXTURE_ALL_LIVE,
    body: { imageDataUrl: `data:image/png;base64,${Buffer.from('TEST_ONLY_IMAGE').toString('base64')}`, regionVersion: 1 },
    response: { reliableTextFound: true, sourceText: 'TEST_ONLY_OCR_TEXT', regionVersion: 1 },
    settlementEstimateMicroUsd: FIXTURE_EXPECTED_R_MAX['photo-ocr'],
  },
  'photo-translate': {
    scope: 'TEST_ONLY',
    mode: 'pipeline',
    endpoint: 'photo-translate',
    quotaTier: 'tier1',
    table: FIXTURE_ALL_LIVE,
    body: { sourceText: 'TEST_ONLY_TRANSLATION_INPUT', targetLanguage: 'ja' },
    response: { sameLanguage: false, translatedText: 'TEST_ONLY_TRANSLATION_OUTPUT', targetLanguage: 'ja' },
    settlementEstimateMicroUsd: FIXTURE_EXPECTED_R_MAX['photo-translate'],
  },
};
