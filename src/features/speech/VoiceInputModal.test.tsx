import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceInputModal } from './VoiceInputModal';
import * as recorder from '../../services/recorder';
import * as api from '../../services/api';
afterEach(() => vi.restoreAllMocks());
describe('D03 明確錄音操作及釋放', () => {
  it('自動停止只提示，明確點轉錄後才呼叫；離開取消', async () => {
    let auto!: () => void;
    const session = { stop: vi.fn(async () => new Blob(['TEST_ONLY'], { type: 'audio/wav' })), cancel: vi.fn() };
    vi.spyOn(recorder, 'startRecording').mockImplementation(async (callback) => { auto = callback!; return session; });
    const transcribe = vi.spyOn(api, 'transcribeAudio').mockResolvedValue({ text: '測試原文' });
    const view = render(<VoiceInputModal onTranscript={vi.fn()} onClose={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '開始錄音' })); });
    act(() => auto());
    expect(screen.getByRole('status')).toHaveTextContent('已達60秒');
    expect(transcribe).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '轉錄這段錄音' })); });
    expect(transcribe).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(session.cancel).toHaveBeenCalled();
  });
  it('不支援固定格式時明示改文字，不啟動轉錄', async () => {
    vi.spyOn(recorder, 'startRecording').mockRejectedValue(new recorder.PcmRecordingUnsupportedError());
    const transcribe = vi.spyOn(api, 'transcribeAudio');
    render(<VoiceInputModal onTranscript={vi.fn()} onClose={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '開始錄音' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('請改用文字輸入');
    expect(transcribe).not.toHaveBeenCalled();
  });
  it('等待getUserMedia期間離開，晚到session立即取消', async () => {
    let late!: (session: recorder.RecorderSession) => void;
    vi.spyOn(recorder, 'startRecording').mockReturnValue(new Promise((resolve) => { late = resolve; }));
    const view = render(<VoiceInputModal onTranscript={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '開始錄音' }));
    view.unmount();
    const session = { stop: vi.fn(async () => new Blob()), cancel: vi.fn() };
    await act(async () => { late(session); });
    expect(session.cancel).toHaveBeenCalledTimes(1);
  });
});
