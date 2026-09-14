import { describe, expect, it } from 'vitest';
import { isCacheableRequest } from '../service-worker';

describe('Early Platform Safety Gate', () => {
  it('排除所有 API request，不將 AI、語音、位置或即時 response 放入 cache', () => {
    for (const path of ['/api/assistant', '/api/transcribe', '/api/speech', '/api/places', '/api/live']) {
      expect(isCacheableRequest(new Request(`http://localhost:5173${path}`))).toBe(false);
    }
  });

  it('只允許 approved static asset 前綴進入 cache allowlist', () => {
    expect(isCacheableRequest(new Request('http://localhost:5173/assets/index.js'))).toBe(true);
    expect(isCacheableRequest(new Request('http://localhost:5173/src/data/tokyo/areas.json'))).toBe(true);
    expect(isCacheableRequest(new Request('http://localhost:5173/user-data.json'))).toBe(false);
  });
});