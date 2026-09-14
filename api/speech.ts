import { createOpenAIClient } from './_lib/openai';
import { failure, isRecord, readJsonBody, success } from './_lib/http';
import type { SpeechGenerationRequest } from '../src/types/speech';

const invalidSpeech = { code: 'INVALID_INPUT' as const, userTitle: '無法合成語音', userMessage: '發音內容過長或格式不正確。', actionableStep: '請直接展示畫面上的日文字給對方觀看。' };

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody<Partial<SpeechGenerationRequest>>(request);
    if (!isRecord(body) || typeof body.text !== 'string' || body.text.length === 0 || body.text.length > 500 || !['ja', 'zh-TW'].includes(body.language ?? '') || (body.speed && !['normal', 'slow'].includes(body.speed))) {
      return Response.json(failure(invalidSpeech), { status: 400 });
    }
    const speed = body.speed ?? 'normal';
    const client = createOpenAIClient();
    const audio = await client.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: body.language === 'ja' ? 'alloy' : 'alloy', input: body.text, response_format: 'mp3', speed: speed === 'slow' ? 0.75 : 1 });
    const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64');
    return Response.json(success({ audioUrl: `data:audio/mpeg;base64,${base64}`, mimeType: 'audio/mpeg', speed }));
  } catch {
    return Response.json(failure({ code: 'AI_SERVICE_UNAVAILABLE', userTitle: '語音播放服務暫時無法使用', userMessage: '無法產生語音檔。', actionableStep: '您可以複製日文或直接向對方展示螢幕文字。' }), { status: 500 });
  }
}