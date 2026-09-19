import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { PhotoTranslatePhoto } from '../../types/photoTranslate';

type AcquisitionStatus = 'idle' | 'camera_denied' | 'unsupported';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface PhotoAcquisitionPanelProps {
  onPhotoAcquired: (photo: PhotoTranslatePhoto) => void;
}

export function PhotoAcquisitionPanel({ onPhotoAcquired }: PhotoAcquisitionPanelProps) {
  const [status, setStatus] = useState<AcquisitionStatus>('idle');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function handleCaptureClick() {
    // 僅在使用者按下「拍攝照片」時才查詢相機權限狀態，不在掛載時預先請求。
    if (typeof navigator.permissions?.query === 'function') {
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (result.state === 'denied') {
          setStatus('camera_denied');
          return;
        }
      } catch {
        // 瀏覽器不支援查詢相機權限狀態時，交由檔案輸入本身的原生流程處理。
      }
    }
    setStatus('idle');
    cameraInputRef.current?.click();
  }

  function handleGalleryClick() {
    setStatus('idle');
    galleryInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setStatus('unsupported');
      return;
    }
    try {
      const objectUrl = URL.createObjectURL(file);
      setStatus('idle');
      onPhotoAcquired({ objectUrl, fileName: file.name, mimeType: file.type });
    } catch {
      setStatus('unsupported');
    }
  }

  return (
    <section aria-labelledby="photo-acquisition-heading">
      <h3 id="photo-acquisition-heading">取得照片</h3>
      <p>拍照或選一張含文字的照片</p>
      {status === 'camera_denied' && <p role="alert">無法使用相機，你可以改用相簿照片</p>}
      {status === 'unsupported' && <p role="alert">這張照片無法使用，請重新拍攝或選擇其他照片</p>}
      <button type="button" onClick={() => void handleCaptureClick()}>
        {status === 'camera_denied' ? '再試一次' : '拍攝照片'}
      </button>
      <button type="button" onClick={handleGalleryClick}>從相簿選擇</button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        data-testid="photo-acquisition-camera-input"
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        data-testid="photo-acquisition-gallery-input"
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </section>
  );
}
