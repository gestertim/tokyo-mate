// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './transcribe';
import { createOpenAIClient } from './_lib/openai';

vi.mock('./_lib/openai', () => ({
  createOpenAIClient: vi.fn(),
}));

describe('POST /api/transcribe contract', () => {
  const mockCreateTranscription = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAIClient).mockReturnValue({
      audio: {
        transcriptions: {
          create: mockCreateTranscription,
        },
      },
    } as unknown as ReturnType<typeof createOpenAIClient>);
  });

  it('rejects a missing audio file', async () => {
    const response = await POST(new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: new FormData(),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_INPUT' },
    });
  });

  it('rejects unsupported MIME types and files larger than 10 MB', async () => {
    for (const file of [
      new File(['audio'], 'recording.txt', { type: 'text/plain' }),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'recording.webm', { type: 'audio/webm' }),
    ]) {
      const form = new FormData();
      form.append('audio', file);
      const response = await POST(new Request('http://localhost/api/transcribe', { method: 'POST', body: form }));
      expect(response.status, file.name).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
    }
  });

  it('rejects an empty audio file', async () => {
    const form = new FormData();
    form.append('audio', new File([], 'recording.webm', { type: 'audio/webm' }));
    const response = await POST(new Request('http://localhost/api/transcribe', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
  });

  it('normalizes audio/webm;codecs=opus to audio/webm server file with .webm extension and passes exact bytes', async () => {
    const originalContent = 'fake-audio-binary-data';
    const encoder = new TextEncoder();
    const originalBytes = encoder.encode(originalContent);

    mockCreateTranscription.mockResolvedValueOnce({ text: '測試語音' });

    const form = new FormData();
    form.append('audio', new File([originalBytes], 'recording', { type: 'audio/webm;codecs=opus' }));
    form.append('language', 'zh');

    const response = await POST(new Request('http://localhost/api/transcribe', { method: 'POST', body: form }));
    expect(response.status).toBe(200);

    expect(mockCreateTranscription).toHaveBeenCalledTimes(1);
    const callArg = mockCreateTranscription.mock.calls[0][0];

    // 1. File name has .webm
    expect(callArg.file).toBeInstanceOf(File);
    expect(callArg.file.name).toBe('recording.webm');

    // 2. Provider File type is audio/webm
    expect(callArg.file.type).toBe('audio/webm');

    // 3. Original bytes preserved
    const sentBuffer = await callArg.file.arrayBuffer();
    expect(new Uint8Array(sentBuffer)).toEqual(originalBytes);

    // 4. Model and language
    expect(callArg.model).toBe('whisper-1');
    expect(callArg.language).toBe('zh');
  });

  it('maps all allowed MIME types to correct extensions', async () => {
    const mimeMap: Record<string, string> = {
      'audio/webm': 'recording.webm',
      'audio/mp4': 'recording.mp4',
      'audio/m4a': 'recording.m4a',
      'audio/wav': 'recording.wav',
      'audio/aac': 'recording.aac',
    };

    for (const [mimeType, expectedFilename] of Object.entries(mimeMap)) {
      mockCreateTranscription.mockResolvedValueOnce({ text: 'test' });
      const form = new FormData();
      form.append('audio', new File(['bytes'], 'recording', { type: mimeType }));

      const response = await POST(new Request('http://localhost/api/transcribe', { method: 'POST', body: form }));
      expect(response.status).toBe(200);

      const calls = mockCreateTranscription.mock.calls;
      const callArg = calls[calls.length - 1][0];
      expect(callArg.file.name).toBe(expectedFilename);
      expect(callArg.file.type).toBe(mimeType);
    }
  });
});