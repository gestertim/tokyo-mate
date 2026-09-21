import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadFavoriteIds, persistFavoriteIds } from './favorites';

const STORAGE_KEY = 'tokyo-mate:travel-japanese:favorites';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('favorites（Phase 6 US4，localStorage 容錯讀寫）', () => {
  it('正常情況下可讀回先前寫入的 favorite ids', () => {
    persistFavoriteIds(['tj-001', 'tj-002']);
    expect(loadFavoriteIds()).toEqual(['tj-001', 'tj-002']);
  });

  it('localStorage 不存在對應 key 時回傳 []', () => {
    expect(loadFavoriteIds()).toEqual([]);
  });

  it('JSON.parse 失敗時安全回傳 [] 且不拋出例外', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => loadFavoriteIds()).not.toThrow();
    expect(loadFavoriteIds()).toEqual([]);
  });

  it('內容型別不符（非 string[]）時安全回傳 []', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(loadFavoriteIds()).toEqual([]);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadFavoriteIds()).toEqual([]);
  });

  it('persistFavoriteIds 寫入失敗時不拋出例外', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => persistFavoriteIds(['tj-001'])).not.toThrow();
  });
});
