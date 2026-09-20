import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import L from 'leaflet';
import { NearbyMap } from './NearbyMap';
import type { PlaceResult } from '../../types/place';

vi.mock('leaflet', () => {
  const mapInstance = {
    setView: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
    fitBounds: vi.fn(),
  };
  mapInstance.setView.mockReturnValue(mapInstance);

  const tileLayerInstance = { on: vi.fn(), addTo: vi.fn() };

  const map = vi.fn(() => mapInstance);
  const tileLayer = vi.fn(() => tileLayerInstance);
  const marker = vi.fn(() => ({
    on: vi.fn(),
    addTo: vi.fn(),
    setLatLng: vi.fn(),
    setIcon: vi.fn(),
    setZIndexOffset: vi.fn(),
    remove: vi.fn(),
  }));
  const divIcon = vi.fn((options: unknown) => options);
  const latLngBounds = vi.fn((points: unknown) => points);

  return { default: { map, tileLayer, marker, divIcon, latLngBounds } };
});

function place(overrides: Partial<PlaceResult> = {}): PlaceResult {
  return {
    id: 'place-1',
    name: '測試地點',
    category: 'attraction',
    address: '東京都',
    location: { latitude: 35.6762, longitude: 139.6503 },
    ...overrides,
  };
}

describe('NearbyMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(L.map).mockReturnValue({
      setView: vi.fn().mockReturnThis(),
      on: vi.fn(),
      remove: vi.fn(),
      fitBounds: vi.fn(),
    } as unknown as ReturnType<typeof L.map>);
  });

  afterEach(() => {
    cleanup();
  });

  it('掛載時建立 Leaflet map 與 Geoapify tile layer（含 attribution）', () => {
    render(<NearbyMap places={[]} onSelectPlace={vi.fn()} />);

    expect(L.map).toHaveBeenCalledTimes(1);
    expect(L.tileLayer).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(L.tileLayer).mock.calls[0];
    expect(url).toContain('geoapify.com');
    expect((options as { attribution: string }).attribution).toContain('Geoapify');
  });

  it('places 變化時更新 marker 集合', () => {
    const { rerender } = render(<NearbyMap places={[place({ id: 'a' })]} onSelectPlace={vi.fn()} />);
    expect(L.marker).toHaveBeenCalledTimes(1);

    rerender(<NearbyMap places={[place({ id: 'a' }), place({ id: 'b' })]} onSelectPlace={vi.fn()} />);
    expect(L.marker).toHaveBeenCalledTimes(2);
  });

  it('初次取得非空 places 時呼叫 fitBounds', () => {
    render(<NearbyMap places={[place({ id: 'a' })]} onSelectPlace={vi.fn()} />);
    const mapInstance = vi.mocked(L.map).mock.results[0].value;
    expect(mapInstance.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('marker 點擊觸發 onSelectPlace(id)', () => {
    const onSelectPlace = vi.fn();
    render(<NearbyMap places={[place({ id: 'a' })]} onSelectPlace={onSelectPlace} />);
    const markerInstance = vi.mocked(L.marker).mock.results[0].value;
    const clickHandler = markerInstance.on.mock.calls.find((call: unknown[]) => call[0] === 'click')?.[1];
    clickHandler?.();
    expect(onSelectPlace).toHaveBeenCalledWith('a');
  });

  it('地圖初次建立失敗時呼叫一次 onMapUnavailable 且不拋出例外', () => {
    vi.mocked(L.map).mockImplementation(() => {
      throw new Error('init failed');
    });
    const onMapUnavailable = vi.fn();
    expect(() => render(<NearbyMap places={[]} onSelectPlace={vi.fn()} onMapUnavailable={onMapUnavailable} />)).not.toThrow();
    expect(onMapUnavailable).toHaveBeenCalledTimes(1);
  });

  it('地圖已建立後使用期間發生無法復原錯誤時呼叫一次 onMapUnavailable 且不拋出例外', () => {
    const onMapUnavailable = vi.fn();
    render(<NearbyMap places={[]} onSelectPlace={vi.fn()} onMapUnavailable={onMapUnavailable} />);
    const mapInstance = vi.mocked(L.map).mock.results[0].value;
    const errorHandler = mapInstance.on.mock.calls.find((call: unknown[]) => call[0] === 'error')?.[1];
    expect(() => errorHandler?.()).not.toThrow();
    expect(onMapUnavailable).toHaveBeenCalledTimes(1);
  });

  it('pan／moveend 事件不觸發 requestPlaces 或任何 /api/* fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    render(<NearbyMap places={[place()]} onSelectPlace={vi.fn()} />);
    const mapInstance = vi.mocked(L.map).mock.results[0].value;
    mapInstance.on.mock.calls
      .filter((call: unknown[]) => call[0] === 'moveend')
      .forEach((call: unknown[]) => (call[1] as () => void)());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('zoom／zoomend 事件不觸發 requestPlaces 或任何 /api/* fetch，且 marker 集合維持不變', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    render(<NearbyMap places={[place()]} onSelectPlace={vi.fn()} />);
    const markerCallsBefore = vi.mocked(L.marker).mock.calls.length;
    const mapInstance = vi.mocked(L.map).mock.results[0].value;
    mapInstance.on.mock.calls
      .filter((call: unknown[]) => call[0] === 'zoomend')
      .forEach((call: unknown[]) => (call[1] as () => void)());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(vi.mocked(L.marker).mock.calls.length).toBe(markerCallsBefore);
    fetchSpy.mockRestore();
  });
});
