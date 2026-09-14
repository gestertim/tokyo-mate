import { createOpenAIClient } from './_lib/openai.js';
import { failure, success } from './_lib/http.js';

const allowedMimeTypes = new Set(['audio/webm', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/aac']);
const mimeExtensionMap: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
};

const invalidAudio = { code: 'INVALID_INPUT' as const, userTitle: '音訊檔案無效', userMessage: '無法讀取錄音檔案，請重新錄音。', actionableStep: '請確認麥克風功能正常後再試一次，或改用文字輸入。' };

export async function POST(request: Request): Promise<Response> {
  try {
    let form: FormData;
    try { form = await request.formData(); } catch { return Response.json(failure(invalidAudio), { status: 400 }); }
    const audio = form.get('audio');

    if (!isAudioFile(audio) || audio.size === 0 || audio.size > 10 * 1024 * 1024) {
      return Response.json(failure(invalidAudio), { status: 400 });
    }

    const baseMimeType = getBaseMimeType(audio.type);
    if (!allowedMimeTypes.has(baseMimeType)) {
      return Response.json(failure(invalidAudio), { status: 400 });
    }

    if (typeof audio.arrayBuffer !== 'function') {
      return Response.json(failure(invalidAudio), { status: 400 });
    }
    let audioBytes: ArrayBuffer;
    try { audioBytes = await audio.arrayBuffer(); } catch { return Response.json(failure(invalidAudio), { status: 400 }); }
    if (audioBytes.byteLength === 0 || audioBytes.byteLength > 10 * 1024 * 1024) return Response.json(failure(invalidAudio), { status: 400 });

    const extension = mimeExtensionMap[baseMimeType];
    if (!extension) {
      return Response.json(failure(invalidAudio), { status: 400 });
    }

    const serverFile = new File([audioBytes], `recording.${extension}`, { type: baseMimeType });

    const requestedLanguage = form.get('language');
    const languageParam = typeof requestedLanguage === 'string' ? requestedLanguage : undefined;
    const transcriptionModel = 'whisper-1';

    const client = createOpenAIClient();
    const result = await client.audio.transcriptions.create({
      file: serverFile,
      model: transcriptionModel,
      language: languageParam,
    });

    return Response.json(success({ text: result.text, detectedLanguage: languageParam }));
  } catch {
    return Response.json(failure({ code: 'TRANSCRIPTION_FAILED', userTitle: '語音辨識失敗', userMessage: '目前無法辨識語音內容。', actionableStep: '請改用文字輸入，或至安靜環境重新錄音。' }), { status: 500 });
  }
}

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === 'object' && 'size' in value && 'type' in value && 'name' in value);
}

function getBaseMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase();
}