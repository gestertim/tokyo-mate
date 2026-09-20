import type { PlaceResult } from '../../types/place';

function hasReliableCoordinates(place: PlaceResult): boolean {
  const location = place.location;
  if (!location) return false;
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

export function isMapEligible(place: PlaceResult): boolean {
  return hasReliableCoordinates(place);
}

export function isNavigationEligible(place: PlaceResult): boolean {
  return hasReliableCoordinates(place);
}
