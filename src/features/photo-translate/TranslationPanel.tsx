import { AudioPlayer } from '../../components/AudioPlayer';
import type { PhotoTranslateTargetLanguage, TranslationState } from '../../types/photoTranslate';

interface TranslationPanelProps {
  translation?: TranslationState;
  onSelectTarget: (target: PhotoTranslateTargetLanguage) => void;
  onRetryTranslate: () => void;
}

const TARGET_LABELS: Record<PhotoTranslateTargetLanguage, string> = {
  'zh-TW': '繁體中文',
  ja: '日本語',
};

function otherTarget(target: PhotoTranslateTargetLanguage): PhotoTranslateTargetLanguage {
  return target === 'zh-TW' ? 'ja' : 'zh-TW';
}

export function TranslationPanel({ translation, onSelectTarget, onRetryTranslate }: TranslationPanelProps) {
  const selectedTarget = translation?.selectedTarget;
  const status = translation?.status ?? 'idle';
  const displayed = translation?.displayed;

  return (
    <section aria-labelledby="translation-result-heading" data-testid="translation-panel" data-translation-status={status}>
      <h4 id="translation-result-heading">翻譯結果</h4>
      <div role="group" aria-label="選擇翻譯目標語言">
        {(['zh-TW', 'ja'] as const).map((target) => (
          <button key={target} type="button" aria-pressed={selectedTarget === target} onClick={() => onSelectTarget(target)}>
            {TARGET_LABELS[target]}
          </button>
        ))}
      </div>

      {status === 'idle' && <p>尚未產生翻譯，請選擇繁體中文或日本語以取得翻譯</p>}

      {status === 'translating' && <p role="status">翻譯中…</p>}

      {status === 'success' && displayed?.text && (
        <>
          <p>{displayed.text}</p>
          {/* 語音語言恆依 displayed.target，非 selectedTarget（FR-021）；key 依內容變動強制重新掛載避免舊語音回覆覆蓋新翻譯 */}
          <AudioPlayer key={`${displayed.target}:${displayed.text}`} text={displayed.text} language={displayed.target} />
        </>
      )}

      {status === 'same_language' && selectedTarget && (
        <>
          <p role="status">辨識原文已是{TARGET_LABELS[selectedTarget]}，不需另外翻譯</p>
          <button type="button" onClick={() => onSelectTarget(otherTarget(selectedTarget))}>
            切換至{TARGET_LABELS[otherTarget(selectedTarget)]}
          </button>
        </>
      )}

      {status === 'failure' && (
        <>
          {displayed?.text ? (
            <>
              <p role="alert">切換翻譯失敗，可重試；以下為切換前最後一次成功的翻譯結果（{TARGET_LABELS[displayed.target]}）：</p>
              <p>{displayed.text}</p>
              <AudioPlayer key={`${displayed.target}:${displayed.text}`} text={displayed.text} language={displayed.target} />
            </>
          ) : (
            <p role="alert">翻譯服務暫時無法使用，請重新嘗試翻譯。</p>
          )}
          <button type="button" onClick={onRetryTranslate}>
            重新嘗試翻譯
          </button>
        </>
      )}
    </section>
  );
}
