import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoTranslateScreen } from './PhotoTranslateScreen';
import { requestPhotoOcr, requestPhotoTranslate, generateSpeech } from '../services/api';
import type { PhotoOcrResult, PhotoTranslateResult } from '../services/api';

vi.mock('../services/api', () => ({
  requestPhotoOcr: vi.fn(),
  requestPhotoTranslate: vi.fn(),
  generateSpeech: vi.fn(),
}));

let mockObjectUrlCounter = 0;

beforeEach(() => {
  mockObjectUrlCounter = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => ({ drawImage: vi.fn() })) as never,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(['fake-crop-bytes'], { type: 'image/jpeg' }));
  } as never);
  // 依序產生不重複 object URL，供 Phase 10 revoke 測試辨識「哪一個 URL 被 revoke」。
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => `blob:mock-${++mockObjectUrlCounter}`),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      blob: async () => new Blob(['fake-crop-bytes'], { type: 'image/jpeg' }),
    })),
  );
  vi.mocked(requestPhotoOcr).mockReset();
  // 預設回傳永不 resolve 的 Promise，避免未設定期望值的測試意外觸發非同步狀態轉換。
  vi.mocked(requestPhotoOcr).mockImplementation(() => new Promise<PhotoOcrResult>(() => {}));
  vi.mocked(requestPhotoTranslate).mockReset();
  vi.mocked(requestPhotoTranslate).mockImplementation(() => new Promise<PhotoTranslateResult>(() => {}));
  vi.mocked(generateSpeech).mockReset();
  vi.mocked(generateSpeech).mockImplementation(() => new Promise(() => {}));
  if (typeof window.HTMLMediaElement !== 'undefined') {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function acquirePhoto() {
  render(<PhotoTranslateScreen />);
  const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
  const file = new File(['fake-bytes'], 'menu.jpg', { type: 'image/jpeg' });
  fireEvent.change(galleryInput, { target: { files: [file] } });
}

function loadRegionSelectorImage() {
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
  return surface;
}

function confirmValidSelection() {
  const surface = loadRegionSelectorImage();
  fireEvent.pointerDown(surface, { clientX: 100, clientY: 50, pointerId: 1 });
  fireEvent.pointerMove(surface, { clientX: 300, clientY: 250, pointerId: 1 });
  fireEvent.pointerUp(surface, { clientX: 300, clientY: 250, pointerId: 1 });
  fireEvent.click(screen.getByRole('button', { name: '確認選取區域' }));
}

/** 走完 拍照/選圖 → 選取區域 → OCR 成功，回傳可靠 sourceText 供後續 Phase 7 翻譯情境測試使用。 */
async function completeOcrSuccess(sourceText: string) {
  vi.mocked(requestPhotoOcr).mockResolvedValueOnce({
    reliableTextFound: true,
    sourceText,
    regionVersion: 1,
  });
  acquirePhoto();
  confirmValidSelection();
  await waitFor(() => expect(screen.getByText(sourceText)).toBeInTheDocument());
}

describe('PhotoTranslateScreen（Phase 2 Photo Acquisition 轉場, FR-002）', () => {
  it('預設 phase 為 acquisition 並渲染 PhotoAcquisitionPanel', () => {
    render(<PhotoTranslateScreen />);
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'acquisition');
    expect(screen.getByRole('button', { name: '拍攝照片' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '從相簿選擇' })).toBeInTheDocument();
  });

  it('取得照片後轉為 region_selection', () => {
    render(<PhotoTranslateScreen />);
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    const file = new File(['fake-bytes'], 'menu.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [file] } });
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'region_selection');
    expect(screen.queryByRole('button', { name: '拍攝照片' })).not.toBeInTheDocument();
  });
});

