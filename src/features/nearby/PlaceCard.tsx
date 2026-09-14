import type { PlaceResult } from '../../types/place';
import { formatDistance } from './distance';

interface PlaceCardProps {
  place: PlaceResult;
}

export function PlaceCard({ place }: PlaceCardProps) {
  return (
    <article>
      <h3>{place.name}</h3>
      <p>{place.category}</p>
      <p>{place.address}</p>
      <p>{formatDistance(place.distanceMeter)}</p>
      <p>{place.openNowStatus === 'open' ? '營業中' : place.openNowStatus === 'closed' ? '目前休息' : '營業狀態不明'}</p>
      {place.whyRecommended && <p>{place.whyRecommended}</p>}
      <button type="button">怎麼去</button>
    </article>
  );
}
