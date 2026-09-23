import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

function mockServiceWorkerContainer(
  waiting: { postMessage: ReturnType<typeof vi.fn> } | null,
  options: { update?: ReturnType<typeof vi.fn> } = {},
) {
  const listeners: Record<string, ((event?: unknown) => void)[]> = {};
  const update = options.update ?? vi.fn().mockResolvedValue(undefined);
  const registration = {
    waiting,
    addEventListener: vi.fn(),
    update,
  };
  const container = {
    controller: {},
    getRegistration: vi.fn().mockResolvedValue(registration),
    addEventListener: (type: string, handler: (event?: unknown) => void) => {
      listeners[type] = [...(listeners[type] ?? []), handler];
    },
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
  return { container, listeners, registration, update };
}

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

function dispatchVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'));
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

  it('controllerchange 只 reload 一次，且未經使用者操作不會先套用更新', async () => {
    const waiting = { postMessage: vi.fn() };
    const { listeners } = mockServiceWorkerContainer(waiting);
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });
    render(<UpdatePrompt />);

    await screen.findByRole('status');
    expect(waiting.postMessage).not.toHaveBeenCalled();

    listeners.controllerchange?.[0]?.();
    listeners.controllerchange?.[0]?.();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });
});

describe('UpdatePrompt — Phase 14（PWA Update Reliability：foreground registration.update()）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
    setVisibilityState('visible');
  });

  it('App 回到前景（visibilitychange 且 visible）時呼叫 registration.update()', async () => {
    const { update } = mockServiceWorkerContainer(null);
    render(<UpdatePrompt />);
    await Promise.resolve();

    dispatchVisibilityChange();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('document.visibilityState 非 visible 時不呼叫 update()', async () => {
    const { update } = mockServiceWorkerContainer(null);
    render(<UpdatePrompt />);
    await Promise.resolve();

    setVisibilityState('hidden');
    dispatchVisibilityChange();
    expect(update).not.toHaveBeenCalled();
  });

  it('同一 session 內短時間內重複觸發 foreground 會被節流，不重複呼叫 update()', async () => {
    const { update } = mockServiceWorkerContainer(null);
    render(<UpdatePrompt />);
    await Promise.resolve();

    dispatchVisibilityChange();
    dispatchVisibilityChange();
    dispatchVisibilityChange();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('update() rejection 被容錯處理，不拋出未捕捉例外', async () => {
    const update = vi.fn().mockRejectedValue(new Error('offline'));
    mockServiceWorkerContainer(null, { update });
    render(<UpdatePrompt />);
    await Promise.resolve();

    expect(() => dispatchVisibilityChange()).not.toThrow();
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('既有 waiting worker 偵測、提示與 controllerchange reload 行為於本階段維持不變', async () => {
    const waiting = { postMessage: vi.fn() };
    mockServiceWorkerContainer(waiting);
    render(<UpdatePrompt />);
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('有新版本可用');
    expect(screen.getByText('稍後更新')).toBeInTheDocument();
  });
});
