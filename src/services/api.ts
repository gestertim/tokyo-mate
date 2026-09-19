import type { AssistantResult } from '../types/assistant';
import type { ProductError } from '../types/error';
import type { AudioTranscriptionResult, SpeechGenerationRequest } from '../types/speech';
import type { UserRequest } from '../types/request';
import type { NearbySearchRequest, PlaceResult } from '../types/place';
import type { PhotoTranslateTargetLanguage } from '../types/photoTranslate';

interface ApiSuccess<T> { success: true; data: T }
interface ApiFailure { success: false; error: ProductError }
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface AssistantRequestObserver {
  verificationCorrelationId: string;
  onFetchStart?: (at: number) => void;
  onResponseReceived?: (at: number, response: Response) => void;
  onResponseParsed?: (at: number, response: Response) => void;
}

let assistantRequestObserver: AssistantRequestObserver | undefined;

export function setAssistantRequestObserver(observer: AssistantRequestObserver | undefined): void {
  assistantRequestObserver = observer;
}

async function request<T>(path: string, init: RequestInit, observer?: AssistantRequestObserver): Promise<T> {
  try {
    observer?.onFetchStart?.(performance.now());
    const response = await fetch(path, init);
    observer?.onResponseReceived?.(performance.now(), response);
    const payload = (await response.json()) as ApiResponse<T>;
    observer?.onResponseParsed?.(performance.now(), response);
    if (!response.ok || !payload.success) {
      throw payload.success ? new Error('Request failed') : payload.error;
    }
    return payload.data;
  } catch (error) {
    if (isProductError(error)) throw error;
    throw {
      code: 'NETWORK_ERROR',
      userTitle: '目前無法連線',
      userMessage: '請確認網路連線後再試一次。',
      actionableStep: '恢復網路後點擊重試。',
    } satisfies ProductError;
  }
}

export function requestAssistant(input: UserRequest, observer?: AssistantRequestObserver): Promise<AssistantResult> {
  return request<AssistantResult>('/api/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(observer ? { 'X-Tokyo-Mate-Verification-Id': observer.verificationCorrelationId } : {}),
    },
    body: JSON.stringify(input),
  }, observer ?? assistantRequestObserver);
}

export function transcribeAudio(audio: Blob, language?: string): Promise<AudioTranscriptionResult> {
  const body = new FormData();
  body.append('audio', audio, 'recording');
  if (language) body.append('language', language);
  return request<AudioTranscriptionResult>('/api/transcribe', { method: 'POST', body });
}

export function requestPlaces(input: NearbySearchRequest): Promise<{ places: PlaceResult[] }> {
  return request<{ places: PlaceResult[] }>('/api/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function generateSpeech(input: SpeechGenerationRequest): Promise<{ audioUrl: string; mimeType: string; speed: string }> {
  return request('/api/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export interface PhotoOcrResult {
  reliableTextFound: boolean;
  sourceText?: string;
  regionVersion: number;
}

export function requestPhotoOcr(imageDataUrl: string, regionVersion: number): Promise<PhotoOcrResult> {
  return request<PhotoOcrResult>('/api/photo-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, regionVersion }),
  });
}

export interface PhotoTranslateResult {
  sameLanguage: boolean;
  translatedText?: string;
  targetLanguage: PhotoTranslateTargetLanguage;
}

export function requestPhotoTranslate(
  sourceText: string,
  targetLanguage: PhotoTranslateTargetLanguage,
): Promise<PhotoTranslateResult> {
  return request<PhotoTranslateResult>('/api/photo-translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceText, targetLanguage }),
  });
}

function isProductError(value: unknown): value is ProductError {
  return typeof value === 'object' && value !== null && 'code' in value && 'userMessage' in value;
}