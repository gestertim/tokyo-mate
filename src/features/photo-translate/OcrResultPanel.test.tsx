import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OcrResultPanel } from './OcrResultPanel';
import type { OcrState } from '../../types/photoTranslate';

const CROPPED_URL = 'blob:mock-cropped';

function renderPanel(ocr: OcrState) {
  const onRetryOcr = vi.fn();
  const onReselectRegion = vi.fn();
  const onRecapture = vi.fn();
  const onReselectPhoto = vi.fn();
  render(
    <OcrResultPanel
      croppedObjectUrl={CROPPED_URL}
      ocr={ocr}
      onRetryOcr={onRetryOcr}
      onReselectRegion={onReselectRegion}
      onRecapture={onRecapture}
      onReselectPhoto={onReselectPhoto}
    />,
  );
  return { onRetryOcr, onReselectRegion, onRecapture, onReselectPhoto };
}

describe('OcrResultPanel（Phase 5 OCR Frontend Integration, FR-004/FR-006/FR-009）', () => {
  it('processing 狀態顯示辨識中提示與「重新選取區域」，不顯示原文或翻譯區', () => {
    renderPanel({ forRegionVersion: 1, status: 'processing' });
    expect(screen.getByText('正在辨識文字…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新選取區域' })).toBeInTheDocument();
    expect(screen.queryByText('辨識原文')).not.toBeInTheDocument();
    expect(screen.queryByText('翻譯結果')).not.toBeInTheDocument();
  });

  it('success 狀態顯示 A 選取區域／B 辨識原文／C 尚未產生翻譯', () => {
    renderPanel({ forRegionVersion: 1, status: 'success', sourceText: '牛丼並盛 490円' });
    expect(screen.getByAltText('已選取的照片區域')).toHaveAttribute('src', CROPPED_URL);
    expect(screen.getByText('辨識原文')).toBeInTheDocument();
    expect(screen.getByText('牛丼並盛 490円')).toBeInTheDocument();
    expect(screen.getByText('翻譯結果')).toBeInTheDocument();
    expect(screen.getByText(/尚未產生翻譯/)).toBeInTheDocument();
  });

  it('success 狀態提供「重新選取區域」action', async () => {
    const user = userEvent.setup();
    const { onReselectRegion } = renderPanel({ forRegionVersion: 1, status: 'success', sourceText: '入口' });
    await user.click(screen.getByRole('button', { name: '重新選取區域' }));
    expect(onReselectRegion).toHaveBeenCalledTimes(1);
  });

  it('no_reliable_text 狀態顯示一般化訊息、保留照片、提供三個 recovery action，不顯示猜測文字或翻譯區', () => {
    renderPanel({ forRegionVersion: 1, status: 'no_reliable_text' });
    expect(screen.getByRole('alert')).toHaveTextContent('沒有辨識到可靠的文字');
    expect(screen.getByAltText('已選取的照片區域')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新選取區域' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新拍攝' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新選擇照片' })).toBeInTheDocument();
    expect(screen.queryByText('翻譯結果')).not.toBeInTheDocument();
    expect(screen.queryByText('辨識原文')).not.toBeInTheDocument();
  });

  it('no_reliable_text 各 action 觸發對應 callback', async () => {
    const user = userEvent.setup();
    const { onReselectRegion, onRecapture, onReselectPhoto } = renderPanel({
      forRegionVersion: 1,
      status: 'no_reliable_text',
    });
    await user.click(screen.getByRole('button', { name: '重新選取區域' }));
    await user.click(screen.getByRole('button', { name: '重新拍攝' }));
    await user.click(screen.getByRole('button', { name: '重新選擇照片' }));
    expect(onReselectRegion).toHaveBeenCalledTimes(1);
    expect(onRecapture).toHaveBeenCalledTimes(1);
    expect(onReselectPhoto).toHaveBeenCalledTimes(1);
  });

  it('failure 狀態顯示一般化錯誤訊息與「重試辨識」，不顯示 provider 錯誤細節或翻譯區', () => {
    renderPanel({ forRegionVersion: 1, status: 'failure' });
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveTextContent(/OpenAI|openai|stack|Error:/i);
    expect(screen.getByRole('button', { name: '重試辨識' })).toBeInTheDocument();
    expect(screen.queryByText('翻譯結果')).not.toBeInTheDocument();
  });

  it('failure 狀態觸發重試 callback', async () => {
    const user = userEvent.setup();
    const { onRetryOcr } = renderPanel({ forRegionVersion: 1, status: 'failure' });
    await user.click(screen.getByRole('button', { name: '重試辨識' }));
    expect(onRetryOcr).toHaveBeenCalledTimes(1);
  });
});
