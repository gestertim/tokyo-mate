import { useState } from 'react';
import type { PlaceCategory } from '../../types/place';

interface NearbyExplorerProps {
  onUseMyLocation?: (category: PlaceCategory) => void;
  onManualAreaSearch?: (area: string, category: PlaceCategory) => void;
}

const categoryOptions: Array<{ value: PlaceCategory; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'attraction', label: '景點' },
  { value: 'food', label: '美食' },
  { value: 'shopping', label: '購物' },
  { value: 'convenience', label: '便利商店' },
  { value: 'station', label: '車站' },
];

export function NearbyExplorer({ onUseMyLocation, onManualAreaSearch }: NearbyExplorerProps) {
  const [manualArea, setManualArea] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('all');

  return (
    <section aria-label="附近探索">
      <div role="group" aria-label="附近探索位置選擇">
        <button type="button" onClick={() => onUseMyLocation?.(category)}>使用我的位置</button>
        <button type="button" onClick={() => onManualAreaSearch?.(manualArea.trim() || '淺草', category)}>輸入地區</button>
      </div>
      <label>
        手動地區
        <input value={manualArea} onChange={(event) => setManualArea(event.target.value)} placeholder="例如：淺草、上野、新宿" />
      </label>
      <fieldset>
        <legend>探索分類</legend>
        {categoryOptions.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="nearby-category"
              value={option.value}
              checked={category === option.value}
              onChange={() => setCategory(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {manualArea.trim() ? <p>將搜尋「{manualArea}」附近的店家與景點。</p> : <p>拒絕定位權限時，可改用手動輸入地區搜尋。</p>}
    </section>
  );
}
