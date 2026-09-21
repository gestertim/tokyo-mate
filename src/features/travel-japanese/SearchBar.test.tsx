import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

describe('SearchBar（Phase 5 US3）', () => {
  it('搜尋輸入具備 <label>', () => {
    render(<SearchBar query="" onQueryChange={vi.fn()} />);
    expect(screen.getByLabelText('搜尋繁中或日文關鍵字')).toBeInTheDocument();
  });

  it('輸入變化呼叫 onQueryChange', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<SearchBar query="" onQueryChange={onQueryChange} />);
    await user.type(screen.getByLabelText('搜尋繁中或日文關鍵字'), 'a');
    expect(onQueryChange).toHaveBeenCalledWith('a');
  });

  it('尚未輸入時顯示中性提示', () => {
    render(<SearchBar query="" onQueryChange={vi.fn()} />);
    expect(screen.getByText('輸入繁中或日文關鍵字以搜尋')).toBeInTheDocument();
  });

  it('已輸入時不顯示中性提示', () => {
    render(<SearchBar query="護照" onQueryChange={vi.fn()} />);
    expect(screen.queryByText('輸入繁中或日文關鍵字以搜尋')).not.toBeInTheDocument();
  });
});