describe('PhotoTranslateScreen（Phase 3 Region Selection 轉場, FR-003/FR-008/FR-019）', () => {
  it('region_selection 渲染 RegionSelector', () => {
    acquirePhoto();
    expect(screen.getByTestId('region-selector')).toBeInTheDocument();
  });

  it('確認選取觸發 regionVersion++ 並轉場至 ocr_processing', () => {
    acquirePhoto();
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '0');
    confirmValidSelection();
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'ocr_processing');
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '1');
  });

  it('無效選取（未拖曳）不得觸發轉場', () => {
    acquirePhoto();
    loadRegionSelectorImage();
    expect(screen.getByRole('button', { name: '確認選取區域' })).toBeDisabled();
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'region_selection');
  });

  it('「更換照片」回到 acquisition 並清除既有 photo/region/ocr/translation/speech', () => {
    acquirePhoto();
    loadRegionSelectorImage();
    fireEvent.click(screen.getByRole('button', { name: '更換照片' }));
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'acquisition');
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '0');
    expect(screen.getByRole('button', { name: '拍攝照片' })).toBeInTheDocument();
    expect(screen.queryByTestId('region-selector')).not.toBeInTheDocument();
  });
});

describe('PhotoTranslateScreen（Phase 5 OCR Frontend Integration, FR-004/FR-006/FR-009/FR-016）', () => {
  it('確認選取後進入 ocr_processing 並呼叫 requestPhotoOcr(imageDataUrl, regionVersion)', async () => {
    acquirePhoto();
    confirmValidSelection();
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'ocr_processing');
    expect(screen.getByText('正在辨識文字…')).toBeInTheDocument();
    await waitFor(() =>
      expect(requestPhotoOcr).toHaveBeenCalledWith(expect.stringContaining('data:'), 1),
    );
  });

  it('OCR 成功時渲染三分區，C 區提供目標語言選擇（Phase 7 起 C 區改為可互動的翻譯目標選擇，尚未選擇前不產生翻譯內容）', async () => {
    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({
      reliableTextFound: true,
      sourceText: '入口 270円',
      regionVersion: 1,
    });
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() =>
      expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'ocr_result'),
    );
    expect(screen.getByText('入口 270円')).toBeInTheDocument();
    expect(screen.getByText(/尚未產生翻譯/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '繁體中文' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '日本語' })).toBeInTheDocument();
  });

  it('reliableTextFound:false 時顯示 no_reliable_text 恢復路徑，不產生猜測文字', async () => {
    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({ reliableTextFound: false, regionVersion: 1 });
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('沒有辨識到可靠的文字'));
    expect(screen.getByRole('button', { name: '重新選取區域' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新拍攝' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新選擇照片' })).toBeInTheDocument();
  });

  it('OCR request 失敗時顯示一般化訊息與重試辨識，不顯示 provider 錯誤', async () => {
    vi.mocked(requestPhotoOcr).mockRejectedValueOnce({
      code: 'AI_SERVICE_UNAVAILABLE',
      userTitle: '辨識服務暫時無法使用',
      userMessage: '目前無法完成文字辨識。',
      actionableStep: '請稍後重試辨識，或重新選取範圍。',
    });
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() =>
      expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'error'),
    );
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveTextContent(/OpenAI|stack/i);
    expect(screen.getByRole('button', { name: '重試辨識' })).toBeInTheDocument();
  });

  it('失敗後點擊「重試辨識」重新呼叫 requestPhotoOcr 並可成功', async () => {
    vi.mocked(requestPhotoOcr).mockRejectedValueOnce(new Error('boom'));
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() => expect(screen.getByRole('button', { name: '重試辨識' })).toBeInTheDocument());

    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({
      reliableTextFound: true,
      sourceText: '再試一次成功',
      regionVersion: 1,
    });
    fireEvent.click(screen.getByRole('button', { name: '重試辨識' }));
    await waitFor(() => expect(screen.getByText('再試一次成功')).toBeInTheDocument());
  });

  it('「重新選取區域」立即隱藏舊 OCR 結果並回到 region_selection', async () => {
    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({
      reliableTextFound: true,
      sourceText: '舊結果',
      regionVersion: 1,
    });
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() => expect(screen.getByText('舊結果')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'region_selection');
    expect(screen.queryByText('舊結果')).not.toBeInTheDocument();
    expect(screen.getByTestId('region-selector')).toBeInTheDocument();
  });

  it('stale 保護：切換到較新 regionVersion 後，舊 request 延遲成功也不得復活為目前結果（out-of-order response）', async () => {
    let resolveFirst: (value: PhotoOcrResult) => void = () => {};
    const firstCall = new Promise<PhotoOcrResult>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(requestPhotoOcr).mockImplementationOnce(() => firstCall);

    acquirePhoto();
    confirmValidSelection(); // regionVersion -> 1，request 尚未 resolve
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '1');

    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({
      reliableTextFound: true,
      sourceText: '新結果',
      regionVersion: 2,
    });
    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    confirmValidSelection(); // regionVersion -> 2，立即成功

    await waitFor(() => expect(screen.getByText('新結果')).toBeInTheDocument());
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '2');

    await act(async () => {
      resolveFirst({ reliableTextFound: true, sourceText: '過期結果', regionVersion: 1 });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText('過期結果')).not.toBeInTheDocument();
    expect(screen.getByText('新結果')).toBeInTheDocument();
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '2');
  });
});

