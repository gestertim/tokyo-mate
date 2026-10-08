import { useState } from 'react';

interface Props {
  onOpenPublic?: () => void;
  asset?: { mobileSrc: string; desktopSrc: string };
}

function isLocalImage(source: string): boolean {
  try {
    const url = new URL(source, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/images/') &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function StaticTokyoMap({ onOpenPublic, asset }: Props) {
  const [failedAsset, setFailedAsset] = useState<string>();
  const assetKey = asset && JSON.stringify([asset.mobileSrc, asset.desktopSrc]);
  const failed = asset && (!isLocalImage(asset.mobileSrc) || !isLocalImage(asset.desktopSrc) ||
    failedAsset === assetKey);
  const alt = '東京街區風格示意圖，非即時地圖或真實地理資料。';
  return <section aria-label="靜態東京風格示意圖">
    <p>示意圖</p>
    <div className="nearby-static-map-frame">
    {failed ? <p role="alert">地圖示意圖目前無法顯示，你仍可查看東京百科。</p> :
      asset ? <picture>
        <source media="(min-width: 768px)" srcSet={asset.desktopSrc} />
        <img src={asset.mobileSrc} alt={alt} onError={() => setFailedAsset(assetKey)} />
      </picture> :
    <svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label={alt}>
      <rect width="400" height="180" fill="#f4eee4" />
      <path d="M0 140 Q80 95 140 145 T280 135 T400 145" fill="none" stroke="#aac9d4" strokeWidth="20" />
      <path d="M30 30 H370 M40 80 H360 M100 10 V160 M210 10 V160 M320 10 V160"
        fill="none" stroke="#d7cbb9" strokeWidth="6" />
      <path d="M160 80 L180 30 L200 80 Z M170 80 V110 H190 V80" fill="#bb5b4e" />
    </svg>}
    </div>
    {!asset && <p>這是暫用風格示意，不是實際地圖，不含定位或導航資訊。</p>}
    {onOpenPublic && <button type="button" onClick={onOpenPublic}>查看東京百科</button>}
  </section>;
}
