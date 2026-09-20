import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NearbyScreen } from './NearbyScreen';
import * as api from '../services/api';
import * as geolocation from '../services/geolocation';
import type { PlaceResult } from '../types/place';

const { mapPropsHolder } = vi.hoisted(() => ({
  mapPropsHolder: { current: undefined as unknown as Record<string, unknown> },
}));

vi.mock('../features/nearby/NearbyMap', () => ({
  NearbyMap: (props: {
    places: PlaceResult[];
    selectedPlaceId?: string;
    onSelectPlace: (id: string) => void;
    onMapUnavailable?: () => void;
  }) => {
    mapPropsHolder.current = props;
    return (
      <div data-testid="nearby-map">
        {props.places.map((place) => (
          <button key={place.id} type="button" onClick={() => props.onSelectPlace(place.id)}>
            {`marker-${place.id}`}
          </button>
        ))}
      </div>
    );
  },
}));

function reliablePlace(overrides: Partial<PlaceResult> = {}): PlaceResult {
  return {
    id: 'p1',
    name: '淺草寺',
    category: '景點',
    address: '東京都台東區',
    location: { latitude: 35.7148, longitude: 139.7967 },
    ...overrides,
  };
}

function unreliablePlace(overrides: Partial<PlaceResult> = {}): PlaceResult {
  return {
    id: 'p2',
    name: '未知座標店家',
    category: '美食',
    address: '東京都',
    location: { latitude: 0, longitude: 0 },
    ...overrides,
  };
}

describe('NearbyScreen — User Story 1 地圖理解', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mapPropsHolder.current = undefined as unknown as Record<string, unknown>;
  });

  it('成功搜尋且結果具備可靠座標時渲染地圖', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    expect(await screen.findByTestId('nearby-map')).toBeInTheDocument();
    expect(mapPropsHolder.current.places).toEqual([reliablePlace()]);
  });

  it('缺乏可靠座標的有效 result 不出現在地圖但仍是有效卡片', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace(), unreliablePlace()] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    await screen.findByTestId('nearby-map');
    expect(mapPropsHolder.current.places).toEqual([reliablePlace()]);
    expect(screen.getByRole('heading', { name: '未知座標店家' })).toBeInTheDocument();
  });

  it('成功搜尋但回傳 0 筆結果時地圖 0 marker、Selected Place 維持未選定', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    await waitFor(() => expect(mapPropsHolder.current).toBeDefined());
    expect(mapPropsHolder.current.places).toEqual([]);
    expect(mapPropsHolder.current.selectedPlaceId).toBeUndefined();
  });

  it('地圖 pan／zoom 不觸發新的 /api/places 請求', async () => {
    const user = userEvent.setup();
    const requestPlacesSpy = vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));
    await screen.findByTestId('nearby-map');

    expect(requestPlacesSpy).toHaveBeenCalledTimes(1);
  });
});

describe('NearbyScreen — User Story 2 前往此地', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mapPropsHolder.current = undefined as unknown as Record<string, unknown>;
  });

  it('handoff 成功時保留 selectedPlaceId 與 places，且不設定 navigationNotice', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });
    vi.spyOn(window, 'open').mockReturnValue({} as Window);

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    await user.click(screen.getByRole('button', { name: '淺草寺' }));
    await user.click(screen.getByRole('button', { name: '前往此地' }));

    expect(screen.getByRole('button', { name: '淺草寺' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('目前無法開啟地圖，請再試一次。')).not.toBeInTheDocument();
  });

  it('handoff 失敗時保留 selectedPlaceId 與 places，並設定與既有 error/notice 可區分的 navigationNotice', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });
    vi.spyOn(window, 'open').mockReturnValue(null);

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    await user.click(screen.getByRole('button', { name: '淺草寺' }));
    await user.click(screen.getByRole('button', { name: '前往此地' }));

    expect(await screen.findByText('目前無法開啟地圖，請再試一次。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '淺草寺' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '淺草寺' })).toBeInTheDocument();
  });
});

describe('NearbyScreen — User Story 3 手動地區', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mapPropsHolder.current = undefined as unknown as Record<string, unknown>;
  });

  it('未曾使用目前位置，直接以手動地區搜尋仍可使用地圖與前往此地', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });
    vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const requestGeolocationSpy = vi.spyOn(geolocation, 'requestGeolocation');

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    expect(await screen.findByTestId('nearby-map')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '前往此地' }));

    expect(requestGeolocationSpy).not.toHaveBeenCalled();
  });
});

describe('NearbyScreen — User Story 4 韌性與一致性', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mapPropsHolder.current = undefined as unknown as Record<string, unknown>;
  });

  it.each([
    ['GEOLOCATION_DENIED', '定位權限被拒絕'],
    ['GEOLOCATION_UNAVAILABLE', '定位目前不可用'],
  ])('定位失敗（%s）時既有搜尋結果不被破壞，可切換手動地區完成搜尋', async (code, userTitle) => {
    const user = userEvent.setup();
    vi.spyOn(geolocation, 'requestGeolocation').mockRejectedValue({
      code,
      userTitle,
      userMessage: '目前無法取得您的位置，請改用手動輸入地區。',
      actionableStep: '請輸入要搜尋的區域。',
    });
    const requestPlacesSpy = vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /使用我的位置/i }));
    expect(await screen.findByText('目前無法取得您的位置，請改用手動輸入地區。')).toBeInTheDocument();

    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    await waitFor(() => expect(requestPlacesSpy).toHaveBeenCalled());
    expect(await screen.findByRole('heading', { name: '淺草寺' })).toBeInTheDocument();
  });

  it('地圖不可用時 NearbyResults 仍可讀可操作，且不設定既有 error', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });
    vi.spyOn(window, 'open').mockReturnValue({} as Window);

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));
    await screen.findByTestId('nearby-map');

    (mapPropsHolder.current.onMapUnavailable as () => void)();

    expect(await screen.findByText(/地圖暫時無法使用/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '淺草寺' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '淺草寺' }));
    await user.click(screen.getByRole('button', { name: '前往此地' }));
    expect(screen.getByRole('button', { name: '淺草寺' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('地圖 marker 選取與 card 選取共用同一個 selectedPlaceId', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));
    await screen.findByTestId('nearby-map');

    await user.click(within(screen.getByTestId('nearby-map')).getByRole('button', { name: 'marker-p1' }));
    expect(screen.getByRole('button', { name: '淺草寺' })).toHaveAttribute('aria-pressed', 'true');
    expect(mapPropsHolder.current.selectedPlaceId).toBe('p1');

    await user.click(screen.getByRole('button', { name: '淺草寺' }));
    expect(mapPropsHolder.current.selectedPlaceId).toBe('p1');
  });

  it('開始新一次搜尋時 selectedPlaceId 與 navigationNotice 立即重置', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestPlaces').mockResolvedValue({ places: [reliablePlace()] });
    vi.spyOn(window, 'open').mockReturnValue(null);

    render(<NearbyScreen onBack={vi.fn()} />);
    await user.type(screen.getByLabelText('手動地區'), '淺草');
    await user.click(screen.getByRole('button', { name: /輸入地區/i }));
    await user.click(screen.getByRole('button', { name: '淺草寺' }));
    await user.click(screen.getByRole('button', { name: '前往此地' }));
    expect(await screen.findByText('目前無法開啟地圖，請再試一次。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /輸入地區/i }));

    await waitFor(() => {
      expect(screen.queryByText('目前無法開啟地圖，請再試一次。')).not.toBeInTheDocument();
    });
  });
});
