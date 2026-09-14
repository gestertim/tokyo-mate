import { useEffect, useState } from 'react';
import type { UserTone } from '../../types/request';
import { AudioPlayer } from '../../components/AudioPlayer';

interface TranslationResultProps {
  sourceText: string;
  targetText: string;
  tone: UserTone;
  sourceLanguage?: 'zh-TW' | 'ja' | 'other';
  targetLanguage?: 'zh-TW' | 'ja';
  onToneChange: (tone: UserTone) => void;
}

export function TranslationResult({
  sourceText,
  targetText,
  tone,
  targetLanguage = 'ja',
  onToneChange,
}: TranslationResultProps) {
  const [editableText, setEditableText] = useState(targetText);

  useEffect(() => {
    setEditableText(targetText);
  }, [targetText]);

  const targetLabel = targetLanguage === 'zh-TW' ? '中文翻譯' : '日文翻譯';

  async function copy() {
    await navigator.clipboard.writeText(editableText);
  }

  return (
    <article aria-labelledby="translation-heading">
      <h2 id="translation-heading">翻譯結果</h2>
      <p>{sourceText}</p>
      <label>
        {targetLabel}
        <textarea
          aria-label={targetLabel}
          value={editableText}
          onChange={(event) => setEditableText(event.target.value)}
        />
      </label>
      <div role="group" aria-label="語調選擇">
        <button type="button" aria-pressed={tone === 'default'} onClick={() => onToneChange('default')}>
          自然
        </button>
        <button type="button" aria-pressed={tone === 'polite'} onClick={() => onToneChange('polite')}>
          更禮貌
        </button>
        <button type="button" aria-pressed={tone === 'casual'} onClick={() => onToneChange('casual')}>
          更口語
        </button>
      </div>
      <button type="button" onClick={() => void copy()}>
        複製
      </button>
      <AudioPlayer text={editableText} language={targetLanguage} />
    </article>
  );
}