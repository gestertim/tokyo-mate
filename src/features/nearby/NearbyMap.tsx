import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { PlaceResult } from '../../types/place';

interface NearbyMapProps {
  places: PlaceResult[];
  selectedPlaceId?: string;
  onSelectPlace: (id: string) => void;
  onMapUnavailable?: () => void;
}

const GEOAPIFY_TILE_URL = 'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={apiKey}';
const GEOAPIFY_ATTRIBUTION =
  '© <a href="https://www.geoapify.com/">Geoapify</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DEFAULT_CENTER: [number, number] = [35.6762, 139.6503];

export function NearbyMap({ places, selectedPlaceId, onSelectPlace, onMapUnavailable }: NearbyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map());
  const hasFitBoundsRef = useRef(false);
  const unavailableRef = useRef(false);
  const callbacksRef = useRef({ onSelectPlace, onMapUnavailable });
  callbacksRef.current = { onSelectPlace, onMapUnavailable };

  function reportUnavailable() {
    if (unavailableRef.current) return;
    unavailableRef.current = true;
    callbacksRef.current.onMapUnavailable?.();
  }

  useEffect(() => {
    if (!containerRef.current) return undefined;
    try {
      const apiKey = (import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined) ?? '';
      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 13);
      const tileLayer = L.tileLayer(GEOAPIFY_TILE_URL.replace('{apiKey}', apiKey), {
        attribution: GEOAPIFY_ATTRIBUTION,
        maxZoom: 20,
      });
      tileLayer.on('tileerror', () => reportUnavailable());
      tileLayer.addTo(map);
      map.on('error', () => reportUnavailable());
      mapRef.current = map;
    } catch {
      mapRef.current = null;
      reportUnavailable();
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      hasFitBoundsRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      const nextIds = new Set(places.map((place) => place.id));
      for (const [id, marker] of markersRef.current) {
        if (!nextIds.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      }

      for (const place of places) {
        const isSelected = place.id === selectedPlaceId;
        const icon = L.divIcon({
          className: isSelected ? 'nearby-marker nearby-marker--selected' : 'nearby-marker',
          html: isSelected ? '<span class="nearby-marker__badge">選定</span>' : '',
        });
        const existing = markersRef.current.get(place.id);

        if (existing) {
          existing.setLatLng([place.location.latitude, place.location.longitude]);
          existing.setIcon(icon);
          existing.setZIndexOffset(isSelected ? 1000 : 0);
        } else {
          const marker = L.marker([place.location.latitude, place.location.longitude], { icon });
          marker.on('click', () => callbacksRef.current.onSelectPlace(place.id));
          marker.addTo(map);
          markersRef.current.set(place.id, marker);
        }
      }

      if (!hasFitBoundsRef.current && places.length > 0) {
        const bounds = L.latLngBounds(
          places.map((place) => [place.location.latitude, place.location.longitude] as [number, number]),
        );
        map.fitBounds(bounds);
        hasFitBoundsRef.current = true;
      }
    } catch {
      reportUnavailable();
    }
  }, [places, selectedPlaceId]);

  return <div ref={containerRef} className="nearby-map" role="presentation" />;
}
