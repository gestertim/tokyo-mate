import type { AssistantResult } from '../types/assistant';
import type { ProductError } from '../types/error';
import type { AudioTranscriptionResult, SpeechGenerationRequest } from '../types/speech';
import type { UserRequest } from '../types/request';
import type { NearbySearchRequest, PlaceResult } from '../types/place';

interface ApiSuccess<T> { success: true; data: T }
interface ApiFailure { success: false; error: ProductError }
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

async function request<T>(path: string, init: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, init);
    const payload = (await response.json()) as ApiResponse<T>;
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

export function requestAssistant(input: UserRequest): Promise<AssistantResult> {
  return request<AssistantResult>('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
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

function isProductError(value: unknown): value is ProductError {
  return typeof value === 'object' && value !== null && 'code' in value && 'userMessage' in value;
}