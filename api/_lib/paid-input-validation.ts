import type { ProtectedEndpoint } from './cost-price-table';
import { isRecord } from './http';
import { RequestBoundaryError } from './bounded-request';
import { validateAndRebuildPcmWav } from './audio-pcm';

const fields = (body: unknown, allowed: readonly string[]): body is Record<string, unknown> =>
  isRecord(body) && Reflect.ownKeys(body).every((key) => typeof key === 'string' && allowed.includes(key));
const text = (value: unknown, max: number, allowEmpty = false) =>
  typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
const member = (value: unknown, values: readonly string[]) => typeof value === 'string' && values.includes(value);
function location(value: unknown): boolean {
  if (!fields(value, ['type', 'manualArea', 'coordinates'])) return false;
  if (value.type === 'manual') return fields(value, ['type', 'manualArea']) && text(value.manualArea, 50);
  if (value.type !== 'coordinates' || !fields(value, ['type', 'coordinates']) ||
      !fields(value.coordinates, ['latitude', 'longitude'])) return false;
  const { latitude, longitude } = value.coordinates;
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}
export function validatePaidJson(endpoint: Exclude<ProtectedEndpoint, 'transcribe'>, body: unknown): boolean {
  if (isRecord(body) && Object.hasOwn(body, 'idempotencyKey')) {
    if (typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.idempotencyKey)) return false;
    const { idempotencyKey: _handle, ...content } = body;
    return validatePaidJson(endpoint, content);
  }
  if (endpoint === 'assistant') {
    if (!fields(body, ['id', 'text', 'inputType', 'tone', 'location', 'context']) ||
        !text(body.text, 1000) || !member(body.inputType, ['text', 'voice', 'quick_action']) ||
        (body.id !== undefined && typeof body.id !== 'string') ||
        (body.tone !== undefined && !member(body.tone, ['default', 'polite', 'casual'])) ||
        (body.location !== undefined && !location(body.location))) return false;
    return body.context === undefined || fields(body.context, ['previousIntent', 'currentArea']) &&
      Object.values(body.context).every((v) => typeof v === 'string');
  }
  if (endpoint === 'places') return fields(body, ['location', 'category', 'query']) && location(body.location) &&
    (body.category === undefined || member(body.category, ['food', 'shopping', 'attraction', 'convenience', 'station', 'all'])) &&
    (body.query === undefined || text(body.query, 100, true));
  if (endpoint === 'photo-translate') return fields(body, ['sourceText', 'targetLanguage']) &&
    text(body.sourceText, 2000) && member(body.targetLanguage, ['zh-TW', 'ja']);
  if (endpoint === 'speech') return fields(body, ['text', 'language', 'speed']) && text(body.text, 500) &&
    member(body.language, ['ja', 'zh-TW']) && (body.speed === undefined || member(body.speed, ['normal', 'slow']));
  return fields(body, ['imageDataUrl', 'regionVersion']) && typeof body.regionVersion === 'number' &&
    Number.isSafeInteger(body.regionVersion) && body.regionVersion > 0 && body.regionVersion <= 9999999999 &&
    typeof body.imageDataUrl === 'string';
}
export function validateImageEnvelope(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new RequestBoundaryError('INVALID_INPUT');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.toString('base64') !== match[2] || bytes.length === 0) throw new RequestBoundaryError('INVALID_INPUT');
  if (bytes.length > 3145728) throw new RequestBoundaryError('PAYLOAD_TOO_LARGE');
  return { mime: match[1], bytes };
}
export interface ParsedPcmMultipart {
  wav: Uint8Array;
  dataBytes: number;
  durationSeconds: number;
  language: string | null;
  idempotencyKey: string | null;
}

export async function parsePcmMultipart(request: Request, bytes: Uint8Array): Promise<ParsedPcmMultipart> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;'))
    throw new RequestBoundaryError('INVALID_INPUT');
  let form: FormData;
  try {
    form = await new Request(request.url, { method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type')! }, body: Uint8Array.from(bytes) }).formData();
  } catch {
    throw new RequestBoundaryError('INVALID_INPUT');
  }
  if ([...form.keys()].some((key) => !['audio', 'language', 'idempotencyKey'].includes(key)) ||
      form.getAll('audio').length !== 1 || form.getAll('language').length > 1 || form.getAll('idempotencyKey').length > 1)
    throw new RequestBoundaryError('INVALID_INPUT');
  const audio = form.get('audio'), language = form.get('language');
  if (!(audio instanceof File) || audio.type !== 'audio/wav' || (language !== null && typeof language !== 'string'))
    throw new RequestBoundaryError('INVALID_INPUT');
  const result = validateAndRebuildPcmWav(new Uint8Array(await audio.arrayBuffer()));
  if (!result.ok) throw new RequestBoundaryError(result.code);
  const handle = form.get('idempotencyKey');
  if (handle !== null && (typeof handle !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(handle)))
    throw new RequestBoundaryError('INVALID_INPUT');
  return { wav: result.wav, dataBytes: result.dataBytes, durationSeconds: result.durationSeconds,
    language: typeof language === 'string' ? language : null, idempotencyKey: typeof handle === 'string' ? handle : null };
}

export async function validatePcmMultipart(request: Request, bytes: Uint8Array): Promise<string | null> {
  return (await parsePcmMultipart(request, bytes)).idempotencyKey;
}
