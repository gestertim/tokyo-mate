// Phase 1 shared runtime state types for Photo Translate (spec 002).
// See specs/002-photo-translate/data-model.md for authoritative semantics.

export type PhotoTranslatePhase =
  | 'acquisition'
  | 'region_selection'
  | 'ocr_processing'
  | 'ocr_result'
  | 'translation_result'
  | 'error';

export type PhotoTranslateTargetLanguage = 'zh-TW' | 'ja';

export interface PhotoTranslatePhoto {
  objectUrl: string;
  fileName: string;
  mimeType: string;
}

export interface PhotoTranslateRegion {
  version: number;
  rect: { x: number; y: number; width: number; height: number };
  croppedObjectUrl: string;
}

export interface OcrState {
  forRegionVersion: number;
  status: 'processing' | 'success' | 'no_reliable_text' | 'failure';
  sourceText?: string;
}

export interface TranslationState {
  selectedTarget: PhotoTranslateTargetLanguage;
  forOcrText: string;
  status: 'idle' | 'translating' | 'success' | 'same_language' | 'failure';
  displayed?: {
    target: PhotoTranslateTargetLanguage;
    text?: string;
  };
}

export interface SpeechState {
  forTarget: PhotoTranslateTargetLanguage;
  status: 'ready' | 'playing' | 'completed' | 'failure';
}

export interface PhotoTranslateTaskState {
  phase: PhotoTranslatePhase;
  photo?: PhotoTranslatePhoto;
  regionVersion: number;
  region?: PhotoTranslateRegion;
  ocr?: OcrState;
  translation?: TranslationState;
  speech?: SpeechState;
}

/** 判斷 ocr 結果是否因重新選取區域而過期（regionVersion 已遞增）。 */
export function isOcrStale(ocr: OcrState | undefined, regionVersion: number): boolean {
  if (!ocr) {
    return false;
  }
  return ocr.forRegionVersion !== regionVersion;
}

/** 判斷目前顯示的翻譯結果是否與使用者當下選擇的 target 不一致（target 切換復原狀態）。 */
export function isTranslationDisplayStale(translation: TranslationState | undefined): boolean {
  if (!translation?.displayed) {
    return false;
  }
  return translation.displayed.target !== translation.selectedTarget;
}
