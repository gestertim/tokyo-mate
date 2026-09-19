import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { PhotoTranslatePhoto, PhotoTranslateRegion } from '../../types/photoTranslate';

type RegionRect = PhotoTranslateRegion['rect'];
type Corner = 'nw' | 'ne' | 'sw' | 'se';

export interface RegionSelectorConfirmResult {
  rect: RegionRect;
  croppedObjectUrl: string;
}

interface RegionSelectorProps {
  photo: PhotoTranslatePhoto;
  onConfirm: (result: RegionSelectorConfirmResult) => void;
}

type DragState =
  | { mode: 'create'; anchor: { x: number; y: number } }
  | { mode: 'resize'; corner: Corner; startRect: RegionRect; anchor: { x: number; y: number } };

const MIN_SIZE = 1; // 最小 1 原圖像素，避免零面積選取被誤判為有效
const KEYBOARD_STEP = 8; // 鍵盤微調步進（原圖像素）

const HANDLE_LABELS: Record<Corner, string> = {
  nw: '調整左上角控點',
  ne: '調整右上角控點',
  sw: '調整左下角控點',
  se: '調整右下角控點',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function resizeRect(startRect: RegionRect, corner: Corner, dx: number, dy: number, bounds: { width: number; height: number }): RegionRect {
  let { x, y, width, height } = startRect;
  if (corner === 'nw' || corner === 'sw') {
    const newX = clamp(startRect.x + dx, 0, startRect.x + startRect.width - MIN_SIZE);
    width = startRect.width - (newX - startRect.x);
    x = newX;
  }
  if (corner === 'ne' || corner === 'se') {
    width = clamp(startRect.width + dx, MIN_SIZE, bounds.width - startRect.x);
  }
  if (corner === 'nw' || corner === 'ne') {
    const newY = clamp(startRect.y + dy, 0, startRect.y + startRect.height - MIN_SIZE);
    height = startRect.height - (newY - startRect.y);
    y = newY;
  }
  if (corner === 'sw' || corner === 'se') {
    height = clamp(startRect.height + dy, MIN_SIZE, bounds.height - startRect.y);
  }
  return { x, y, width, height };
}

function handleStyle(corner: Corner): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    width: 16,
    height: 16,
    padding: 0,
    border: '1px solid #2563eb',
    background: '#fff',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
  };
  switch (corner) {
    case 'nw':
      return { ...base, left: 0, top: 0, cursor: 'nwse-resize' };
    case 'ne':
      return { ...base, left: '100%', top: 0, cursor: 'nesw-resize' };
    case 'sw':
      return { ...base, left: 0, top: '100%', cursor: 'nesw-resize' };
    case 'se':
      return { ...base, left: '100%', top: '100%', cursor: 'nwse-resize' };
  }
}

