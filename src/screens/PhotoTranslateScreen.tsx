import { useEffect, useState } from 'react';
import { PhotoAcquisitionPanel } from '../features/photo-translate/PhotoAcquisitionPanel';
import { RegionSelector } from '../features/photo-translate/RegionSelector';
import type { RegionSelectorConfirmResult } from '../features/photo-translate/RegionSelector';
import { OcrResultPanel } from '../features/photo-translate/OcrResultPanel';
import { requestPhotoOcr, requestPhotoTranslate } from '../services/api';
import { isOcrStale } from '../types/photoTranslate';
import type { PhotoTranslateTargetLanguage, PhotoTranslateTaskState } from '../types/photoTranslate';

const INITIAL_TASK: PhotoTranslateTaskState = { phase: 'acquisition', regionVersion: 0 };

interface PhotoTranslateScreenProps {
  onBack?: () => void;
}

/** 將 RegionSelector 產生的裁切預覽 blob URL 還原為 API 所需的 base64 data URL。 */
async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('讀取影像失敗'));
    reader.readAsDataURL(blob);
  });
}

export function PhotoTranslateScreen({ onBack }: PhotoTranslateScreenProps) {
  const [task, setTask] = useState<PhotoTranslateTaskState>(INITIAL_TASK);

  // 依 FR-013／FR-014：原始照片 object URL 於更換照片、更換為新照片或離開功能（卸載）時即時 revoke，不長期保留任務外資源。
  useEffect(() => {
    const url = task.photo?.objectUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [task.photo?.objectUrl]);

  // 依 FR-013／FR-014：裁切區域 object URL 於重新選取確認新選取、更換照片或離開功能時即時 revoke；尚未確認新選取前不提前 revoke。
  useEffect(() => {
    const url = task.region?.croppedObjectUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [task.region?.croppedObjectUrl]);

  function handleChangePhoto() {
    // regionVersion 不得於「更換照片」時重置為 0：若重置，新照片的首次確認選取會重新產生與舊照片相同的
    // regionVersion 數值，導致舊照片延遲抵達的 OCR/翻譯回應被誤判為仍對應目前（新照片）task 而復活顯示。
    // 因此僅重置 phase/photo/region/ocr/translation/speech，regionVersion 沿用既有累計值繼續遞增，
    // 確保同一個 PhotoTranslateScreen 生命週期內，regionVersion 對任何一次確認選取皆為全域唯一。
    setTask((current) => ({ ...INITIAL_TASK, regionVersion: current.regionVersion }));
  }

  function handleReselectRegion() {
    // 依 FR-016：一旦開始重新選取，立即（依 phase 切換）隱藏舊 OCR 結果，不等待新選取確認。
    setTask((current) => ({ ...current, phase: 'region_selection' }));
  }

  async function runOcr(regionVersionAtRequest: number, croppedObjectUrl: string) {
    try {
      const imageDataUrl = await blobUrlToDataUrl(croppedObjectUrl);
      const result = await requestPhotoOcr(imageDataUrl, regionVersionAtRequest);
      setTask((current) => {
        if (current.regionVersion !== regionVersionAtRequest) return current; // stale：目前已切換到較新的選取區域，捨棄此結果
        return {
          ...current,
          phase: 'ocr_result',
          ocr: result.reliableTextFound
            ? { forRegionVersion: regionVersionAtRequest, status: 'success', sourceText: result.sourceText }
            : { forRegionVersion: regionVersionAtRequest, status: 'no_reliable_text' },
        };
      });
    } catch {
      setTask((current) => {
        if (current.regionVersion !== regionVersionAtRequest) return current;
        return { ...current, phase: 'error', ocr: { forRegionVersion: regionVersionAtRequest, status: 'failure' } };
      });
    }
  }

  function handleConfirmRegion({ rect, croppedObjectUrl }: RegionSelectorConfirmResult) {
    const nextRegionVersion = task.regionVersion + 1;
    setTask((current) => ({
      ...current,
      phase: 'ocr_processing',
      regionVersion: nextRegionVersion,
      region: { version: nextRegionVersion, rect, croppedObjectUrl },
      ocr: { forRegionVersion: nextRegionVersion, status: 'processing' },
      translation: undefined,
      speech: undefined,
    }));
    void runOcr(nextRegionVersion, croppedObjectUrl);
  }

  function handleRetryOcr() {
    const region = task.region;
    if (!region) return;
    setTask((current) => ({
      ...current,
      phase: 'ocr_processing',
      ocr: { forRegionVersion: region.version, status: 'processing' },
      translation: undefined,
      speech: undefined,
    }));
    void runOcr(region.version, region.croppedObjectUrl);
  }

  // 依 data-model.md §3：翻譯回應僅在仍對應目前 regionVersion 與使用者當下選擇的 target 時才可套用，避免 out-of-order / stale 結果復活。
  async function runTranslate(regionVersionAtRequest: number, target: PhotoTranslateTargetLanguage, sourceText: string) {
    try {
      const result = await requestPhotoTranslate(sourceText, target);
      setTask((current) => {
        if (current.regionVersion !== regionVersionAtRequest) return current;
        if (current.translation?.selectedTarget !== target) return current;
        return {
          ...current,
          phase: 'translation_result',
          translation: {
            selectedTarget: target,
            forOcrText: sourceText,
            status: result.sameLanguage ? 'same_language' : 'success',
            displayed: result.sameLanguage ? { target } : { target, text: result.translatedText },
          },
        };
      });
    } catch {
      setTask((current) => {
        if (current.regionVersion !== regionVersionAtRequest) return current;
        if (current.translation?.selectedTarget !== target) return current;
        return {
          ...current,
          phase: 'translation_result',
          translation: current.translation ? { ...current.translation, status: 'failure' } : current.translation,
        };
      });
    }
  }

  function handleSelectTranslationTarget(target: PhotoTranslateTargetLanguage) {
    const sourceText = task.ocr?.sourceText;
    if (!sourceText) return;
    const regionVersionAtRequest = task.regionVersion;
    setTask((current) => ({
      ...current,
      phase: 'translation_result',
      translation: {
        selectedTarget: target,
        forOcrText: sourceText,
        status: 'translating',
        displayed: current.translation?.displayed, // 保留切換前內容供失敗復原，UI 不得誤呈現為新 target 結果
      },
    }));
    void runTranslate(regionVersionAtRequest, target, sourceText);
  }

  function handleRetryTranslate() {
    const translation = task.translation;
    const sourceText = task.ocr?.sourceText;
    if (!translation || !sourceText) return;
    const regionVersionAtRequest = task.regionVersion;
    const target = translation.selectedTarget;
    setTask((current) => ({
      ...current,
      translation: current.translation ? { ...current.translation, status: 'translating' } : current.translation,
    }));
    void runTranslate(regionVersionAtRequest, target, sourceText);
  }

  const showOcrResult =
    !!task.ocr &&
    !isOcrStale(task.ocr, task.regionVersion) &&
    (task.phase === 'ocr_processing' ||
      task.phase === 'ocr_result' ||
      task.phase === 'translation_result' ||
      task.phase === 'error');

  return (
    <section
      aria-labelledby="photo-translate-heading"
      data-testid="photo-translate-screen"
      data-phase={task.phase}
      data-region-version={task.regionVersion}
    >
      {onBack && (
        <button type="button" onClick={onBack}>
          返回首頁
        </button>
      )}
      <h2 id="photo-translate-heading">拍照翻譯</h2>
      {task.phase === 'acquisition' && (
        <PhotoAcquisitionPanel
          onPhotoAcquired={(photo) => setTask((current) => ({ ...current, phase: 'region_selection', photo }))}
        />
      )}
      {task.phase === 'region_selection' && task.photo && (
        <>
          <RegionSelector photo={task.photo} onConfirm={handleConfirmRegion} />
          <button type="button" onClick={handleChangePhoto}>
            更換照片
          </button>
        </>
      )}
      {showOcrResult && task.ocr && (
        <OcrResultPanel
          croppedObjectUrl={task.region?.croppedObjectUrl ?? ''}
          ocr={task.ocr}
          translation={task.translation}
          onSelectTranslationTarget={handleSelectTranslationTarget}
          onRetryTranslate={handleRetryTranslate}
          onRetryOcr={handleRetryOcr}
          onReselectRegion={handleReselectRegion}
          onRecapture={handleChangePhoto}
          onReselectPhoto={handleChangePhoto}
        />
      )}
    </section>
  );
}