describe('PhotoTranslateScreen（Phase 7 Translation Frontend State / Recovery, FR-005/FR-006/FR-010/FR-017/FR-018/FR-020）', () => {
  it('zh-TW target 翻譯成功顯示翻譯文字，selectedTarget 與 displayed.target 一致', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    expect(requestPhotoTranslate).toHaveBeenCalledWith('入口 270円', 'zh-TW');
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());
  });

  it('ja target 翻譯成功顯示翻譯文字，selectedTarget 與 displayed.target 一致', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入り口 270円',
      targetLanguage: 'ja',
    });
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    expect(requestPhotoTranslate).toHaveBeenCalledWith('入口 270円', 'ja');
    await waitFor(() => expect(screen.getByText('入り口 270円')).toBeInTheDocument());
  });

  it('zh-TW same-language：不產生假翻譯，顯示提示並可切換至日本語', async () => {
    await completeOcrSuccess('你好');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({ sameLanguage: true, targetLanguage: 'zh-TW' });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText(/辨識原文已是繁體中文/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /切換至日本語/ })).toBeInTheDocument();
  });

  it('ja same-language：不產生假翻譯，顯示提示並可切換至繁體中文', async () => {
    await completeOcrSuccess('こんにちは');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({ sameLanguage: true, targetLanguage: 'ja' });
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    await waitFor(() => expect(screen.getByText(/辨識原文已是日本語/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /切換至繁體中文/ })).toBeInTheDocument();
  });

  it('切換 target 使用既有 OCR 原文重新翻譯，不重新 OCR', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());
    expect(requestPhotoOcr).toHaveBeenCalledTimes(1);

    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入り口 270円',
      targetLanguage: 'ja',
    });
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    expect(requestPhotoTranslate).toHaveBeenLastCalledWith('入口 270円', 'ja');
    await waitFor(() => expect(screen.getByText('入り口 270円')).toBeInTheDocument());
    expect(requestPhotoOcr).toHaveBeenCalledTimes(1); // 切換 target 不重新 OCR
  });

  it('切換 target 立即隱藏舊翻譯內容，避免誤認為新 target 結果', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    let resolveJa: (value: PhotoTranslateResult) => void = () => {};
    vi.mocked(requestPhotoTranslate).mockImplementationOnce(
      () => new Promise<PhotoTranslateResult>((resolve) => {
        resolveJa = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    expect(screen.queryByText('入口 270日圓')).not.toBeInTheDocument();
    expect(screen.getByText('翻譯中…')).toBeInTheDocument();

    await act(async () => {
      resolveJa({ sameLanguage: false, translatedText: '入り口 270円', targetLanguage: 'ja' });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText('入り口 270円')).toBeInTheDocument());
  });

  it('新 target 翻譯失敗時保留照片、選取區域與 OCR 原文', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('翻譯服務暫時無法使用'));
    expect(screen.getByText('入口 270円')).toBeInTheDocument();
    expect(screen.getByAltText('已選取的照片區域')).toBeInTheDocument();
  });

  it('切換失敗回復顯示切換前最後一次成功結果，displayed.target 不得被誤標為新 target', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    vi.mocked(requestPhotoTranslate).mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('切換翻譯失敗'));
    expect(screen.getByText('入口 270日圓')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('繁體中文');
  });

  it('切換前無成功結果時，失敗不得虛構任何翻譯內容', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('翻譯服務暫時無法使用');
    expect(screen.queryByText(/切換翻譯失敗/)).not.toBeInTheDocument();
  });

  it('失敗後點擊「重新嘗試翻譯」重新呼叫並可成功', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '重新嘗試翻譯' })).toBeInTheDocument());

    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '成功翻譯',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '重新嘗試翻譯' }));
    await waitFor(() => expect(screen.getByText('成功翻譯')).toBeInTheDocument());
  });

  it('out-of-order：先送出的舊 target 回應延遲抵達，不得覆蓋目前有效的新 target 結果', async () => {
    await completeOcrSuccess('入口 270円');
    let resolveZh: (value: PhotoTranslateResult) => void = () => {};
    vi.mocked(requestPhotoTranslate).mockImplementationOnce(
      () => new Promise<PhotoTranslateResult>((resolve) => {
        resolveZh = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' })); // request A: zh-TW，尚未 resolve

    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: 'ja 結果',
      targetLanguage: 'ja',
    });
    fireEvent.click(screen.getByRole('button', { name: '日本語' })); // request B: ja，立即成功
    await waitFor(() => expect(screen.getByText('ja 結果')).toBeInTheDocument());

    await act(async () => {
      resolveZh({ sameLanguage: false, translatedText: 'zh 結果(過期)', targetLanguage: 'zh-TW' });
      await Promise.resolve();
    });
    expect(screen.queryByText('zh 結果(過期)')).not.toBeInTheDocument();
    expect(screen.getByText('ja 結果')).toBeInTheDocument();
  });

  it('重新選取新區域後，舊 regionVersion 的翻譯回應不得復活', async () => {
    await completeOcrSuccess('入口 270円');
    let resolveTranslate: (value: PhotoTranslateResult) => void = () => {};
    vi.mocked(requestPhotoTranslate).mockImplementationOnce(
      () => new Promise<PhotoTranslateResult>((resolve) => {
        resolveTranslate = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' })); // 尚未 resolve，regionVersion=1

    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({ reliableTextFound: true, sourceText: '新原文', regionVersion: 2 });
    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    confirmValidSelection();
    await waitFor(() => expect(screen.getByText('新原文')).toBeInTheDocument());

    await act(async () => {
      resolveTranslate({ sameLanguage: false, translatedText: '舊區域翻譯(過期)', targetLanguage: 'zh-TW' });
      await Promise.resolve();
    });
    expect(screen.queryByText('舊區域翻譯(過期)')).not.toBeInTheDocument();
    expect(screen.getByText(/尚未產生翻譯/)).toBeInTheDocument();
  });

  it('重新選取區域立即隱藏舊翻譯結果', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'region_selection');
    expect(screen.queryByText('入口 270日圓')).not.toBeInTheDocument();
  });

  it('重新選取區域後尚未確認新選取前，即使按下更換照片，也不恢復舊翻譯內容', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    expect(screen.queryByText('入口 270日圓')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '更換照片' }));
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'acquisition');
    expect(screen.queryByText('入口 270日圓')).not.toBeInTheDocument();
  });

  it('翻譯失敗訊息不包含 provider 原始錯誤或技術細節', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockRejectedValueOnce({
      code: 'AI_SERVICE_UNAVAILABLE',
      userTitle: '翻譯服務暫時無法使用',
      userMessage: '目前無法完成翻譯。',
      actionableStep: '請重新嘗試翻譯。',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveTextContent(/OpenAI|openai|stack|Error:/i);
  });
});

