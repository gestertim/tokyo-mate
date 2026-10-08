import { AccessApiError } from './access-api';
import { meRecord } from '../types/self-service';

export type EpochEndpoint = 'assistant' | 'photo-ocr' | 'photo-translate' | 'places' | 'transcribe' | 'speech';
export interface IssuedCapability {
  capability: string;
  operationHandle: string;
  requestEpochId: string;
  issuedAt: string;
  expiresAt: string;
}
export interface PendingEpoch {
  endpoint: EpochEndpoint;
  issuanceCommandId: string;
  state: 'issuing' | 'unknown' | 'ready' | 'sent' | 'blocked';
  issued?: IssuedCapability;
}
const pending = new Map<EpochEndpoint, PendingEpoch>();
const changed = () => window.dispatchEvent(new Event('tokyo-mate:epoch-changed'));
export const pendingEpochs = () => [...pending.values()];
export function clearPendingEpochs(): void { pending.clear(); }
export function startNewEpochOperation(endpoint: EpochEndpoint): void { pending.delete(endpoint); changed(); }

function validIssued(value: unknown): value is IssuedCapability {
  return meRecord(value) && Object.keys(value).length === 5 &&
    typeof value.capability === 'string' && value.capability.length <= 1024 &&
    /^v1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value.capability) &&
    typeof value.operationHandle === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.operationHandle) &&
    typeof value.requestEpochId === 'string' && value.requestEpochId.length <= 64 &&
    /^g[1-9][0-9]*_[A-Za-z0-9_-]{22}$/.test(value.requestEpochId) &&
    typeof value.issuedAt === 'string' && typeof value.expiresAt === 'string' &&
    Number.isFinite(Date.parse(value.issuedAt)) && Date.parse(value.expiresAt) > Date.parse(value.issuedAt);
}
async function issue(command: PendingEpoch): Promise<IssuedCapability> {
  try {
    const response = await fetch('/api/me/request-epochs', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: command.endpoint, issuanceCommandId: command.issuanceCommandId }),
    });
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > 4096) throw new Error('INVALID_ISSUANCE_RESPONSE');
    const payload: unknown = JSON.parse(text);
    if (!response.ok) {
      if (meRecord(payload) && meRecord(payload.error) && typeof payload.error.code === 'string' &&
          typeof payload.error.userMessage === 'string' && typeof payload.error.actionableStep === 'string')
        throw new AccessApiError(payload.error.code, `${payload.error.userMessage} ${payload.error.actionableStep}`);
      throw new Error('INVALID_ISSUANCE_ERROR');
    }
    if (!meRecord(payload) || payload.success !== true || !validIssued(payload.data) ||
        payload.data.requestEpochId !== command.issuanceCommandId.split('.')[0]) throw new Error('INVALID_ISSUANCE_RESPONSE');
    return payload.data;
  } catch (error) {
    if (error instanceof AccessApiError) throw error;
    throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE',
      '無法確認 capability 是否已簽發；尚未送出付費操作。請手動確認原簽發結果，不要另開命令。');
  }
}
export async function prepareEpochOperation(endpoint: EpochEndpoint, epochId: string): Promise<IssuedCapability> {
  const old = pending.get(endpoint);
  if (old) {
    if (old.state === 'ready' && old.issued) return old.issued;
    throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE',
      old.state === 'sent' ? '原操作結果需要手動查詢；不會自動重送或補簽。' : '請使用「確認簽發結果」，確認後仍須再次手動送出。');
  }
  if (epochId.length > 64 || !/^g[1-9][0-9]*_[A-Za-z0-9_-]{22}$/.test(epochId))
    throw new AccessApiError('PROTECTION_SERVICE_UNAVAILABLE', '缺少可信 epoch，請稍後手動確認使用狀態。');
  const command: PendingEpoch = { endpoint, issuanceCommandId: `${epochId}.${crypto.randomUUID()}`, state: 'issuing' };
  pending.set(endpoint, command); changed();
  try {
    command.issued = await issue(command); command.state = 'ready'; changed();
    return command.issued;
  } catch (error) { command.state = 'unknown'; changed(); throw error; }
}
export async function confirmEpochIssuance(endpoint: EpochEndpoint): Promise<void> {
  const command = pending.get(endpoint);
  if (!command || command.state !== 'unknown') throw new AccessApiError('INVALID_INPUT', '沒有可確認的原簽發命令。');
  command.state = 'issuing'; changed();
  try { command.issued = await issue(command); command.state = 'ready'; changed(); }
  catch (error) { command.state = 'unknown'; changed(); throw error; }
}
export function markEpochSent(endpoint: EpochEndpoint): void {
  const command = pending.get(endpoint);
  if (!command || command.state !== 'ready') throw new AccessApiError('INVALID_INPUT', '沒有可送出的原操作授權。');
  command.state = 'sent'; changed();
}
export function markEpochBlocked(endpoint: EpochEndpoint): void {
  const command = pending.get(endpoint);
  if (command) { command.state = 'blocked'; changed(); }
}
