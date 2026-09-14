import { useState } from 'react';
import { requestAssistant } from '../services/api';
import type { AssistantResult } from '../types/assistant';
import type { UserTone } from '../types/request';
import { TranslationResult } from '../features/translation/TranslationResult';
import { StatusMessage } from '../components/StatusMessage';

interface AssistantScreenProps { initialText?: string; onBack: () => void; }

export function AssistantScreen({ initialText = '', onBack }: AssistantScreenProps) {
  const [text, setText] = useState(initialText);
  const [tone, setTone] = useState<UserTone>('default');
  const [result, setResult] = useState<AssistantResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(targetTone: UserTone = tone) {
    const source = result?.translation?.sourceText || text;
    if (!source.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      const nextResult = await requestAssistant({
        id: crypto.randomUUID(),
        text: source,
        inputType: 'text',
        tone: targetTone,
      });
      setResult(nextResult);
    } catch (value) {
      setError(
        typeof value === 'object' && value && 'userMessage' in value
          ? String(value.userMessage)
          : '目前無法完成請求，請稍後重試。',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleToneChange(nextTone: UserTone) {
    setTone(nextTone);
    await submit(nextTone);
  }

  return (
    <section aria-labelledby="assistant-heading">
      <button type="button" onClick={onBack}>
        返回首頁
      </button>
      <h2 id="assistant-heading">東京助手</h2>
      <label>
        輸入內容
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <button type="button" onClick={() => void submit(tone)} disabled={loading || !text.trim()}>
        {loading ? '處理中…' : '送出'}
      </button>
      {error && <StatusMessage>{error}</StatusMessage>}
      {result?.translation && (
        <TranslationResult
          sourceText={result.translation.sourceText}
          targetText={result.translation.targetText}
          tone={result.translation.toneUsed}
          sourceLanguage={result.sourceLanguage}
          targetLanguage={result.targetLanguage}
          onToneChange={(nextTone) => void handleToneChange(nextTone)}
        />
      )}
    </section>
  );
}