describe('PhotoTranslateScreen（Phase 10 Error / Privacy Lifecycle, FR-013/FR-014/FR-016）', () => {
  it('「更換照片」revoke 原始照片與裁切區域的 object URL', async () => {
    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({ reliableTextFound: false, regionVersion: 1 });
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() => expect(screen.getByRole('button', { name: '重新選擇照片' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '重新選擇照片' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1'); // 原始照片
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-2'); // 裁切區域
  });

  it('離開功能（元件卸載）revoke 目前照片與裁切區域的 object URL', async () => {
    const { unmount } = render(<PhotoTranslateScreen />);
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    fireEvent.change(galleryInput, { target: { files: [new File(['fake-bytes'], 'menu.jpg', { type: 'image/jpeg' })] } });
    confirmValidSelection();
    // 等待既有（不 resolve 的）requestPhotoOcr 呼叫已發出，避免殘留的真實 fetch/FileReader 非同步鏈跨測試污染後續測試之 mock 佇列。
    await waitFor(() => expect(requestPhotoOcr).toHaveBeenCalled());
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-2');
  });

  it('離開後重新進入不恢復先前 task（新掛載為全新初始狀態）', () => {
    const { unmount } = render(<PhotoTranslateScreen />);
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    fireEvent.change(galleryInput, { target: { files: [new File(['fake-bytes'], 'menu.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'region_selection');
    unmount();

    render(<PhotoTranslateScreen />);
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'acquisition');
    expect(screen.getByRole('button', { name: '拍攝照片' })).toBeInTheDocument();
  });

  it('重新選取確認新選取後，revoke 舊裁切區域 URL，保留新裁切區域 URL', async () => {
    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({ reliableTextFound: true, sourceText: '舊結果', regionVersion: 1 });
    acquirePhoto();
    confirmValidSelection(); // 產生 blob:mock-2（裁切）
    await waitFor(() => expect(screen.getByText('舊結果')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:mock-2'); // 尚未確認新選取，不得過早 revoke

    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({ reliableTextFound: true, sourceText: '新結果', regionVersion: 2 });
    confirmValidSelection(); // 產生 blob:mock-3（新裁切）
    await waitFor(() => expect(screen.getByText('新結果')).toBeInTheDocument());

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-2');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:mock-3');
  });

  it('重新選取尚未確認前不會過早 revoke 原始照片 URL', async () => {
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() => expect(requestPhotoOcr).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:mock-1'); // 原始照片仍在使用中
  });
});

describe('PhotoTranslateScreen（Phase 11 Race Scenario Guard：跨 photo/task 之 regionVersion 不得重複復活）', () => {
  it('更換照片後，舊照片延遲抵達的 OCR 回應不得被新照片的相同 regionVersion 數值誤判為有效結果', async () => {
    // Photo A：確認選取，regionVersion -> 1，request 尚未 resolve
    let resolvePhotoAOcr: (value: PhotoOcrResult) => void = () => {};
    const photoAOcrCall = new Promise<PhotoOcrResult>((resolve) => {
      resolvePhotoAOcr = resolve;
    });
    vi.mocked(requestPhotoOcr).mockImplementationOnce(() => photoAOcrCall);
    acquirePhoto();
    confirmValidSelection();
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '1');

    // 使用者在 Photo A 的 OCR 尚未回應前，按下「重新選取區域」回到 region_selection，再按「更換照片」改用 Photo B
    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    fireEvent.click(screen.getByRole('button', { name: '更換照片' }));
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'acquisition');

    // Photo B：立即成功，若實作錯誤地將 regionVersion 重置為 0，此處會再次產生 regionVersion=1
    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({
      reliableTextFound: true,
      sourceText: 'Photo B 正確結果',
      regionVersion: 2,
    });
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    fireEvent.change(galleryInput, { target: { files: [new File(['fake-bytes'], 'photo-b.jpg', { type: 'image/jpeg' })] } });
    confirmValidSelection();
    await waitFor(() => expect(screen.getByText('Photo B 正確結果')).toBeInTheDocument());
    // 修正後 regionVersion 全域遞增不重複，Photo B 的確認選取取得的必然是 2，而非與 Photo A 相同的 1
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '2');

    // Photo A 的延遲回應此時才抵達，帶著 Photo A 當時請求的 regionVersion=1
    await act(async () => {
      resolvePhotoAOcr({ reliableTextFound: true, sourceText: 'Photo A 過期結果（不得復活）', regionVersion: 1 });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Photo A 的過期結果不得覆蓋或污染 Photo B 目前顯示的內容
    expect(screen.queryByText('Photo A 過期結果（不得復活）')).not.toBeInTheDocument();
    expect(screen.getByText('Photo B 正確結果')).toBeInTheDocument();
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-region-version', '2');
  });
});

describe('PhotoTranslateScreen（Phase 11 T033 端到端：拍照→選取→OCR 成功→zh-TW 翻譯→ja 翻譯→語音播放, quickstart 4/6）', () => {
  it('完整旅程：三分區顯示、雙語翻譯與對應語言語音播放', async () => {
    await completeOcrSuccess('入口 270円');
    expect(screen.getByAltText('已選取的照片區域')).toBeInTheDocument();
    expect(screen.getByText('入口 270円')).toBeInTheDocument();

    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    vi.mocked(generateSpeech).mockResolvedValueOnce({ audioUrl: 'blob:speech-zh', mimeType: 'audio/mpeg', speed: 'normal' });
    fireEvent.click(screen.getByRole('button', { name: '播放語音' }));
    await waitFor(() =>
      expect(generateSpeech).toHaveBeenCalledWith(expect.objectContaining({ text: '入口 270日圓', language: 'zh-TW' })),
    );

    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入り口 270円',
      targetLanguage: 'ja',
    });
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    await waitFor(() => expect(screen.getByText('入り口 270円')).toBeInTheDocument());

    vi.mocked(generateSpeech).mockResolvedValueOnce({ audioUrl: 'blob:speech-ja', mimeType: 'audio/mpeg', speed: 'normal' });
    fireEvent.click(screen.getByRole('button', { name: '播放語音' }));
    await waitFor(() =>
      expect(generateSpeech).toHaveBeenCalledWith(expect.objectContaining({ text: '入り口 270円', language: 'ja' })),
    );
  });
});

describe('PhotoTranslateScreen（Phase 11 T034 端到端：無可靠文字→同張照片重新選取→重新 OCR 成功, quickstart 5/10）', () => {
  it('無可靠文字保留照片並可重新選取，重新選取同張照片後重新 OCR 取得結果', async () => {
    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({ reliableTextFound: false, regionVersion: 1 });
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('沒有辨識到可靠的文字'));
    // 未產生任何猜測式原文
    expect(screen.queryByText(/入口|ラーメン/)).not.toBeInTheDocument();

    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({
      reliableTextFound: true,
      sourceText: '重新選取後的原文',
      regionVersion: 2,
    });
    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    confirmValidSelection(); // 同一張照片，未重新拍攝／重新選圖
    await waitFor(() => expect(screen.getByText('重新選取後的原文')).toBeInTheDocument());
    expect(requestPhotoOcr).toHaveBeenCalledTimes(2);
  });
});

describe('PhotoTranslateScreen（Phase 11 T035 端到端：重新選取立即隱藏舊結果，新選取完成 OCR 才顯示新內容, quickstart 9）', () => {
  it('重新選取後於新 OCR 完成前不顯示任何舊或新結果，完成後才顯示新內容', async () => {
    await completeOcrSuccess('舊原文');

    let resolveNewOcr: (value: PhotoOcrResult) => void = () => {};
    vi.mocked(requestPhotoOcr).mockImplementationOnce(
      () => new Promise<PhotoOcrResult>((resolve) => {
        resolveNewOcr = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    expect(screen.queryByText('舊原文')).not.toBeInTheDocument();
    confirmValidSelection();
    // 新 OCR 尚未完成：不得顯示舊原文，也不得提早顯示尚未抵達的新原文
    expect(screen.queryByText('舊原文')).not.toBeInTheDocument();
    expect(screen.queryByText('新原文')).not.toBeInTheDocument();
    expect(screen.getByText('正在辨識文字…')).toBeInTheDocument();
    await waitFor(() => expect(requestPhotoOcr).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveNewOcr({ reliableTextFound: true, sourceText: '新原文', regionVersion: 2 });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText('新原文')).toBeInTheDocument());
    expect(screen.queryByText('舊原文')).not.toBeInTheDocument();
  });
});

describe('PhotoTranslateScreen（Phase 11 T036 端到端：同語言不產生假翻譯→切換另一目標取得正常翻譯, quickstart 7）', () => {
  it('zh-TW same-language 提示後，實際點擊切換至日本語可取得正常翻譯', async () => {
    await completeOcrSuccess('你好');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({ sameLanguage: true, targetLanguage: 'zh-TW' });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText(/辨識原文已是繁體中文/)).toBeInTheDocument());
    expect(screen.queryByText(/^你好翻譯$/)).not.toBeInTheDocument();

    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: 'こんにちは',
      targetLanguage: 'ja',
    });
    fireEvent.click(screen.getByRole('button', { name: /切換至日本語/ }));
    expect(requestPhotoTranslate).toHaveBeenLastCalledWith('你好', 'ja');
    await waitFor(() => expect(screen.getByText('こんにちは')).toBeInTheDocument());
  });

  it('ja same-language 提示後，實際點擊切換至繁體中文可取得正常翻譯', async () => {
    await completeOcrSuccess('こんにちは');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({ sameLanguage: true, targetLanguage: 'ja' });
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    await waitFor(() => expect(screen.getByText(/辨識原文已是日本語/)).toBeInTheDocument());

    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '你好',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: /切換至繁體中文/ }));
    expect(requestPhotoTranslate).toHaveBeenLastCalledWith('こんにちは', 'zh-TW');
    await waitFor(() => expect(screen.getByText('你好')).toBeInTheDocument());
  });
});

