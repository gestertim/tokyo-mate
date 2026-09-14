import { describe, expect, it } from 'vitest';
import { selectKnowledgeEntries, serializeKnowledgeContext } from './knowledge';

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
});
