import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NearbyScreen } from './NearbyScreen';
import * as api from '../services/api';
import * as geolocation from '../services/geolocation';
import type { MapAccessView } from '../types/access';

const { mount } = vi.hoisted(() => ({ mount: vi.fn() }));
vi.mock('../features/nearby/NearbyMap', () => ({
  NearbyMap: () => { mount(); return <div data-testid="interactive-map" />; },
}));
const at = '2026-10-06T02:00:00.000Z';

describe('L5 本機受限 map UX（無 Geoapify／CDN 真實證據）', () => {
  it.each(['auth_required', 'not_approved', 'daily_quota', 'weekly_quota', 'unknown'] as const)(
    '%s 只顯示非地理 placeholder，不初始化地圖／定位／Places', async (reason) => {
      mount.mockClear();
      const places = vi.spyOn(api, 'requestPlaces');
      const geo = vi.spyOn(geolocation, 'requestGeolocation');
      const load = vi.fn(async (): Promise<MapAccessView> => ({
        eligibleForInteractiveMap: false, reason, fetchedAt: at,
      }));
      render(<NearbyScreen onBack={vi.fn()} loadAccess={load} />);
      expect(await screen.findByRole('region', { name: '靜態東京風格示意圖' })).toBeInTheDocument();
      await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: '使用我的位置' })).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: '輸入地區' }));
      expect(mount).not.toHaveBeenCalled();
      expect(places).not.toHaveBeenCalled();
      expect(geo).not.toHaveBeenCalled();
      places.mockRestore(); geo.mockRestore();
    });
  it('恢復／離線使舊元件失效，不自動搜尋；明確查詢前重驗', async () => {
    const load = vi.fn<(_: AbortSignal | undefined) => Promise<MapAccessView>>()
      .mockResolvedValueOnce({ eligibleForInteractiveMap: true, reason: 'eligible', fetchedAt: at, resetAt: new Date(Date.now() + 60000).toISOString() })
      .mockResolvedValue({ eligibleForInteractiveMap: false, reason: 'not_approved', fetchedAt: at });
    const places = vi.spyOn(api, 'requestPlaces');
    render(<NearbyScreen onBack={vi.fn()} loadAccess={load} />);
    expect(await screen.findByTestId('interactive-map')).toBeInTheDocument();
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(screen.queryByTestId('interactive-map')).not.toBeInTheDocument());
    expect(places).not.toHaveBeenCalled();
    places.mockRestore();
  });
  it('暫用示意圖沒有外部 URL／定位資料，公開內容操作仍可用', async () => {
    const publicAction = vi.fn();
    render(<NearbyScreen onBack={vi.fn()} onOpenPublic={publicAction}
      loadAccess={async () => ({ eligibleForInteractiveMap: false, reason: 'auth_required', fetchedAt: at })} />);
    await userEvent.click(await screen.findByRole('button', { name: '查看東京百科' }));
    expect(publicAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('img', { name: '東京街區風格示意圖，非即時地圖或真實地理資料。' }).querySelector('image')).toBeNull();
  });
});
