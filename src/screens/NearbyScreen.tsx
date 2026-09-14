import { useState } from 'react';
import { NearbyExplorer } from '../features/nearby/NearbyExplorer';
import { NearbyResults } from '../features/nearby/NearbyResults';
import { StatusMessage } from '../components/StatusMessage';
import { requestGeolocation } from '../services/geolocation';
import { requestPlaces } from '../services/api';
import type { PlaceCategory, PlaceResult } from '../types/place';

interface NearbyScreenProps { onBack: () => void }

export function NearbyScreen({ onBack }: NearbyScreenProps) {
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function searchByCoordinates(latitude: number, longitude: number, category: PlaceCategory) {
    setLoading(true);
    setError(undefined);
    try {
      const result = await requestPlaces({ location: { type: 'coordinates', coordinates: { latitude, longitude } }, category });
      setPlaces(result.places);
    } catch (value) {
      setError(toUserMessage(value));
    } finally {
      setLoading(false);
    }
  }

  async function handleUseMyLocation(category: PlaceCategory) {
    setNotice(undefined);
    try {
      const coordinates = await requestGeolocation();
      await searchByCoordinates(coordinates.latitude, coordinates.longitude, category);
    } catch (value) {
      setNotice(toUserMessage(value));
    }
  }

  async function handleManualAreaSearch(area: string, category: PlaceCategory) {
    setNotice(undefined);
    setLoading(true);
    setError(undefined);
    try {
      const result = await requestPlaces({ location: { type: 'manual', manualArea: area }, category });
      setPlaces(result.places);
    } catch (value) {
      setError(toUserMessage(value));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="nearby-heading">
      <button type="button" onClick={onBack}>
        返回首頁
      </button>
      <h2 id="nearby-heading">探索附近</h2>
      <NearbyExplorer
        onUseMyLocation={(category) => void handleUseMyLocation(category)}
        onManualAreaSearch={(area, category) => void handleManualAreaSearch(area, category)}
      />
      {notice && <StatusMessage>{notice}</StatusMessage>}
      <NearbyResults places={places} loading={loading} error={error} />
    </section>
  );
}

function toUserMessage(value: unknown): string {
  return typeof value === 'object' && value && 'userMessage' in value
    ? String(value.userMessage)
    : '目前無法完成請求，請稍後重試。';
}
