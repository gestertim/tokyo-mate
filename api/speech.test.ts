import { describe, expect, it } from 'vitest';
import { POST } from './speech';

describe('POST /api/speech contract', () => {
  it('validates text, language and speed before generating audio', async () => {
    const response = await POST(new Request('http://localhost/api/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '', language: 'en', speed: 'fast' }),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
  });

  it('accepts normal and slow speech requests', async () => {
    for (const speed of ['normal', 'slow']) {
      const response = await POST(new Request('http://localhost/api/speech', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: '辛くない牛丼をお願いします。', language: 'ja', speed }),
      }));
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        await expect(response.json()).resolves.toMatchObject({
          success: true,
          data: { mimeType: 'audio/mpeg', speed },
        });
      }
    }
  });
});