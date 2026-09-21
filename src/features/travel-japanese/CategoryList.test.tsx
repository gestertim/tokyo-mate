import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CategoryList } from './CategoryList';

describe('CategoryList（Phase 3 US1，情境瀏覽）', () => {
  it('渲染 7 個情境按鈕（原生 button，鍵盤可操作）', () => {
    render(<CategoryList onSelectCategory={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
    expect(screen.getByRole('button', { name: '機場' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '飯店' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '餐廳點餐' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '購物' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '交通' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '求助／緊急狀況' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '日常溝通' })).toBeInTheDocument();
  });

  it('點擊任一按鈕呼叫 onSelectCategory(category)', async () => {
    const user = userEvent.setup();
    const onSelectCategory = vi.fn();
    render(<CategoryList onSelectCategory={onSelectCategory} />);
    await user.click(screen.getByRole('button', { name: '機場' }));
    expect(onSelectCategory).toHaveBeenCalledWith('airport');
  });
});
