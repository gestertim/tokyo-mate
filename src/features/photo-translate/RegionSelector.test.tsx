import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegionSelector } from './RegionSelector';
import type { PhotoTranslatePhoto } from '../../types/photoTranslate';

const PHOTO: PhotoTranslatePhoto = {
  objectUrl: 'blob:mock-photo',
  fileName: 'menu.jpg',
  mimeType: 'image/jpeg',
};

// 顯示尺寸 500x400，原圖 1000x800 → scale factor 2（雙軸一致，避免座標換算誤差）
function mountLoadedSelector(onConfirm = vi.fn()) {
  render(<RegionSelector photo={PHOTO} onConfirm={onConfirm} />);
  const surface = screen.getByTestId('region-selector-surface');
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 500,
    height: 400,
    right: 500,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  const image = screen.getByAltText('待選取的照片');
  Object.defineProperty(image, 'naturalWidth', { value: 1000, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: 800, configurable: true });
  fireEvent.load(image);
  return { surface, image, onConfirm };
}

function dragCreateSelection(surface: HTMLElement) {
  // 顯示座標 (100,50)→(300,250)，換算原圖座標 (200,100)，寬高 400x400
  fireEvent.pointerDown(surface, { clientX: 100, clientY: 50, pointerId: 1 });
  fireEvent.pointerMove(surface, { clientX: 300, clientY: 250, pointerId: 1 });
  fireEvent.pointerUp(surface, { clientX: 300, clientY: 250, pointerId: 1 });
}

describe('RegionSelector（Phase 3 Region Selection, FR-003/FR-008/FR-019）', () => {
  let getContextMock: ReturnType<typeof vi.fn>;
  let toBlobMock: ReturnType<typeof vi.fn>;
  let drawImageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    drawImageMock = vi.fn();
    getContextMock = vi.fn(() => ({ drawImage: drawImageMock }));
    toBlobMock = vi.fn(function toBlob(this: HTMLCanvasElement, callback: BlobCallback) {
      callback(new Blob(['fake-crop-bytes'], { type: 'image/jpeg' }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContextMock as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlobMock as never);
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-cropped'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('未拖曳出任何選取時，「確認選取區域」保持 disabled 並顯示提示', () => {
    mountLoadedSelector();
    expect(screen.getByRole('button', { name: '確認選取區域' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('請框選要辨識的文字範圍');
  });

  it('零面積選取（僅點擊未拖曳）時，「確認選取區域」保持 disabled', () => {
    const { surface } = mountLoadedSelector();
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(screen.getByRole('button', { name: '確認選取區域' })).toBeDisabled();
  });

  it('Pointer 事件可建立矩形選取框，且座標正確換算為原圖像素', () => {
    const { surface } = mountLoadedSelector();
    dragCreateSelection(surface);
    const rectEl = screen.getByTestId('region-selector-rect');
    expect(rectEl.style.left).toBe('100px');
    expect(rectEl.style.top).toBe('50px');
    expect(rectEl.style.width).toBe('200px');
    expect(rectEl.style.height).toBe('200px');
    expect(screen.getByRole('button', { name: '確認選取區域' })).not.toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('可透過拖曳控點調整既有選取框（右下角控點外拉放大範圍）', () => {
    const { surface } = mountLoadedSelector();
    dragCreateSelection(surface);
    const seHandle = screen.getByTestId('region-selector-handle-se');
    fireEvent.pointerDown(seHandle, { clientX: 300, clientY: 250, pointerId: 2 });
    fireEvent.pointerMove(surface, { clientX: 400, clientY: 350, pointerId: 2 });
    fireEvent.pointerUp(surface, { clientX: 400, clientY: 350, pointerId: 2 });
    const rectEl = screen.getByTestId('region-selector-rect');
    // 顯示座標右下角從 (300,250) 拉到 (400,350) → 原圖增加 200x200 → 顯示增加 100x100
    expect(rectEl.style.width).toBe('300px');
    expect(rectEl.style.height).toBe('300px');
  });

  it('鍵盤方向鍵可微調選取框（聚焦控點後方向鍵調整邊界）', () => {
    const { surface } = mountLoadedSelector();
    dragCreateSelection(surface);
    const seHandle = screen.getByTestId('region-selector-handle-se');
    seHandle.focus();
    fireEvent.keyDown(seHandle, { key: 'ArrowRight' });
    const rectEl = screen.getByTestId('region-selector-rect');
    // 原圖右邊界 +8 → 顯示座標 +4
    expect(rectEl.style.width).toBe('204px');
  });

  it('確認選取區域後，以 canvas 依原圖座標裁切並回傳 croppedObjectUrl', () => {
    const onConfirm = vi.fn();
    const { surface } = mountLoadedSelector(onConfirm);
    dragCreateSelection(surface);
    fireEvent.click(screen.getByRole('button', { name: '確認選取區域' }));
    expect(drawImageMock).toHaveBeenCalledWith(expect.anything(), 200, 100, 400, 400, 0, 0, 400, 400);
    expect(onConfirm).toHaveBeenCalledWith({
      rect: { x: 200, y: 100, width: 400, height: 400 },
      croppedObjectUrl: 'blob:mock-cropped',
    });
  });
});
