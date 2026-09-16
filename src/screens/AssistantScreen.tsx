import { useEffect, useRef, useState } from 'react';
import { requestAssistant, setAssistantRequestObserver, type AssistantRequestObserver } from '../services/api';
import type { AssistantResult } from '../types/assistant';
import type { UserTone } from '../types/request';
import { TranslationResult } from '../features/translation/TranslationResult';
import { TravelAnswer } from '../features/travel/TravelAnswer';
import { EmergencyAnswerCard } from '../features/emergency/EmergencyAnswerCard';
import { StatusMessage } from '../components/StatusMessage';
import { LiveDataStatus } from '../components/LiveDataStatus';

interface AssistantScreenProps { initialText?: string; onBack: () => void; }

interface ClientVerificationTiming {
  verificationCorrelationId: string;
  submitAt: number;
  fetchStartAt?: number;
  responseReceivedAt?: number;
  responseParsedAt?: number;
  setResultAt?: number;
}

export function AssistantScreen({ initialText = '', onBack }: AssistantScreenProps) {
  const [text, setText] = useState(initialText);
  const [tone, setTone] = useState<UserTone>('default');
  const [result, setResult] = useState<AssistantResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const pendingTiming = useRef<ClientVerificationTiming>();

  useEffect(() => {
    const setResultAt = pendingTiming.current?.setResultAt;
    if (!result || !setResultAt) return;
    const timing = pendingTiming.current;
    if (!timing) return;
    const primaryResultVisibleAt = performance.now();
    console.info(JSON.stringify({
      event: 'tokyo-mate.verification.assistant.client-timing',
      verificationCorrelationId: timing.verificationCorrelationId,
      submitToFetchStartMs: roundMilliseconds((timing.fetchStartAt ?? timing.submitAt) - timing.submitAt),
      fetchDurationMs: timing.responseReceivedAt && timing.fetchStartAt
        ? roundMilliseconds(timing.responseReceivedAt - timing.fetchStartAt)
        : null,
      responseReceivedMs: timing.responseReceivedAt
        ? roundMilliseconds(timing.responseReceivedAt - timing.submitAt)
        : null,
      responseParsedMs: timing.responseParsedAt
        ? roundMilliseconds(timing.responseParsedAt - timing.submitAt)
        : null,
      setResultMs: roundMilliseconds(setResultAt - timing.submitAt),
      primaryResultVisibleMs: roundMilliseconds(primaryResultVisibleAt - timing.submitAt),
      totalSubmitToPrimaryVisibleMs: roundMilliseconds(primaryResultVisibleAt - timing.submitAt),
    }));
    pendingTiming.current = undefined;
  }, [result]);

  async function runAssistantRequest(source: string, targetTone: UserTone) {
    if (!source.trim()) return;
    const submitAt = performance.now();
    const verificationCorrelationId = crypto.randomUUID();
    const clientTiming: ClientVerificationTiming = { verificationCorrelationId, submitAt };
    pendingTiming.current = clientTiming;
    setLoading(true);
    setError(undefined);
    setResult(undefined);
    try {
      const observer: AssistantRequestObserver = {
        verificationCorrelationId,
        onFetchStart: (at) => { clientTiming.fetchStartAt = at; },
        onResponseReceived: (at) => { clientTiming.responseReceivedAt = at; },
        onResponseParsed: (at, response) => {
          clientTiming.responseParsedAt = at;
          const serverTiming = response.headers.get('X-Tokyo-Mate-Verification-Timing');
          if (serverTiming) {
            console.info(JSON.stringify({
              event: 'tokyo-mate.verification.assistant.server-timing-received',
              verificationCorrelationId,
              timing: JSON.parse(serverTiming),
            }));
          }
        },
      };
      setAssistantRequestObserver(observer);
      const nextResult = await requestAssistant({
        id: crypto.randomUUID(),
        text: source,
        inputType: 'text',
        tone: targetTone,
      });
      clientTiming.setResultAt = performance.now();
      setResult(nextResult);
    } catch (value) {
      setError(
        typeof value === 'object' && value && 'userMessage' in value
          ? String(value.userMessage)
          : '目前無法完成請求，請稍後重試。',
      );
    } finally {
      setAssistantRequestObserver(undefined);
      setLoading(false);
    }
  }

  function roundMilliseconds(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async function submitCurrentInput() {
    await runAssistantRequest(text, tone);
  }

  async function resubmitTranslationWithTone(nextTone: UserTone) {
    setTone(nextTone);
    const translationSource = result?.translation?.sourceText;
    if (!translationSource?.trim()) return;
    await runAssistantRequest(translationSource, nextTone);
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
      <button type="button" onClick={() => void submitCurrentInput()} disabled={loading || !text.trim()}>
        {loading ? '處理中…' : '送出'}
      </button>
      {error && <StatusMessage>{error}</StatusMessage>}
      {result && (
        <LiveDataStatus
          status={result.liveDataStatus}
          message={result.liveDataMessage}
          nextAction={result.liveDataNextAction}
        />
      )}
      {result?.translation && (
        <TranslationResult
          sourceText={result.translation.sourceText}
          targetText={result.translation.targetText}
          tone={result.translation.toneUsed}
          sourceLanguage={result.sourceLanguage}
          targetLanguage={result.targetLanguage}
          onToneChange={(nextTone) => void resubmitTranslationWithTone(nextTone)}
        />
      )}
      {result?.travelAnswer && <TravelAnswer travelAnswer={result.travelAnswer} />}
      {result?.emergencyGuide && <EmergencyAnswerCard guide={result.emergencyGuide} />}
    </section>
  );
}