import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGoogleMapsHandoffUrl, openNavigationHandoff } from './navigation';
import type { PlaceResult } from '../../types/place';

function place(overrides: Partial<PlaceResult> = {}): PlaceResult {
  return {
    id: 'place-1',
    name: '淺草寺',
    category: 'attraction',
    address: '東京都台東区浅草2丁目3-1',
    location: { latitude: 35.7148, longitude: 139.7967 },
    ...overrides,
  };
}

describe('buildGoogleMapsHandoffUrl', () => {
  it('對合格 result 回傳正確 Google Maps HTTPS URL', () => {
    const url = buildGoogleMapsHandoffUrl(place());
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(url).toContain(encodeURIComponent('淺草寺'));
  });

  it('對不合格 result 回傳 undefined', () => {
    const url = buildGoogleMapsHandoffUrl(place({ location: { latitude: 0, longitude: 0 } }));
    expect(url).toBeUndefined();
  });
});

describe('openNavigationHandoff', () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    windowOpenSpy = vi.spyOn(window, 'open');
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

  it('合格時呼叫 window.open 並回傳 success: true', () => {
    windowOpenSpy.mockReturnValue({} as Window);
    const result = openNavigationHandoff(place());
    expect(windowOpenSpy).toHaveBeenCalledWith(expect.stringContaining('google.com/maps'), '_blank', 'noopener,noreferrer');
    expect(result).toEqual({ success: true });
  });

  it('不合格時回傳 success: false 且不呼叫 window.open', () => {
    const result = openNavigationHandoff(place({ location: { latitude: 0, longitude: 0 } }));
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false });
  });

  it('window.open 回傳 null 時回傳 success: false', () => {
    windowOpenSpy.mockReturnValue(null);
    const result = openNavigationHandoff(place());
    expect(result).toEqual({ success: false });
  });

  it('window.open 拋出例外時回傳 success: false 且不拋出未捕捉例外', () => {
    windowOpenSpy.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => openNavigationHandoff(place())).not.toThrow();
    expect(openNavigationHandoff(place())).toEqual({ success: false });
  });
});
