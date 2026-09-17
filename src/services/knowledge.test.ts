import { describe, expect, it } from 'vitest';
import {
  getKnowledgeCategories,
  getKnowledgeEntriesByCategory,
  KNOWLEDGE_CATEGORIES,
  selectKnowledgeEntries,
  serializeKnowledgeContext,
} from './knowledge';

describe('knowledge retrieval', () => {
  it('selects the most relevant Tokyo knowledge entries for a travel query', () => {
    const results = selectKnowledgeEntries('淺草半日遊、寺廟和美食', { area: '淺草' });
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0]).toMatchObject({ area: '淺草' });
    expect(results[0].title).toContain('淺草');
  });

  it('serializes travel context into a brief assistant prompt section', () => {
    const results = selectKnowledgeEntries('新宿轉乘、交通和餐飲', { area: '新宿' });
    const context = serializeKnowledgeContext(results);
    expect(context).toContain('新宿');
    expect(context).toContain('交通');
  });

  it('returns each complete static category in stable catalog order without changing AI Top 5 retrieval', () => {
    expect(getKnowledgeCategories()).toEqual([...KNOWLEDGE_CATEGORIES]);

    for (const category of KNOWLEDGE_CATEGORIES) {
      const entries = getKnowledgeEntriesByCategory(category);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((entry) => entry.category === category)).toBe(true);
      expect(getKnowledgeEntriesByCategory(category).map((entry) => entry.id)).toEqual(entries.map((entry) => entry.id));
    }

    const aiResults = selectKnowledgeEntries('東京', { area: '淺草' });
    expect(aiResults.length).toBeGreaterThanOrEqual(3);
    expect(aiResults.length).toBeLessThanOrEqual(5);
    expect(getKnowledgeEntriesByCategory('area').length).toBeGreaterThan(aiResults.length);
  });

  it('returns no entries for an unknown category without throwing', () => {
    expect(() => getKnowledgeEntriesByCategory('unknown' as never)).not.toThrow();
    expect(getKnowledgeEntriesByCategory('unknown' as never)).toEqual([]);
  });
});
