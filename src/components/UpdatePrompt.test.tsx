import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

function mockServiceWorkerContainer(waiting: { postMessage: ReturnType<typeof vi.fn> } | null) {
  const listeners: Record<string, ((event?: unknown) => void)[]> = {};
  const container = {
    controller: {},
    getRegistration: vi.fn().mockResolvedValue({
      waiting,
      addEventListener: vi.fn(),
    }),
    addEventListener: (type: string, handler: (event?: unknown) => void) => {
      listeners[type] = [...(listeners[type] ?? []), handler];
    },
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
  return { container, listeners };
}

describe('UpdatePrompt（FR-024 / SC-013 新版本不強制中斷目前任務）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
  });

  it('沒有等待中的新版本時不顯示任何提示', async () => {
    mockServiceWorkerContainer(null);
    render(<UpdatePrompt />);
    await Promise.resolve();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('偵測到新版本時顯示提示，且提供稍後更新選項而非強制 reload', async () => {
    const waiting = { postMessage: vi.fn() };
    mockServiceWorkerContainer(waiting);
    render(<UpdatePrompt />);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('有新版本可用');
    expect(screen.getByText('稍後更新')).toBeInTheDocument();

    await userEvent.click(screen.getByText('立即更新'));
    expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING');
  });

  it('點擊稍後更新後提示消失，不中斷目前任務', async () => {
    const waiting = { postMessage: vi.fn() };
    mockServiceWorkerContainer(waiting);
    render(<UpdatePrompt />);

    await screen.findByRole('status');
    await userEvent.click(screen.getByText('稍後更新'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
