import { describe, expect, it } from 'vitest';
import {
  getAllPhrases,
  getCategoryPlacementCounts,
  getPhraseById,
  getPhrasesByCategory,
  getUniquePhraseCount,
  searchPhrases,
  TRAVEL_JAPANESE_CATEGORIES,
  validateTravelJapaneseDataset,
} from './travelJapanese';

describe('travelJapanese dataset（Phase 2 Foundational, FR-001~FR-007/FR-025/FR-034）', () => {
  it('提供 7 個正式旅行情境', () => {
    expect(TRAVEL_JAPANESE_CATEGORIES).toEqual([
      'airport', 'hotel', 'restaurant', 'shopping', 'transportation', 'emergency', 'daily',
    ]);
  });

  it('unique phrase 總數 >= 100（FR-034）', () => {
    expect(getUniquePhraseCount()).toBeGreaterThanOrEqual(100);
    expect(getAllPhrases().length).toBe(getUniquePhraseCount());
  });

  it('category placements 總數 >= 140，每個 category >= 20（FR-002/FR-003）', () => {
    const counts = getCategoryPlacementCounts();
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    expect(total).toBeGreaterThanOrEqual(140);
    for (const category of TRAVEL_JAPANESE_CATEGORIES) {
      expect(counts[category]).toBeGreaterThanOrEqual(20);
    }
  });

  it('每個 phrase 的 id 全部唯一', () => {
    const ids = getAllPhrases().map((phrase) => phrase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每個 phrase 的 japanese / traditionalChinese 皆非空字串', () => {
    for (const phrase of getAllPhrases()) {
      expect(phrase.japanese.trim().length).toBeGreaterThan(0);
      expect(phrase.traditionalChinese.trim().length).toBeGreaterThan(0);
    }
  });

  it('categories 僅引用 7 個正式情境值（無非法值）', () => {
    for (const phrase of getAllPhrases()) {
      expect(phrase.categories.length).toBeGreaterThanOrEqual(1);
      for (const category of phrase.categories) {
        expect(TRAVEL_JAPANESE_CATEGORIES).toContain(category);
      }
    }
  });

  it('不存在兩筆不同 id 但內容完全相同的資料（重複防護）', () => {
    const seen = new Set<string>();
    for (const phrase of getAllPhrases()) {
      const key = `${phrase.japanese}\u0000${phrase.traditionalChinese}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('emergency 情境涵蓋 FR-025 六類 safety-critical 句子，且排列於清單前段', () => {
    const emergencyPhrases = getPhrasesByCategory('emergency');
    expect(emergencyPhrases.length).toBeGreaterThanOrEqual(20);

    const safetyCriticalTexts = emergencyPhrases.filter((phrase) => phrase.safetyCritical).map((phrase) => phrase.japanese);
    expect(safetyCriticalTexts.some((text) => text.includes('警察'))).toBe(true);
    expect(safetyCriticalTexts.some((text) => text.includes('救急車'))).toBe(true);
    expect(safetyCriticalTexts.some((text) => text.includes('やめて'))).toBe(true);
    expect(safetyCriticalTexts.some((text) => text.includes('気分が悪い'))).toBe(true);
    expect(safetyCriticalTexts.some((text) => text.includes('なくしました') || text.includes('盗まれました'))).toBe(true);
    expect(safetyCriticalTexts.some((text) => text.includes('病院') || text.includes('交番') || text.includes('薬局'))).toBe(true);

    const firstNonCriticalIndex = emergencyPhrases.findIndex((phrase) => !phrase.safetyCritical);
    const lastCriticalIndex = emergencyPhrases.reduce((last, phrase, index) => (phrase.safetyCritical ? index : last), -1);
    if (firstNonCriticalIndex !== -1 && lastCriticalIndex !== -1) {
      expect(lastCriticalIndex).toBeLessThan(firstNonCriticalIndex === -1 ? Infinity : emergencyPhrases.length);
      expect(firstNonCriticalIndex).toBeGreaterThan(lastCriticalIndex - 1);
    }
  });

  it('validateTravelJapaneseDataset() 於正式 dataset 上回傳 valid: true', () => {
    const result = validateTravelJapaneseDataset();
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('getPhraseById 可依 id 找到對應 phrase，找不到時回傳 undefined', () => {
    const [first] = getAllPhrases();
    expect(getPhraseById(first.id)).toEqual(first);
    expect(getPhraseById('not-exist')).toBeUndefined();
  });
});

describe('travelJapanese searchPhrases（Phase 5 US3, FR-013~FR-018）', () => {
  it('繁體中文部分關鍵字可找到符合句子', () => {
    const results = searchPhrases('護照');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((phrase) => phrase.traditionalChinese.includes('護照'))).toBe(true);
  });

  it('日文部分關鍵字可找到符合句子', () => {
    const results = searchPhrases('パスポート');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((phrase) => phrase.japanese.includes('パスポート'))).toBe(true);
  });

  it('空字串回傳空陣列（非全部句子）', () => {
    expect(searchPhrases('')).toEqual([]);
    expect(searchPhrases('   ')).toEqual([]);
  });

  it('同一 phrase 符合多個欄位時僅回傳一次', () => {
    const results = searchPhrases('護照');
    const ids = results.map((phrase) => phrase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('無符合關鍵字時回傳空陣列', () => {
    expect(searchPhrases('這句話不存在於dataset中xyz123')).toEqual([]);
  });
});
