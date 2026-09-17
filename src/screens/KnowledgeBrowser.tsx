import { useMemo, useState } from 'react';
import { CategoryFilter } from '../features/knowledge/CategoryFilter';
import { KnowledgeCard } from '../features/knowledge/KnowledgeCard';
import { getKnowledgeEntriesByCategory } from '../services/knowledge';
import type { KnowledgeCategory } from '../types/knowledge';

interface KnowledgeBrowserProps { onBack: () => void }

export function KnowledgeBrowser({ onBack }: KnowledgeBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory>('area');
  const entries = useMemo(() => getKnowledgeEntriesByCategory(selectedCategory), [selectedCategory]);

  return (
    <section className="knowledge-browser">
      <button type="button" onClick={onBack}>
        返回首頁
      </button>
      <h2>東京百科</h2>
      <CategoryFilter selectedCategory={selectedCategory} onChange={setSelectedCategory} />
      {entries.length === 0 ? <p>目前沒有符合內容。</p> : (
        <ul className="knowledge-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <KnowledgeCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
