import type { PlaceResult } from '../../types/place';
import { formatDistance } from './distance';

interface NearbyResultsProps {
  places: PlaceResult[];
  loading?: boolean;
  error?: string;
}

export function NearbyResults({ places, loading, error }: NearbyResultsProps) {
  if (loading) return <p>正在搜尋附近地點…</p>;
  if (error) return <p>{error}</p>;
  if (places.length === 0) return <p>目前沒有符合的地點，請改用其他區域或分類。</p>;

  return (
    <ul>
      {places.map((place) => (
        <li key={place.id}>
          <h3>{place.name}</h3>
          <p>{place.category}</p>
          <p>{place.address}</p>
          <p>{formatDistance(place.distanceMeter)}</p>
          <p>{place.openNowStatus === 'open' ? '營業中' : place.openNowStatus === 'closed' ? '目前休息' : '營業狀態不明'}</p>
          {place.whyRecommended && <p>{place.whyRecommended}</p>}
        </li>
      ))}
    </ul>
  );
}
