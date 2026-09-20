import { describe, expect, it } from 'vitest';
import { isMapEligible, isNavigationEligible } from './mapEligibility';
import type { PlaceResult } from '../../types/place';

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

describe('mapEligibility', () => {
  it('可靠座標時 isMapEligible / isNavigationEligible 回傳 true', () => {
    const target = place();
    expect(isMapEligible(target)).toBe(true);
    expect(isNavigationEligible(target)).toBe(true);
  });

  it('座標缺失時回傳 false', () => {
    const target = place({ location: undefined as unknown as PlaceResult['location'] });
    expect(isMapEligible(target)).toBe(false);
    expect(isNavigationEligible(target)).toBe(false);
  });

  it('座標恰為 (0, 0) fallback 時回傳 false', () => {
    const target = place({ location: { latitude: 0, longitude: 0 } });
    expect(isMapEligible(target)).toBe(false);
    expect(isNavigationEligible(target)).toBe(false);
  });

  it('座標為非有限數值（NaN / Infinity）時回傳 false', () => {
    const nanPlace = place({ location: { latitude: Number.NaN, longitude: 139.6503 } });
    const infinityPlace = place({ location: { latitude: 35.6762, longitude: Number.POSITIVE_INFINITY } });
    expect(isMapEligible(nanPlace)).toBe(false);
    expect(isNavigationEligible(nanPlace)).toBe(false);
    expect(isMapEligible(infinityPlace)).toBe(false);
    expect(isNavigationEligible(infinityPlace)).toBe(false);
  });
});