describe('PhotoTranslateScreen（Phase 11 T037 端到端：target 切換失敗回復＋播放語言對應, quickstart 8）', () => {
  it('切換失敗回復前次成功結果時，語音播放語言隨 displayed.target（zh-TW）而非 selectedTarget（ja）', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    vi.mocked(requestPhotoTranslate).mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: '日本語' })); // selectedTarget 變為 ja，但切換失敗
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('切換翻譯失敗'));
    expect(screen.getByText('入口 270日圓')).toBeInTheDocument();

    vi.mocked(generateSpeech).mockResolvedValueOnce({ audioUrl: 'blob:speech-zh', mimeType: 'audio/mpeg', speed: 'normal' });
    fireEvent.click(screen.getByRole('button', { name: '播放語音' }));
    await waitFor(() =>
      expect(generateSpeech).toHaveBeenCalledWith(expect.objectContaining({ text: '入口 270日圓', language: 'zh-TW' })),
    );
  });

  it('切換前無任何成功結果時，失敗狀態不顯示任何翻譯內容且無語音播放 action', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('翻譯服務暫時無法使用'));
    expect(screen.queryByRole('button', { name: '播放語音' })).not.toBeInTheDocument();
    expect(screen.getByText('入口 270円')).toBeInTheDocument(); // 僅保留照片/選取區域/OCR 原文
  });
});

