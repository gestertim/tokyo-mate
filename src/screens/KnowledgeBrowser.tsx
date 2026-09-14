import { useMemo, useState } from 'react';
import { getKnowledgeCategories, selectKnowledgeEntries } from '../services/knowledge';

interface KnowledgeBrowserProps { onBack: () => void }

export function KnowledgeBrowser({ onBack }: KnowledgeBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<'area' | 'transport' | 'food' | 'shopping' | 'culture' | 'emergency'>('area');
  const entries = useMemo(() => selectKnowledgeEntries('東京旅遊', { area: '東京' }).filter((entry) => entry.category === selectedCategory), [selectedCategory]);

  return (
    <section>
      <button type="button" onClick={onBack}>
        返回首頁
      </button>
      <h2>東京百科</h2>
      <div role="tablist" aria-label="東京百科分類">
        {getKnowledgeCategories().map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={selectedCategory === category}
            onClick={() => setSelectedCategory(category)}
          >
            {category === 'area' && '區域'}
            {category === 'transport' && '交通'}
            {category === 'food' && '美食'}
            {category === 'shopping' && '購物'}
            {category === 'culture' && '文化'}
            {category === 'emergency' && '緊急'}
          </button>
        ))}
      </div>
      {entries.length === 0 ? <p>目前沒有符合內容。</p> : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <h3>{entry.title}</h3>
              <p>{entry.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
