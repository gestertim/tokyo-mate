import type { OcrState, PhotoTranslateTargetLanguage, TranslationState } from '../../types/photoTranslate';
import { TranslationPanel } from './TranslationPanel';

interface OcrResultPanelProps {
  croppedObjectUrl: string;
  ocr: OcrState;
  translation?: TranslationState;
  onSelectTranslationTarget?: (target: PhotoTranslateTargetLanguage) => void;
  onRetryTranslate?: () => void;
  onRetryOcr: () => void;
  onReselectRegion: () => void;
  onRecapture: () => void;
  onReselectPhoto: () => void;
}

export function OcrResultPanel({
  croppedObjectUrl,
  ocr,
  translation,
  onSelectTranslationTarget,
  onRetryTranslate,
  onRetryOcr,
  onReselectRegion,
  onRecapture,
  onReselectPhoto,
}: OcrResultPanelProps) {
  return (
    <section aria-labelledby="ocr-result-heading" data-testid="ocr-result-panel" data-ocr-status={ocr.status}>
      <h3 id="ocr-result-heading">辨識結果</h3>

      {ocr.status === 'processing' && (
        <>
          <p>正在辨識文字…</p>
          <button type="button" onClick={onReselectRegion}>
            重新選取區域
          </button>
        </>
      )}

      {ocr.status !== 'processing' && (
        <section aria-labelledby="ocr-region-heading">
          <h4 id="ocr-region-heading">選取的照片區域</h4>
          <img src={croppedObjectUrl} alt="已選取的照片區域" />
        </section>
      )}

      {ocr.status === 'success' && (
        <>
          <section aria-labelledby="ocr-source-text-heading">
            <h4 id="ocr-source-text-heading">辨識原文</h4>
            <p>{ocr.sourceText}</p>
          </section>
          {onSelectTranslationTarget && onRetryTranslate ? (
            <TranslationPanel translation={translation} onSelectTarget={onSelectTranslationTarget} onRetryTranslate={onRetryTranslate} />
          ) : (
            <section aria-labelledby="translation-result-heading">
              <h4 id="translation-result-heading">翻譯結果</h4>
              <p>尚未產生翻譯，請選擇繁體中文或日本語以取得翻譯</p>
            </section>
          )}
          <button type="button" onClick={onReselectRegion}>
            重新選取區域
          </button>
        </>
      )}

      {ocr.status === 'no_reliable_text' && (
        <>
          <p role="alert">沒有辨識到可靠的文字，你可以重新選取範圍或更換照片。</p>
          <button type="button" onClick={onReselectRegion}>
            重新選取區域
          </button>
          <button type="button" onClick={onRecapture}>
            重新拍攝
          </button>
          <button type="button" onClick={onReselectPhoto}>
            重新選擇照片
          </button>
        </>
      )}

      {ocr.status === 'failure' && (
        <>
          <p role="alert">辨識服務暫時無法使用，請稍後重試辨識，或重新選取範圍。</p>
          <button type="button" onClick={onRetryOcr}>
            重試辨識
          </button>
        </>
      )}
    </section>
  );
}