describe('PhotoTranslateScreen（Phase 11 T038 端到端：OCR／翻譯／語音個別失敗之保留與重試, quickstart 11）', () => {
  it('語音播放失敗時保留翻譯結果並可重新嘗試播放，不重新翻譯／不重新 OCR，且不顯示技術性錯誤', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    vi.mocked(generateSpeech).mockRejectedValueOnce(new Error('tts offline'));
    fireEvent.click(screen.getByRole('button', { name: '播放語音' }));
    const speechAlert = await screen.findByText(/語音播放暫時無法使用/);
    expect(speechAlert).not.toHaveTextContent(/tts offline|Error:/i);
    // 翻譯結果仍保留顯示，未觸發重新翻譯／重新 OCR
    expect(screen.getByText('入口 270日圓')).toBeInTheDocument();
    expect(requestPhotoTranslate).toHaveBeenCalledTimes(1);
    expect(requestPhotoOcr).toHaveBeenCalledTimes(1);

    vi.mocked(generateSpeech).mockResolvedValueOnce({ audioUrl: 'blob:speech-retry', mimeType: 'audio/mpeg', speed: 'normal' });
    fireEvent.click(screen.getByRole('button', { name: '播放語音' }));
    await waitFor(() => expect(generateSpeech).toHaveBeenCalledTimes(2));
  });

  it('OCR／翻譯個別失敗訊息均不顯示技術性錯誤，且各自保留對應已完成內容並可重試', async () => {
    vi.mocked(requestPhotoOcr).mockRejectedValueOnce({
      code: 'AI_SERVICE_UNAVAILABLE',
      userTitle: '辨識服務暫時無法使用',
      userMessage: '目前無法完成文字辨識。',
      actionableStep: '請稍後重試辨識，或重新選取範圍。',
    });
    acquirePhoto();
    confirmValidSelection();
    await waitFor(() => expect(screen.getByRole('button', { name: '重試辨識' })).toBeInTheDocument());
    expect(screen.getByRole('alert')).not.toHaveTextContent(/OpenAI|stack|Error:/i);
    expect(screen.getByAltText('已選取的照片區域')).toBeInTheDocument(); // 照片保留

    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({ reliableTextFound: true, sourceText: '重試成功原文', regionVersion: 1 });
    fireEvent.click(screen.getByRole('button', { name: '重試辨識' }));
    await waitFor(() => expect(screen.getByText('重試成功原文')).toBeInTheDocument());

    vi.mocked(requestPhotoTranslate).mockRejectedValueOnce({
      code: 'AI_SERVICE_UNAVAILABLE',
      userTitle: '翻譯服務暫時無法使用',
      userMessage: '目前無法完成翻譯。',
      actionableStep: '請重新嘗試翻譯。',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('翻譯服務暫時無法使用'));
    expect(screen.getByRole('alert')).not.toHaveTextContent(/OpenAI|stack|Error:/i);
    expect(screen.getByText('重試成功原文')).toBeInTheDocument(); // 照片＋原文保留
  });
});

