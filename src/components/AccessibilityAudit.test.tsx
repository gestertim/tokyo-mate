import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Modal } from './Modal';
import { StatusMessage } from './StatusMessage';
import { LiveDataStatus } from './LiveDataStatus';

const stylesDir = path.resolve(__dirname, '../styles');

describe('Accessibility audit（FR-025 觸控可用性／語意標籤／reduced-motion）', () => {
  it('Button／IconButton 皆為真實 <button type="button">，避免誤觸表單送出', () => {
    render(
      <>
        <Button>一般按鈕</Button>
        <IconButton aria-label="關閉">✕</IconButton>
      </>,
    );
    expect(screen.getByRole('button', { name: '一般按鈕' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: '關閉' })).toHaveAttribute('type', 'button');
  });

  it('Modal 具備 role="dialog" 與 aria-modal，並提供可鍵盤操作的關閉按鈕', () => {
    render(
      <Modal open onClose={() => {}}>
        內容
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: '關閉' })).toBeInTheDocument();
  });

  it('StatusMessage 預設使用 role="status"，錯誤情境可切換為 role="alert"，動態內容可被螢幕閱讀器播報', () => {
    const { rerender } = render(<StatusMessage>提示訊息</StatusMessage>);
    expect(screen.getByRole('status')).toHaveTextContent('提示訊息');
    rerender(<StatusMessage role="alert">錯誤訊息</StatusMessage>);
    expect(screen.getByRole('alert')).toHaveTextContent('錯誤訊息');
  });

  it('LiveDataStatus 使用 aria-live 播報即時狀態變化', () => {
    render(<LiveDataStatus status="uncertain" message="營業時間無法確認" />);
    const region = screen.getByText('資訊不確定').closest('[aria-live]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('global.css／variables.css 定義最小觸控尺寸與 prefers-reduced-motion 支援', () => {
    const variables = readFileSync(path.join(stylesDir, 'variables.css'), 'utf-8');
    const global = readFileSync(path.join(stylesDir, 'global.css'), 'utf-8');
    const components = readFileSync(path.join(stylesDir, 'components.css'), 'utf-8');

    expect(variables).toMatch(/--touch-target:\s*44px/);
    expect(global).toMatch(/min-height:\s*var\(--touch-target\)/);
    expect(components).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('focus-visible 樣式提供明顯鍵盤焦點指示', () => {
    const global = readFileSync(path.join(stylesDir, 'global.css'), 'utf-8');
    expect(global).toMatch(/:focus-visible[^{]*\{\s*outline:/);
  });

  it('components.css 定義平板 (>=768px) 與桌面 (>=1024px) 響應式展開、dialog 邊界與 safe-area', () => {
    const components = readFileSync(path.join(stylesDir, 'components.css'), 'utf-8');

    expect(components).toMatch(/@media\s*\(\s*min-width:\s*768px\s*\)/);
    expect(components).toMatch(/@media\s*\(\s*min-width:\s*1024px\s*\)/);
    expect(components).toMatch(/max-width:\s*768px/);
    expect(components).toMatch(/max-width:\s*980px/);
    expect(components).toMatch(/display-mode:\s*standalone/);
  });
});
