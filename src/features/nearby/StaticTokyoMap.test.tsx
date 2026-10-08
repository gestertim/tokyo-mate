import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaticTokyoMap } from './StaticTokyoMap';

describe('T038 示意圖本機元件（不代表正式資產已取得）', () => {
  it('固定示意標示與替代文字；查看公開內容不啟動地圖', () => {
    const open = vi.fn();
    render(<StaticTokyoMap onOpenPublic={open} />);
    expect(screen.getByText('示意圖')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName('東京街區風格示意圖，非即時地圖或真實地理資料。');
    fireEvent.click(screen.getByRole('button', { name: '查看東京百科' }));
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('本機 fixture 破圖保留框架、明確文字與公開內容入口，移除破圖元素', () => {
    const { container } = render(<StaticTokyoMap onOpenPublic={vi.fn()}
      asset={{ mobileSrc: '/images/fixture-mobile.png', desktopSrc: '/images/fixture-desktop.png' }} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('alert')).toHaveTextContent('地圖示意圖目前無法顯示，你仍可查看東京百科。');
    expect(container.querySelector('.nearby-static-map-frame')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看東京百科' })).toBeEnabled();
  });
  it.each(['https://external.invalid/map.png', '/api/map/tile/1/0/0.png', '/images/a.png?host=external'])(
    '不載入外部或 API 圖片 %s，明確顯示不可用', (source) => {
      render(<StaticTokyoMap asset={{ mobileSrc: source, desktopSrc: source }} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
