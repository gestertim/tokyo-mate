import type { PlaceResult } from '../../types/place';
import { formatDistance } from './distance';
import { isNavigationEligible } from './mapEligibility';

interface NearbyResultsProps {
  places: PlaceResult[];
  loading?: boolean;
  error?: string;
  selectedPlaceId?: string;
  onSelectPlace?: (id: string) => void;
  onNavigate?: (place: PlaceResult) => void;
}

export function NearbyResults({ places, loading, error, selectedPlaceId, onSelectPlace, onNavigate }: NearbyResultsProps) {
  if (loading) return <p>正在搜尋附近地點…</p>;
  if (error) return <p>{error}</p>;
  if (places.length === 0) return <p>目前沒有符合的地點，請改用其他區域或分類。</p>;

  return (
    <ul>
      {places.map((place) => {
        const isSelected = place.id === selectedPlaceId;
        const navigationEligible = isNavigationEligible(place);
        return (
          <li key={place.id}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectPlace?.(place.id)}
            >
              <h3>{place.name}</h3>
            </button>
            {isSelected && <span>目前選定</span>}
            <p>{place.category}</p>
            <p>{place.address}</p>
            <p>{formatDistance(place.distanceMeter)}</p>
            <p>{place.openNowStatus === 'open' ? '營業中' : place.openNowStatus === 'closed' ? '目前休息' : '營業狀態不明'}</p>
            {place.whyRecommended && <p>{place.whyRecommended}</p>}
            {navigationEligible && (
              <button type="button" onClick={() => onNavigate?.(place)}>
                前往此地
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
