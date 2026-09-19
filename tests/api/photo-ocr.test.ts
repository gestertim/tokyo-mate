// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createResponse, createOpenAIClient } = vi.hoisted(() => ({
  createResponse: vi.fn(),
  createOpenAIClient: vi.fn(),
}));

vi.mock('../../api/_lib/openai.js', () => ({
  createOpenAIClient,
  getOpenAIModel: () => 'gpt-4o-mini',
}));

import { POST } from '../../api/photo-ocr';

function buildDataUrl(mimeType: string, byteLength: number): string {
  return `data:${mimeType};base64,${Buffer.alloc(byteLength, 1).toString('base64')}`;
}

function postPhotoOcr(body: unknown, contentType = 'application/json'): Promise<Response> {
  return POST(new Request('http://localhost/api/photo-ocr', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

describe('POST /api/photo-ocr contract', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    createResponse.mockReset();
    createOpenAIClient.mockReset();
    createOpenAIClient.mockReturnValue({ responses: { create: createResponse } });
  });

  it('rejects a malformed request (non-JSON content-type)', async () => {
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 10), regionVersion: 1 }, 'text/plain');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
    expect(createResponse).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON body', async () => {
    const response = await postPhotoOcr('{not valid json');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
  });

  it('rejects a missing regionVersion', async () => {
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 10) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
  });

  it('rejects a non-integer regionVersion', async () => {
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 10), regionVersion: 1.5 });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
  });

  it('rejects a regionVersion below 1', async () => {
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 10), regionVersion: 0 });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
  });

  it('rejects unsupported MIME types', async () => {
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/gif', 10), regionVersion: 1 });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
    expect(createResponse).not.toHaveBeenCalled();
  });

  it('rejects a malformed data URL', async () => {
    const response = await postPhotoOcr({ imageDataUrl: 'not-a-data-url', regionVersion: 1 });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
  });

  it('rejects images over the 10MB decoded size cap', async () => {
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 10 * 1024 * 1024 + 1), regionVersion: 1 });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
    expect(createResponse).not.toHaveBeenCalled();
  });

  it('accepts image/jpeg, image/png and image/webp within the size cap', async () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
      createResponse.mockResolvedValueOnce({ output_text: JSON.stringify({ reliableTextFound: false }) });
      const response = await postPhotoOcr({ imageDataUrl: buildDataUrl(mimeType, 1024), regionVersion: 1 });
      expect(response.status, mimeType).toBe(200);
    }
  });

  it('returns reliableTextFound:true with sourceText and the echoed regionVersion', async () => {
    createResponse.mockResolvedValueOnce({ output_text: JSON.stringify({ reliableTextFound: true, sourceText: '牛丼並盛 490円' }) });
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 1024), regionVersion: 3 });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { reliableTextFound: true, sourceText: '牛丼並盛 490円', regionVersion: 3 },
    });
  });

  it('returns reliableTextFound:false without a sourceText field', async () => {
    createResponse.mockResolvedValueOnce({ output_text: JSON.stringify({ reliableTextFound: false }) });
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 1024), regionVersion: 5 });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ success: true, data: { reliableTextFound: false, regionVersion: 5 } });
    expect(payload.data).not.toHaveProperty('sourceText');
  });

  it('sanitizes a provider failure into a generalized ProductError without leaking the raw error', async () => {
    createResponse.mockRejectedValueOnce(new Error('OpenAI upstream 500: rate limit exceeded, request id abc123'));
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 1024), regionVersion: 1 });
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({ success: false, error: { code: 'AI_SERVICE_UNAVAILABLE' } });
    expect(JSON.stringify(payload)).not.toContain('rate limit');
    expect(JSON.stringify(payload)).not.toContain('abc123');
  });

  it('returns a generalized failure when the provider output cannot be parsed as valid OCR JSON', async () => {
    createResponse.mockResolvedValueOnce({ output_text: 'not json' });
    const response = await postPhotoOcr({ imageDataUrl: buildDataUrl('image/jpeg', 1024), regionVersion: 1 });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'AI_SERVICE_UNAVAILABLE' } });
  });

  it('does not call the provider when input validation fails', async () => {
    await postPhotoOcr({ imageDataUrl: 'not-a-data-url', regionVersion: 1 });
    expect(createResponse).not.toHaveBeenCalled();
  });
});
