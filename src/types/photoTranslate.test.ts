import { describe, expect, it } from 'vitest';
import { isOcrStale, isTranslationDisplayStale } from './photoTranslate';
import type { OcrState, TranslationState } from './photoTranslate';

describe('isOcrStale', () => {
  it('回傳 true 當 ocr.forRegionVersion 為舊的 regionVersion', () => {
    const ocr: OcrState = { forRegionVersion: 1, status: 'success', sourceText: '入口' };
    expect(isOcrStale(ocr, 2)).toBe(true);
  });

  it('回傳 false 當 ocr.forRegionVersion 與目前 regionVersion 相同', () => {
    const ocr: OcrState = { forRegionVersion: 2, status: 'success', sourceText: '入口' };
    expect(isOcrStale(ocr, 2)).toBe(false);
  });

  it('回傳 false 當尚無任何 ocr 結果', () => {
    expect(isOcrStale(undefined, 1)).toBe(false);
  });
});

describe('isTranslationDisplayStale', () => {
  it('回傳 true 當 selectedTarget 與 displayed.target 不一致', () => {
    const translation: TranslationState = {
      selectedTarget: 'ja',
      forOcrText: '入口',
      status: 'success',
      displayed: { target: 'zh-TW', text: '入口' },
    };
    expect(isTranslationDisplayStale(translation)).toBe(true);
  });

  it('回傳 false 當 selectedTarget 與 displayed.target 一致', () => {
    const translation: TranslationState = {
      selectedTarget: 'zh-TW',
      forOcrText: '入口',
      status: 'success',
      displayed: { target: 'zh-TW', text: '入口' },
    };
    expect(isTranslationDisplayStale(translation)).toBe(false);
  });

  it('回傳 false 當尚無 displayed 結果', () => {
    const translation: TranslationState = {
      selectedTarget: 'ja',
      forOcrText: '入口',
      status: 'idle',
    };
    expect(isTranslationDisplayStale(translation)).toBe(false);
  });

  it('回傳 false 當 translation 尚未建立', () => {
    expect(isTranslationDisplayStale(undefined)).toBe(false);
  });
});
