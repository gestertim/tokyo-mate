import { useState } from 'react';
import { startRecording, type RecorderSession } from '../../services/recorder';
import { transcribeAudio } from '../../services/api';
import { EditableTranscript } from './EditableTranscript';
import { StatusMessage } from '../../components/StatusMessage';

interface VoiceInputModalProps { onTranscript: (text: string) => void; onClose: () => void; }

export function VoiceInputModal({ onTranscript, onClose }: VoiceInputModalProps) {
  const [state, setState] = useState<'ready' | 'recording' | 'transcribing' | 'editing' | 'denied'>('ready');
  const [session, setSession] = useState<RecorderSession>();
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string>();

  async function record() {
    setError(undefined);
    try { const next = await startRecording(); setSession(next); setState('recording'); }
    catch { setState('denied'); }
  }

  async function stop() {
    if (!session) return;
    setState('transcribing');
    setError(undefined);
    try {
      const blob = await session.stop();
      const result = await transcribeAudio(blob);
      setTranscript(result.text);
      setState('editing');
    } catch (value: unknown) {
      setState('ready');
      setError(
        typeof value === 'object' && value && 'userMessage' in value
          ? String((value as { userMessage: unknown }).userMessage)
          : '目前無法完成語音轉錄，請稍後重試。',
      );
    }
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="voice-heading">
    <h2 id="voice-heading">語音輸入</h2>
    {state === 'denied' && <p role="alert">已關閉麥克風權限，您仍可使用文字輸入完成翻譯。</p>}
    {error && state !== 'denied' && <StatusMessage role="alert">{error}</StatusMessage>}
    {state === 'editing' ? (
      <EditableTranscript value={transcript} onChange={setTranscript} onSubmit={() => { onTranscript(transcript); onClose(); }} />
    ) : (
      state === 'recording' ? <button type="button" onClick={() => void stop()}>停止錄音</button> : <button type="button" onClick={() => void record()} disabled={state === 'transcribing'}>{state === 'transcribing' ? '轉錄中…' : '開始錄音'}</button>
    )}
    <button type="button" onClick={onClose}>改用文字輸入</button>
  </div>;
}