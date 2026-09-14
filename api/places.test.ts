import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './places';

async function postPlaces(body: unknown) {
  return POST(new Request('http://localhost/api/places', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/places', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GOOGLE_PLACES_API_KEY = 'test-google-places-key';
  });

  describe('manual mode (Text Search)', () => {
    it('accepts manual area requests and returns mapped place results', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'place-1',
              displayName: { text: '一蘭 新宿中央東口店' },
              types: ['restaurant', 'food'],
              formattedAddress: '東京都新宿區新宿3-34-11',
              location: { latitude: 35.6901, longitude: 139.7020 },
              businessStatus: 'OPERATIONAL',
              editorialSummary: { text: '知名豚骨拉麵，適合午餐與晚餐。' },
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const response = await postPlaces({
        location: { type: 'manual', manualArea: '新宿' },
        category: 'food',
        query: '拉麵',
      });

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.data.places[0]).toMatchObject({
        name: '一蘭 新宿中央東口店',
        category: '拉麵',
        openNowStatus: 'open',
      });

      expect(fetchMock.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places:searchText');
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.languageCode).toBe('zh-TW');
    });

    it('keeps manualArea as the anchor of textQuery and does not let query override it', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });
      vi.stubGlobal('fetch', fetchMock);

      await postPlaces({
        location: { type: 'manual', manualArea: '新宿' },
        category: 'attraction',
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.textQuery).toBe('新宿 景點');
    });

    it('appends free-text query after manualArea instead of replacing it', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });
      vi.stubGlobal('fetch', fetchMock);

      await postPlaces({
        location: { type: 'manual', manualArea: '新宿' },
        category: 'food',
        query: '拉麵',
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.textQuery).toBe('新宿 拉麵');
      expect(requestBody.textQuery.startsWith('新宿')).toBe(true);
    });

    it('requests zh-TW localization and JP region for manual text search', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });
      vi.stubGlobal('fetch', fetchMock);

      await postPlaces({ location: { type: 'manual', manualArea: '淺草' }, category: 'all' });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.languageCode).toBe('zh-TW');
      expect(requestBody.regionCode).toBe('JP');
    });

    it('does not produce a distance value when searching by manual area', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'place-1',
              displayName: { text: '淺草寺' },
              types: ['tourist_attraction'],
              formattedAddress: '東京都台東區淺草2-3-1',
              location: { latitude: 35.7148, longitude: 139.7967 },
              businessStatus: 'OPERATIONAL',
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const response = await postPlaces({ location: { type: 'manual', manualArea: '淺草' }, category: 'attraction' });
      const payload = await response.json();
      expect(payload.data.places[0].distanceMeter).toBeUndefined();
    });
  });

  describe('coordinates mode (Nearby Search)', () => {
    it('calls Nearby Search with a hard geographic restriction around the provided coordinates', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });
      vi.stubGlobal('fetch', fetchMock);

      await postPlaces({
        location: { type: 'coordinates', coordinates: { latitude: 35.6895, longitude: 139.6917 } },
        category: 'all',
      });

      expect(fetchMock.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places:searchNearby');
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.locationRestriction.circle.center).toEqual({ latitude: 35.6895, longitude: 139.6917 });
      expect(requestBody.locationRestriction.circle.radius).toBeGreaterThan(0);
      expect(requestBody.locationBias).toBeUndefined();
    });

    it('requests zh-TW localization for coordinates-based searches too', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ places: [] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await postPlaces({
        location: { type: 'coordinates', coordinates: { latitude: 35.6895, longitude: 139.6917 } },
        category: 'all',
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.languageCode).toBe('zh-TW');
    });

    it('maps category to the approved Places API includedTypes vocabulary', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });
      vi.stubGlobal('fetch', fetchMock);

      await postPlaces({
        location: { type: 'coordinates', coordinates: { latitude: 35.6895, longitude: 139.6917 } },
        category: 'food',
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.includedTypes).toEqual(expect.arrayContaining(['restaurant']));
    });

    it('omits includedTypes for the "all" category', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });
      vi.stubGlobal('fetch', fetchMock);

      await postPlaces({
        location: { type: 'coordinates', coordinates: { latitude: 35.6895, longitude: 139.6917 } },
        category: 'all',
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody.includedTypes).toBeUndefined();
    });

    it('computes distanceMeter from the provided coordinates using haversine distance', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'place-1',
              displayName: { text: '附近店家' },
              types: ['restaurant'],
              formattedAddress: '東京都',
              location: { latitude: 35.6901, longitude: 139.7020 },
              businessStatus: 'OPERATIONAL',
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const response = await postPlaces({
        location: { type: 'coordinates', coordinates: { latitude: 35.6895, longitude: 139.6917 } },
        category: 'food',
      });
      const payload = await response.json();
      expect(typeof payload.data.places[0].distanceMeter).toBe('number');
      expect(payload.data.places[0].distanceMeter).toBeGreaterThan(0);
    });
  });

  it('rejects invalid location input with friendly validation error', async () => {
    const response = await postPlaces({ location: { type: 'coordinates' }, category: 'food' });
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  it('returns a friendly zh-TW recovery message when the provider request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postPlaces({ location: { type: 'manual', manualArea: '新宿' } });
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('PLACES_SERVICE_UNAVAILABLE');
    expect(payload.error.userMessage).toContain('無法取得周邊景點與店家資料');
  });
});
