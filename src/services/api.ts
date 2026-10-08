import type { AssistantResult } from '../types/assistant';
import type { ProductError } from '../types/error';
import type { AudioTranscriptionResult, SpeechGenerationRequest } from '../types/speech';
import type { UserRequest } from '../types/request';
import type { NearbySearchRequest, PlaceResult } from '../types/place';
import type { PhotoTranslateTargetLanguage } from '../types/photoTranslate';
import { AccessApiError, loadOwnQuota } from './access-api';
import { markEpochBlocked, markEpochSent, pendingEpochs, prepareEpochOperation, startNewEpochOperation, type EpochEndpoint } from './request-epoch-api';

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

async function confirmPaidFeatureAccess() {
  try {
    return await loadOwnQuota();
  } catch (error) {
    if (!(error instanceof AccessApiError)) throw error;
    const code = error.code === 'AUTH_REQUIRED' || error.code === 'ACCESS_NOT_APPROVED' ||
      error.code === 'NETWORK_ERROR' ? error.code : 'PROTECTION_SERVICE_UNAVAILABLE';
    throw {
      code,
      userTitle: '無法使用付費功能',
      userMessage: error.message,
      actionableStep: code === 'AUTH_REQUIRED' ? '請先登入；原輸入不會自動送出。' :
        '你仍可查看公開內容；確認狀態後請手動操作。',
    } satisfies ProductError;
  }
}

async function request<T>(path: string, init: RequestInit, observer?: AssistantRequestObserver): Promise<T> {
  try {
    const quota = await confirmPaidFeatureAccess();
    const endpoint = path.slice('/api/'.length) as EpochEndpoint;
    if (!quota.requestEpoch && pendingEpochs().some((command) => command.endpoint === endpoint))
      throw { code: 'PROTECTION_SERVICE_UNAVAILABLE', userTitle: '無法確認原操作授權',
        userMessage: '原操作的 epoch 狀態目前無法確認，不會切回 legacy 重送。',
        actionableStep: '請手動查看原操作狀態。' } satisfies ProductError;
    if (quota.requestEpoch) {
      try {
        const issued = await prepareEpochOperation(endpoint, quota.requestEpoch.epochId);
        const headers = new Headers(init.headers);
        headers.set('X-Request-Capability', issued.capability);
        headers.set('Idempotency-Key', issued.operationHandle);
        if (init.body instanceof FormData) init.body.set('idempotencyKey', issued.operationHandle);
        else if (typeof init.body === 'string') {
          const body: unknown = JSON.parse(init.body);
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_PAID_BODY');
          init = { ...init, body: JSON.stringify({ ...body, idempotencyKey: issued.operationHandle }) };
        } else throw new Error('INVALID_PAID_BODY');
        init = { ...init, headers, credentials: 'same-origin', cache: 'no-store' };
        markEpochSent(endpoint);
      } catch (error) {
        if (!(error instanceof AccessApiError)) throw error;
        const code = error.code === 'AUTH_REQUIRED' || error.code === 'ACCESS_NOT_APPROVED' ||
          error.code === 'OPERATION_NO_LONGER_EXECUTABLE' || error.code === 'IDEMPOTENCY_CONFLICT' ||
          error.code === 'RATE_LIMITED' ? error.code : 'PROTECTION_SERVICE_UNAVAILABLE';
        throw { code, userTitle: '請手動確認原操作', userMessage: error.message,
          actionableStep: '請使用原操作手動確認區；確認成功也不會自動送出。' } satisfies ProductError;
      }
    }
    observer?.onFetchStart?.(performance.now());
    const response = await fetch(path, init);
    observer?.onResponseReceived?.(performance.now(), response);
    const payload = (await response.json()) as ApiResponse<T>;
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('tokyo-mate:quota-changed'));
    observer?.onResponseParsed?.(performance.now(), response);
    if (!response.ok || !payload.success) {
      if (quota.requestEpoch && !payload.success &&
          ['OPERATION_NO_LONGER_EXECUTABLE', 'IDEMPOTENCY_CONFLICT'].includes(payload.error.code)) markEpochBlocked(endpoint);
      throw payload.success ? new Error('Request failed') : payload.error;
    }
    if (quota.requestEpoch) startNewEpochOperation(endpoint);
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