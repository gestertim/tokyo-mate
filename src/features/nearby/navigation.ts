import type { PlaceResult } from '../../types/place';
import { isNavigationEligible } from './mapEligibility';

export function buildGoogleMapsHandoffUrl(place: PlaceResult): string | undefined {
  if (!isNavigationEligible(place)) return undefined;
  const { latitude, longitude } = place.location;
  const query = encodeURIComponent(`${place.name} ${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function openNavigationHandoff(place: PlaceResult): { success: boolean } {
  const url = buildGoogleMapsHandoffUrl(place);
  if (!url) return { success: false };
  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    return { success: opened != null };
  } catch {
    return { success: false };
  }
}
