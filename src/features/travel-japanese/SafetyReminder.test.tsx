import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SafetyReminder } from './SafetyReminder';

describe('SafetyReminder（Phase 7 US5，FR-035）', () => {
  it('元件存在於 DOM 且可見，使用語義化標記 role="note"', () => {
    render(<SafetyReminder />);
    const reminder = screen.getByRole('note');
    expect(reminder).toBeInTheDocument();
    expect(reminder).toBeVisible();
    expect(reminder).not.toHaveAttribute('aria-hidden', 'true');
    expect(reminder.textContent).toMatch(/翻譯僅供/);
  });
});
