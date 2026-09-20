import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NearbyResults } from './NearbyResults';
import type { PlaceResult } from '../../types/place';

function place(overrides: Partial<PlaceResult> = {}): PlaceResult {
  return {
    id: 'place-1',
    name: '淺草寺',
    category: 'attraction',
    address: '東京都台東区浅草2丁目3-1',
    location: { latitude: 35.7148, longitude: 139.7967 },
    ...overrides,
  };
}

describe('NearbyResults', () => {
  it('每張卡片可獨立呼叫 onSelectPlace', async () => {
    const onSelectPlace = vi.fn();
    render(<NearbyResults places={[place()]} onSelectPlace={onSelectPlace} />);
    await userEvent.click(screen.getByRole('button', { name: /淺草寺/ }));
    expect(onSelectPlace).toHaveBeenCalledWith('place-1');
  });

  it('選定卡片具備非純色彩可辨識標示', () => {
    render(<NearbyResults places={[place()]} selectedPlaceId="place-1" />);
    const button = screen.getByRole('button', { name: /淺草寺/ });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('目前選定')).toBeInTheDocument();
  });

  it('前往此地按鈕僅在 isNavigationEligible 為 true 時可點擊觸發 onNavigate', async () => {
    const onNavigate = vi.fn();
    render(<NearbyResults places={[place()]} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: '前往此地' }));
    expect(onNavigate).toHaveBeenCalledWith(place());
  });

  it('不合格 result 不顯示可觸發的前往此地按鈕', () => {
    const onNavigate = vi.fn();
    render(<NearbyResults places={[place({ location: { latitude: 0, longitude: 0 } })]} onNavigate={onNavigate} />);
    expect(screen.queryByRole('button', { name: '前往此地' })).not.toBeInTheDocument();
  });
});
