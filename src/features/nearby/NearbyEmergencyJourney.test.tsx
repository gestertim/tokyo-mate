import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NearbyExplorer } from './NearbyExplorer';
import { LiveDataStatus } from '../../components/LiveDataStatus';
import { EmergencyAnswerCard } from '../emergency/EmergencyAnswerCard';
import { NearbyScreen } from '../../screens/NearbyScreen';
import * as api from '../../services/api';
import * as geolocation from '../../services/geolocation';
import type { PlaceResult } from '../../types/place';

describe('nearby and emergency journeys', () => {
  it('renders nearby search controls and fallback guidance', () => {
    render(<NearbyExplorer onUseMyLocation={() => undefined} onManualAreaSearch={() => undefined} />);
    expect(screen.getByRole('button', { name: /使用我的位置/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /輸入地區/i })).toBeInTheDocument();
  });

  it('shows live freshness status and emergency answer priority cards', () => {
    render(
      <>
        <LiveDataStatus status="live_required" message="正在確認營業時間" />
        <EmergencyAnswerCard
          guide={{
            immediateAction: ['立即向警察報案'],
            nextAction: ['聯絡代表處'],
            phrase: ['パスポートを紛失しました。'],
            importantNotice: '請保留報案證明',
          }}
        />
      </>,
    );

    expect(screen.getByText(/正在確認營業時間/i)).toBeInTheDocument();
    expect(screen.getByText(/立即向警察報案/i)).toBeInTheDocument();
    expect(screen.getByText(/聯絡代表處/i)).toBeInTheDocument();
  });
});

describe('NearbyScreen category wiring, distance and recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes the selected category through to the /api/places request for manual area search', async () => {
    const user = userEvent.setup();
    const requestPlacesSpy = vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: '美食' }));
    await user.type(screen.getByLabelText('手動地區'), '新宿');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    await waitFor(() => {
      expect(requestPlacesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { type: 'manual', manualArea: '新宿' },
          category: 'food',
        }),
      );
    });
  });

  it('passes the selected category through to the /api/places request for coordinate search', async () => {
    const user = userEvent.setup();
    vi.spyOn(geolocation, 'requestGeolocation').mockResolvedValue({ latitude: 35.6895, longitude: 139.6917 });
    const requestPlacesSpy = vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: '車站' }));
    await user.click(screen.getByRole('button', { name: /使用我的位置/i }));

    await waitFor(() => {
      expect(requestPlacesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { type: 'coordinates', coordinates: { latitude: 35.6895, longitude: 139.6917 } },
          category: 'station',
        }),
      );
    });
  });

  it('formats distances for travelers in metres and kilometres', async () => {
    const user = userEvent.setup();
    const places: PlaceResult[] = [
      { id: '1', name: '附近店家', category: '拉麵', address: '東京都', location: { latitude: 0, longitude: 0 }, distanceMeter: 850 },
      { id: '2', name: '較遠景點', category: '景點', address: '東京都', location: { latitude: 0, longitude: 0 }, distanceMeter: 1423 },
    ];
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '新宿');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    expect(await screen.findByText('850 公尺')).toBeInTheDocument();
    expect(screen.getByText('1.4 公里')).toBeInTheDocument();
  });

  it('does not show a distance for manual area results without coordinates', async () => {
    const user = userEvent.setup();
    const places: PlaceResult[] = [
      { id: '1', name: '淺草寺', category: '景點', address: '東京都台東區', location: { latitude: 35.7148, longitude: 139.7967 } },
    ];
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    expect(await screen.findByText('距離未知')).toBeInTheDocument();
  });

  it('shows a friendly zh-TW recovery message when the provider fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockRejectedValue({
      code: 'PLACES_SERVICE_UNAVAILABLE',
      userTitle: '附近探索服務暫時無法連線',
      userMessage: '無法取得周邊景點與店家資料。',
      actionableStep: '請輸入地區名稱重新搜尋，或前往東京百科查看區域景點介紹。',
    });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '新宿');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    expect(await screen.findByText('無法取得周邊景點與店家資料。')).toBeInTheDocument();
  });

  it('falls back to manual area search after location permission is denied', async () => {
    const user = userEvent.setup();
    vi.spyOn(geolocation, 'requestGeolocation').mockRejectedValue({
      code: 'GEOLOCATION_DENIED',
      userTitle: '定位權限被拒絕',
      userMessage: '您已拒絕位置權限，系統已切換到手動地區搜尋。',
      actionableStep: '請輸入要搜尋的區域，例如「東京站」或「淺草」。',
    });
    const requestPlacesSpy = vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /使用我的位置/i }));

    expect(await screen.findByText('您已拒絕位置權限，系統已切換到手動地區搜尋。')).toBeInTheDocument();

    await user.type(screen.getByLabelText('手動地區'), '新宿');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    await waitFor(() => {
      expect(requestPlacesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ location: { type: 'manual', manualArea: '新宿' } }),
      );
    });
  });
});
