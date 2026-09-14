import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkStatus } from './NetworkStatus';

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
}

describe('NetworkStatus（FR-023 / SC-012 network-required fallback）', () => {
  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
  });

  it('連線時不顯示任何離線提示', () => {
    setOnline(true);
    render(<NetworkStatus />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('離線時顯示需要網路與可行動的訊息，而非 raw network error', () => {
    setOnline(false);
    render(<NetworkStatus />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('離線');
    expect(alert).toHaveTextContent('請恢復連線後重試');
  });

  it('恢復連線後提示自動消失，不需重新整理頁面', () => {
    setOnline(false);
    render(<NetworkStatus />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
