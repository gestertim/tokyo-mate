import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HomeScreen（Phase 9 Homepage Integration, FR-001）', () => {
  it('保留既有四個入口並新增「拍照翻譯」第五個入口', () => {
    render(<HomeScreen />);
    const nav = screen.getByRole('navigation', { name: '東京功能入口' });
    expect(screen.getByRole('button', { name: '即時翻譯' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '問東京' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '探索附近' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '東京百科' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /拍照翻譯/ })).toBeInTheDocument();
    expect(nav.querySelectorAll('button')).toHaveLength(5);
  });

  it('點擊「拍照翻譯」進入 PhotoTranslateScreen 且不自動觸發相機/相簿權限', async () => {
    const user = userEvent.setup();
    const permissionsQuery = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, permissions: { query: permissionsQuery } });

    render(<HomeScreen />);
    await user.click(screen.getByRole('button', { name: /拍照翻譯/ }));

    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'acquisition');
    expect(screen.getByRole('button', { name: '拍攝照片' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '從相簿選擇' })).toBeInTheDocument();
    expect(permissionsQuery).not.toHaveBeenCalled();
  });

  it('可依既有 navigation pattern 從 PhotoTranslateScreen 返回首頁，既有入口仍正常存在', async () => {
    const user = userEvent.setup();
    render(<HomeScreen />);

    await user.click(screen.getByRole('button', { name: /拍照翻譯/ }));
    expect(screen.getByTestId('photo-translate-screen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '返回首頁' }));

    expect(screen.queryByTestId('photo-translate-screen')).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: '東京功能入口' });
    expect(screen.getByRole('button', { name: '即時翻譯' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '問東京' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '探索附近' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '東京百科' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /拍照翻譯/ })).toBeInTheDocument();
    expect(nav.querySelectorAll('button')).toHaveLength(5);
  });

  it('「拍照翻譯」入口可用鍵盤（Tab + Enter）觸發', async () => {
    const user = userEvent.setup();
    render(<HomeScreen />);
    const entry = screen.getByRole('button', { name: /拍照翻譯/ });
    entry.focus();
    expect(entry).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('photo-translate-screen')).toBeInTheDocument();
  });

  it('既有「東京百科」入口行為不受影響（呼叫 onOpenKnowledge）', async () => {
    const user = userEvent.setup();
    const onOpenKnowledge = vi.fn();
    render(<HomeScreen onOpenKnowledge={onOpenKnowledge} />);
    await user.click(screen.getByRole('button', { name: '東京百科' }));
    expect(onOpenKnowledge).toHaveBeenCalledTimes(1);
  });
});
