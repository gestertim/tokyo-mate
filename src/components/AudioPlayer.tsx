import { useEffect, useRef, useState } from 'react';
import { generateSpeech } from '../services/api';

interface AudioPlayerProps { text: string; language?: 'ja' | 'zh-TW'; }

export function AudioPlayer({ text, language = 'ja' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  async function play(speed: 'normal' | 'slow') {
    setStatus('loading');
    try {
      const result = await generateSpeech({ text, language, speed });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = result.audioUrl;
      audioRef.current = new Audio(result.audioUrl);
      audioRef.current.playbackRate = speed === 'slow' ? 0.75 : 1;
      await audioRef.current.play();
      setStatus('idle');
    } catch { setStatus('error'); }
  }

  return <div aria-label="語音播放控制">
    <button type="button" onClick={() => void play('normal')} disabled={status === 'loading'}>播放語音</button>
    <button type="button" onClick={() => void play('slow')} disabled={status === 'loading'}>慢速播放</button>
    {status === 'error' && <p role="status">語音播放暫時無法使用，您可以直接展示文字。</p>}
  </div>;
}