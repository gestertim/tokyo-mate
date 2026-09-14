import type { LocationCoordinates } from './request';

export type PlaceCategory = 'food' | 'shopping' | 'attraction' | 'convenience' | 'station' | 'all';

export interface PlaceResult {
  id: string;
  name: string;
  category: string;
  address: string;
  location: LocationCoordinates;
  distanceMeter?: number;
  openNowStatus?: 'open' | 'closed' | 'unknown';
  whyRecommended?: string;
}

export interface NearbySearchRequest {
  location: {
    type: 'coordinates' | 'manual';
    coordinates?: LocationCoordinates;
    manualArea?: string;
  };
  category?: PlaceCategory;
  query?: string;
}