export function RegionSelector({ photo, onConfirm }: RegionSelectorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [rect, setRect] = useState<RegionRect | null>(null);

  function handleImageLoad() {
    const image = imageRef.current;
    if (!image) return;
    setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
  }

  function toNatural(clientX: number, clientY: number): { x: number; y: number } {
    const wrapper = wrapperRef.current;
    if (!wrapper || !naturalSize) return { x: 0, y: 0 };
    const bounds = wrapper.getBoundingClientRect();
    const displayX = clamp(clientX - bounds.left, 0, bounds.width);
    const displayY = clamp(clientY - bounds.top, 0, bounds.height);
    const scaleX = naturalSize.width / bounds.width;
    const scaleY = naturalSize.height / bounds.height;
    return { x: displayX * scaleX, y: displayY * scaleY };
  }

  function toDisplayRect(naturalRect: RegionRect): { left: number; top: number; width: number; height: number } | null {
    const wrapper = wrapperRef.current;
    if (!wrapper || !naturalSize) return null;
    const bounds = wrapper.getBoundingClientRect();
    const scaleX = bounds.width / naturalSize.width;
    const scaleY = bounds.height / naturalSize.height;
    return {
      left: naturalRect.x * scaleX,
      top: naturalRect.y * scaleY,
      width: naturalRect.width * scaleX,
      height: naturalRect.height * scaleY,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!naturalSize) return;
    const point = toNatural(event.clientX, event.clientY);
    dragStateRef.current = { mode: 'create', anchor: point };
    setRect({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || !naturalSize) return;
    const point = toNatural(event.clientX, event.clientY);
    if (drag.mode === 'create') {
      const x = clamp(Math.min(drag.anchor.x, point.x), 0, naturalSize.width);
      const y = clamp(Math.min(drag.anchor.y, point.y), 0, naturalSize.height);
      const width = Math.abs(point.x - drag.anchor.x);
      const height = Math.abs(point.y - drag.anchor.y);
      setRect({ x, y, width, height });
    } else {
      const dx = point.x - drag.anchor.x;
      const dy = point.y - drag.anchor.y;
      setRect(resizeRect(drag.startRect, drag.corner, dx, dy, naturalSize));
    }
  }

  function handlePointerUp() {
    dragStateRef.current = null;
  }

  function handleHandlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, corner: Corner) {
    event.stopPropagation();
    if (!rect) return;
    const point = toNatural(event.clientX, event.clientY);
    dragStateRef.current = { mode: 'resize', corner, startRect: rect, anchor: point };
  }

  function handleHandleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, corner: Corner) {
    if (!naturalSize) return;
    let dx = 0;
    let dy = 0;
    switch (event.key) {
      case 'ArrowLeft':
        dx = -KEYBOARD_STEP;
        break;
      case 'ArrowRight':
        dx = KEYBOARD_STEP;
        break;
      case 'ArrowUp':
        dy = -KEYBOARD_STEP;
        break;
      case 'ArrowDown':
        dy = KEYBOARD_STEP;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    setRect((current) => (current ? resizeRect(current, corner, dx, dy, naturalSize) : current));
  }

  function handleConfirm() {
    if (!isValid || !rect || !imageRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imageRef.current, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedObjectUrl = URL.createObjectURL(blob);
      onConfirm({ rect, croppedObjectUrl });
    }, 'image/jpeg');
  }

  const isValid = !!rect && rect.width > 0 && rect.height > 0;
  const displayRect = rect ? toDisplayRect(rect) : null;

  return (
    <section aria-labelledby="region-selector-heading" data-testid="region-selector">
      <h3 id="region-selector-heading">選取要辨識的文字範圍</h3>
      <p>在照片上拖曳出要辨識的文字範圍</p>
      <div
        ref={wrapperRef}
        data-testid="region-selector-surface"
        style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          ref={imageRef}
          src={photo.objectUrl}
          alt="待選取的照片"
          draggable={false}
          onLoad={handleImageLoad}
          style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none' }}
        />
        {displayRect && (
          <div
            data-testid="region-selector-rect"
            style={{
              position: 'absolute',
              left: displayRect.left,
              top: displayRect.top,
              width: displayRect.width,
              height: displayRect.height,
              border: '2px solid #2563eb',
              boxSizing: 'border-box',
              background: 'rgba(37, 99, 235, 0.15)',
            }}
          >
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
              <button
                key={corner}
                type="button"
                aria-label={HANDLE_LABELS[corner]}
                data-testid={`region-selector-handle-${corner}`}
                onPointerDown={(event) => handleHandlePointerDown(event, corner)}
                onKeyDown={(event) => handleHandleKeyDown(event, corner)}
                style={handleStyle(corner)}
              />
            ))}
          </div>
        )}
      </div>
      {!isValid && (
        <p role="status" aria-live="polite">
          請框選要辨識的文字範圍
        </p>
      )}
      <button type="button" onClick={handleConfirm} disabled={!isValid}>
        確認選取區域
      </button>
    </section>
  );
}
