import { useEffect, useRef, useState } from 'react';
import { PcmRecordingUnsupportedError, startRecording, type RecorderSession } from '../../services/recorder';
import { transcribeAudio } from '../../services/api';
import { EditableTranscript } from './EditableTranscript';
import { StatusMessage } from '../../components/StatusMessage';

interface VoiceInputModalProps { onTranscript: (text: string) => void; onClose: () => void; }

export function VoiceInputModal({ onTranscript, onClose }: VoiceInputModalProps) {
  const [state, setState] = useState<'ready' | 'recording' | 'recorded' | 'transcribing' | 'editing' | 'denied'>('ready');
  const [session, setSession] = useState<RecorderSession>();
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string>();
  const active = useRef<RecorderSession>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.cancel(); };
  }, []);

  async function record() {
    setError(undefined);
    try {
      const next = await startRecording(() => { if (mounted.current) setState('recorded'); });
      if (!mounted.current) { next.cancel(); return; }
      active.current = next; setSession(next); setState(next.isStopped?.() ? 'recorded' : 'recording');
    } catch (value) {
      if (!mounted.current) return;
      if (value instanceof DOMException && value.name === 'NotAllowedError') setState('denied');
      else {
        setState('ready');
        setError(value instanceof PcmRecordingUnsupportedError ? value.message :
          '目前無法啟動錄音，請重新嘗試或改用文字輸入。');
      }
    }
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
    {state === 'recorded' && <p role="status">已達60秒並停止錄音；請手動轉錄或改用文字輸入。</p>}
    {state === 'editing' ? (
      <EditableTranscript value={transcript} onChange={setTranscript} onSubmit={() => { onTranscript(transcript); onClose(); }} />
    ) : (
      state === 'recording' || state === 'recorded' ?
        <button type="button" onClick={() => void stop()}>{state === 'recorded' ? '轉錄這段錄音' : '停止錄音'}</button> :
        <button type="button" onClick={() => void record()} disabled={state === 'transcribing'}>{state === 'transcribing' ? '轉錄中…' : '開始錄音'}</button>
    )}
    <button type="button" onClick={() => { active.current?.cancel(); onClose(); }}>改用文字輸入</button>
  </div>;
}