// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler as createAssistantHandler } from '../../api/assistant';
import { createHandler as createTranscribeHandler } from '../../api/transcribe';
import { createHandler as createPlacesHandler } from '../../api/places';
import { POST as speechPost } from '../../api/speech';
import { createHandler as createPhotoOcrHandler } from '../../api/photo-ocr';
import { createHandler as createPhotoTranslateHandler } from '../../api/photo-translate';
import type { PaidBoundaryOptions } from '../../api/_lib/paid-endpoint-boundary';
import { PRODUCTION_COST_PRICE_TABLE, PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { isRecord } from '../../api/_lib/http';
import { validatePaidJson } from '../../api/_lib/paid-input-validation';
import { buildPcmWav } from '../../api/_lib/audio-pcm';
import { TEST_ONLY_PAID_ENDPOINT_DESCRIPTORS } from '../fixtures/paid-endpoint-success-descriptors';
import { createPaidEndpointSuccessFixture } from '../support/paid-endpoint-success-fixture';
import type { ProtectedEndpoint } from '../../api/_lib/cost-price-table';

afterEach(() => vi.restoreAllMocks());

const pipelineEndpoints = PROTECTED_ENDPOINTS.filter((endpoint): endpoint is Exclude<ProtectedEndpoint, 'speech'> =>
  endpoint !== 'speech');
const routeFactories: Record<Exclude<ProtectedEndpoint, 'speech'>,
  (options: PaidBoundaryOptions) => (request: Request) => Promise<Response>> = {
  assistant: createAssistantHandler,
  transcribe: createTranscribeHandler,
  places: createPlacesHandler,
  'photo-ocr': createPhotoOcrHandler,
  'photo-translate': createPhotoTranslateHandler,
};

describe('TEST_ONLY 六端點成功描述與隔離 HTTP pipeline', () => {
  it.each(pipelineEndpoints)('%s route factory 在 method 拒絕時不讀 Session、不預留、不派送', async (endpoint) => {
    const fixture = createPaidEndpointSuccessFixture(endpoint);
    const handler = routeFactories[endpoint](fixture.handlerOptions);

    const response = await handler(new Request(`https://fixture.invalid/api/${endpoint}`));

    expect(response.status).toBe(405);
    expect(fixture.sessions.lookup).not.toHaveBeenCalled();
    expect(fixture.spies.reserve).not.toHaveBeenCalled();
    expect(fixture.spies.settle).not.toHaveBeenCalled();
    expect(fixture.upstream.execute).not.toHaveBeenCalled();
  });

  it.each(pipelineEndpoints)('%s route factory 依序驗證輸入、原子預留、mock upstream、結算及 HTTP response', async (endpoint) => {
    const fixture = createPaidEndpointSuccessFixture(endpoint);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('TEST_ONLY_NETWORK_BLOCKED'));

    const response = await routeFactories[endpoint](fixture.handlerOptions)(fixture.request());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ success: true, data: fixture.descriptor.response });
    expect(fixture.order).toEqual(['admission', 'session', 'rate', 'validate', 'cost', 'reserve', 'upstream', 'settle']);
    expect(fixture.spies.reserve).toHaveBeenCalledOnce();
    expect(fixture.spies.settle).toHaveBeenCalledOnce();
    expect(fixture.upstream.execute).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fixture.pinned.scope).toBe('TEST_ONLY');
    expect(fixture.store.dumpState()).not.toMatch(/TEST_ONLY_(?:ASSISTANT_INPUT|PLACE_QUERY|TRANSCRIPT|IMAGE|TRANSLATION_INPUT)/);
  });

  it.each(pipelineEndpoints)('%s 非法輸入在預留與 mock upstream 前拒絕', async (endpoint) => {
    const fixture = createPaidEndpointSuccessFixture(endpoint);
    let request: Request;
    if (endpoint === 'transcribe') {
      request = fixture.request(buildPcmWav(new Uint8Array([1])));
    } else {
      const body = structuredClone(fixture.descriptor.body);
      if (!isRecord(body)) throw new TypeError('TEST_ONLY_JSON_DESCRIPTOR_REQUIRED');
      if (endpoint === 'assistant') body.text = '';
      if (endpoint === 'places') body.location = { type: 'manual', manualArea: '字'.repeat(51) };
      if (endpoint === 'photo-ocr') body.imageDataUrl = 'data:image/png;base64,!!';
      if (endpoint === 'photo-translate') body.targetLanguage = 'en';
      request = fixture.request(body);
    }

    const response = await routeFactories[endpoint](fixture.handlerOptions)(request);

    expect(response.status).toBe(400);
    expect(fixture.spies.reserve).not.toHaveBeenCalled();
    expect(fixture.spies.settle).not.toHaveBeenCalled();
    expect(fixture.upstream.execute).not.toHaveBeenCalled();
    expect(fixture.cost.resolve).not.toHaveBeenCalled();
  });

  it('speech 僅驗證 TEST_ONLY mock descriptor；真實 HTTP handler 保持 fail closed', async () => {
    const descriptor = TEST_ONLY_PAID_ENDPOINT_DESCRIPTORS.speech;
    if (descriptor.mode !== 'mock_only') throw new Error('TEST_ONLY_SPEECH_DESCRIPTOR_REQUIRED');
    expect(validatePaidJson('speech', descriptor.body)).toBe(true);
    const mockBehavior = vi.fn(async () => descriptor.response);
    expect(await mockBehavior()).toEqual({
      audioUrl: 'data:audio/mpeg;base64,VEVTVF9PTkxZ',
      mimeType: 'audio/mpeg',
      speed: 'normal',
    });
    expect(mockBehavior).toHaveBeenCalledOnce();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('TEST_ONLY_NETWORK_BLOCKED'));
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await speechPost(new Request('https://fixture.invalid/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(descriptor.body),
    }));

    expect(response.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledOnce();
  });

  it('production 成本 registry 的六端點仍全部 live:false', () => {
    for (const endpoint of PROTECTED_ENDPOINTS) {
      expect(PRODUCTION_COST_PRICE_TABLE.endpoints[endpoint].live).toBe(false);
    }
  });
});
