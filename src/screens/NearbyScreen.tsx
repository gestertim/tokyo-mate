import { lazy, Suspense, useState } from 'react';
import { NearbyExplorer } from '../features/nearby/NearbyExplorer';
import { NearbyResults } from '../features/nearby/NearbyResults';
import { StaticTokyoMap } from '../features/nearby/StaticTokyoMap';
import { useAccessQuery } from '../hooks/useAccessQuery';
import { loadMapAccess } from '../services/access-api';
import type { MapAccessView } from '../types/access';
import { isMapEligible } from '../features/nearby/mapEligibility';
import { openNavigationHandoff } from '../features/nearby/navigation';
import { StatusMessage } from '../components/StatusMessage';
import { requestGeolocation } from '../services/geolocation';
import { requestPlaces } from '../services/api';
import type { PlaceCategory, PlaceResult } from '../types/place';

const NearbyMap = lazy(() => import('../features/nearby/NearbyMap').then((module) => ({ default: module.NearbyMap })));
const mapExpiresAt = (data: MapAccessView) => data.eligibleForInteractiveMap ? Date.parse(data.resetAt ?? '') : Infinity;
interface NearbyScreenProps {
  onBack: () => void;
  onOpenPublic?: () => void;
  loadAccess?: (signal?: AbortSignal) => Promise<MapAccessView>;
}

export function NearbyScreen({ onBack, onOpenPublic, loadAccess = loadMapAccess }: NearbyScreenProps) {
  const { state: access, refresh: refreshAccess } = useAccessQuery(loadAccess, { expiresAt: mapExpiresAt });
  const accessAvailable = access.status === 'ready' && access.data.eligibleForInteractiveMap;
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [navigationNotice, setNavigationNotice] = useState<string>();

  function resetSelection() {
    setSelectedPlaceId(undefined);
    setNavigationNotice(undefined);
    setMapUnavailable(false);
  }

  async function searchByCoordinates(latitude: number, longitude: number, category: PlaceCategory) {
    const current = await refreshAccess();
    if (!current?.eligibleForInteractiveMap) return;
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
    const current = await refreshAccess();
    if (!current?.eligibleForInteractiveMap) return;
    resetSelection();
    setNotice(undefined);
    try {
      const coordinates = await requestGeolocation();
      await searchByCoordinates(coordinates.latitude, coordinates.longitude, category);
    } catch (value) {
      setNotice(toUserMessage(value));
    }
  }

  async function handleManualAreaSearch(area: string, category: PlaceCategory) {
    const current = await refreshAccess();
    if (!current?.eligibleForInteractiveMap) return;
    resetSelection();
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

  function handleSelectPlace(id: string) {
    setSelectedPlaceId(id);
  }

  function handleNavigate(place: PlaceResult) {
    const result = openNavigationHandoff(place);
    setNavigationNotice(result.success ? undefined : '目前無法開啟地圖，請再試一次。');
  }

  const mapEligiblePlaces = places.filter(isMapEligible);

  return (
    <section aria-labelledby="nearby-heading">
      <button type="button" onClick={onBack}>
        返回首頁
      </button>
      <h2 id="nearby-heading">探索附近</h2>
      <NearbyExplorer
        restricted={!accessAvailable}
        onUseMyLocation={(category) => void handleUseMyLocation(category)}
        onManualAreaSearch={(area, category) => void handleManualAreaSearch(area, category)}
      />
      {notice && <StatusMessage>{notice}</StatusMessage>}
      {navigationNotice && <StatusMessage>{navigationNotice}</StatusMessage>}
      {access.status === 'error' && <StatusMessage>{access.message}</StatusMessage>}
      {!accessAvailable && <>
        <StatusMessage>目前未取得有效互動地圖使用狀態；不會啟動定位、地點搜尋或載入圖磚。</StatusMessage>
        <StaticTokyoMap onOpenPublic={onOpenPublic} />
        <button type="button" onClick={() => void refreshAccess()}>重新確認地圖使用狀態</button>
      </>}
      {!loading && !error && accessAvailable && !mapUnavailable && (
        <Suspense fallback={<StaticTokyoMap onOpenPublic={onOpenPublic} />}>
        <NearbyMap
          places={mapEligiblePlaces}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={handleSelectPlace}
          onMapUnavailable={() => setMapUnavailable(true)}
        />
        </Suspense>
      )}
      {mapUnavailable && accessAvailable && <StaticTokyoMap onOpenPublic={onOpenPublic} />}
      {mapUnavailable && <StatusMessage>地圖暫時無法使用，您仍可從下方清單選取地點並前往此地。</StatusMessage>}
      <NearbyResults
        places={places}
        loading={loading}
        error={error}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={handleSelectPlace}
        onNavigate={handleNavigate}
      />
    </section>
  );
}

function toUserMessage(value: unknown): string {
  return typeof value === 'object' && value && 'userMessage' in value
    ? String(value.userMessage)
    : '目前無法完成請求，請稍後重試。';
}