describe('PhotoTranslateScreen（Phase 11 T039 端到端：已有翻譯與語音之 Photo Lifecycle 清除, quickstart 13）', () => {
  it('已完成翻譯與語音播放後，「更換照片」仍完整清除全部內容並 revoke object URLs', async () => {
    await completeOcrSuccess('入口 270円');
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    vi.mocked(generateSpeech).mockResolvedValueOnce({ audioUrl: 'blob:speech-zh', mimeType: 'audio/mpeg', speed: 'normal' });
    fireEvent.click(screen.getByRole('button', { name: '播放語音' }));
    await waitFor(() => expect(generateSpeech).toHaveBeenCalled());

    // 由 ocr_result／translation_result 更換照片：先重新選取區域回到 region_selection，才會出現「更換照片」action
    fireEvent.click(screen.getByRole('button', { name: '重新選取區域' }));
    fireEvent.click(screen.getByRole('button', { name: '更換照片' }));
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'acquisition');
    expect(screen.queryByText('入口 270日圓')).not.toBeInTheDocument();
    expect(screen.queryByText('入口 270円')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-2');

    // 離開後不存在可瀏覽的舊照片/OCR/翻譯歷史：同一畫面重新選圖後為全新任務
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    const file = new File(['fake-bytes'], 'menu2.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [file] } });
    expect(screen.getByTestId('region-selector')).toBeInTheDocument();
    expect(screen.queryByText('入口 270日圓')).not.toBeInTheDocument();
  });

  it('離開 Photo Translate（卸載）後即使先前已有翻譯與語音，重新進入亦不恢復舊 task', async () => {
    const { unmount } = render(<PhotoTranslateScreen />);
    const galleryInput = screen.getByTestId('photo-acquisition-gallery-input');
    fireEvent.change(galleryInput, { target: { files: [new File(['fake-bytes'], 'menu.jpg', { type: 'image/jpeg' })] } });
    vi.mocked(requestPhotoOcr).mockResolvedValueOnce({ reliableTextFound: true, sourceText: '入口 270円', regionVersion: 1 });
    confirmValidSelection();
    await waitFor(() => expect(screen.getByText('入口 270円')).toBeInTheDocument());
    vi.mocked(requestPhotoTranslate).mockResolvedValueOnce({
      sameLanguage: false,
      translatedText: '入口 270日圓',
      targetLanguage: 'zh-TW',
    });
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    await waitFor(() => expect(screen.getByText('入口 270日圓')).toBeInTheDocument());

    unmount();
    render(<PhotoTranslateScreen />);
    expect(screen.getByTestId('photo-translate-screen')).toHaveAttribute('data-phase', 'acquisition');
    expect(screen.queryByText('入口 270日圓')).not.toBeInTheDocument();
    expect(screen.queryByText('入口 270円')).not.toBeInTheDocument();
  });
});
