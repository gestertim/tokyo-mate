import { AccessApiError } from './access-api';
import { meRecord, isOwnRequest, isOwnRequestPage, isOperationView, projectOwnRequest,
  type OwnRequestInput } from '../types/self-service';

async function send<T>(path: string, guard: (v: unknown) => v is T, signal?: AbortSignal,
  body?: object, maxBytes = 65536): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AccessApiError('NETWORK_ERROR', '無法確認操作結果。請手動查詢本人清單或狀態，不會自動重送。');
  }
  let payload: unknown;
  try {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('INVALID_RESPONSE_SIZE');
    payload = JSON.parse(text);
  } catch {
    throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '回應資料無法確認，請稍後手動查詢。');
  }
  if (!response.ok || !meRecord(payload) || payload.success !== true) {
    if (meRecord(payload) && meRecord(payload.error) && typeof payload.error.code === 'string' &&
        typeof payload.error.userMessage === 'string' && typeof payload.error.actionableStep === 'string')
      throw new AccessApiError(payload.error.code, `${payload.error.userMessage} ${payload.error.actionableStep}`);
    throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '操作結果無法確認，請稍後手動查詢。');
  }
  if (!guard(payload.data)) throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '回應資料無法確認，請稍後手動查詢。');
  return payload.data;
}
export const loadOwnRequests = (offset = 0, signal?: AbortSignal) =>
  send(`/api/me/requests?offset=${offset}&limit=25`, isOwnRequestPage, signal);
export const submitOwnRequest = async (body: OwnRequestInput, signal?: AbortSignal) =>
  projectOwnRequest(await send('/api/me/requests', isOwnRequest, signal, body));
export const withdrawOwnRequest = async (reviewId: string, signal?: AbortSignal) =>
  projectOwnRequest(await send(`/api/me/requests/${encodeURIComponent(reviewId)}/withdraw`, isOwnRequest, signal, {}));
export const loadOperationStatus = (endpoint: string, idempotencyKey: string, signal?: AbortSignal) =>
  send('/api/me/operation-status', isOperationView, signal, { endpoint, idempotencyKey }, 4096);
export const loadEpochOperationStatus = (endpoint: string, requestEpochId: string, operationHandle: string, signal?: AbortSignal) =>
  send('/api/me/operation-status', isOperationView, signal, { endpoint, requestEpochId, operationHandle }, 4096);
