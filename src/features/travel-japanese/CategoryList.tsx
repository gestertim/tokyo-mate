import { TRAVEL_JAPANESE_CATEGORIES, TRAVEL_JAPANESE_CATEGORY_LABELS } from '../../services/travelJapanese';
import type { TravelJapaneseCategory } from '../../types/travelJapanese';

interface CategoryListProps {
  onSelectCategory: (category: TravelJapaneseCategory) => void;
}

export function CategoryList({ onSelectCategory }: CategoryListProps) {
  return (
    <div role="tablist" aria-label="旅遊日文情境" className="travel-japanese-category-list">
      {TRAVEL_JAPANESE_CATEGORIES.map((category) => (
        <button key={category} type="button" onClick={() => onSelectCategory(category)}>
          {TRAVEL_JAPANESE_CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}
