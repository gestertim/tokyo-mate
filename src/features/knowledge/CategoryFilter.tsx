import { getKnowledgeCategories, KNOWLEDGE_CATEGORY_LABELS } from '../../services/knowledge';
import type { KnowledgeCategory } from '../../types/knowledge';

interface CategoryFilterProps {
  selectedCategory: KnowledgeCategory;
  onChange: (category: KnowledgeCategory) => void;
}

export function CategoryFilter({ selectedCategory, onChange }: CategoryFilterProps) {
  return (
    <div role="tablist" aria-label="東京百科分類" className="knowledge-category-filter">
      {getKnowledgeCategories().map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={selectedCategory === category}
          onClick={() => onChange(category)}
        >
          {KNOWLEDGE_CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}