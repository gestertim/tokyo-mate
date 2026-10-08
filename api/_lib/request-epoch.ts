import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PROTECTED_ENDPOINTS, type ProtectedEndpoint } from './cost-price-table';

const CAPABILITY_DOMAIN = 'tm/capability-sign/v1';
const OWNER_SCOPE_DOMAIN = 'tm/owner-scope/v1';
const EPOCH_DOMAIN = 'tm/request-capability/v1';
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const VERSION = /^[A-Za-z0-9_-]{1,64}$/;
const SUBJECT = /^[\x21-\x7e]{1,200}$/;
const KEY_ID = /^[A-Za-z0-9_-]{22}$/;
const HANDLE = /^[A-Za-z0-9_-]{43}$/;
const ISO_EPOCH = /^g[1-9][0-9]*_[A-Za-z0-9_-]{22}$/;
const endpointSet = new Set<string>(PROTECTED_ENDPOINTS);

export interface CapabilityPayload {
  generation: number;
  epochId: string;
  kid: string;
  scopeKeyVersion: string;
  ownerScope: string;
  endpoint: ProtectedEndpoint;
  operationHandle: string;
  issuedAtMs: number;
  expiresAtMs: number;
}

export interface CapabilityVerificationKey {
  kid: string;
  key: Uint8Array;
  state: 'current' | 'verify_only' | 'revoked';
}

function isSafeTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SAFE;
}

type CapabilityWire = readonly [
  typeof EPOCH_DOMAIN, number, string, string, string, string, ProtectedEndpoint, string, number, number,
];

function isPayload(value: unknown): value is CapabilityWire {
  if (!Array.isArray(value) || value.length !== 10 || value[0] !== EPOCH_DOMAIN) return false;
  const [, generation, epochId, kid, scopeKeyVersion, ownerScope, endpoint, operationHandle, issuedAtMs, expiresAtMs] = value;
  const epochGeneration = typeof epochId === 'string' ? /^g([1-9][0-9]*)_/.exec(epochId) : null;
  return Number.isSafeInteger(generation) && Number(generation) > 0 &&
    typeof epochId === 'string' && epochId.length <= 64 && ISO_EPOCH.test(epochId) &&
    epochGeneration !== null && Number(epochGeneration[1]) === generation &&
    typeof kid === 'string' && KEY_ID.test(kid) &&
    typeof scopeKeyVersion === 'string' && VERSION.test(scopeKeyVersion) &&
    typeof ownerScope === 'string' && HANDLE.test(ownerScope) &&
    typeof endpoint === 'string' && endpointSet.has(endpoint) &&
    typeof operationHandle === 'string' && HANDLE.test(operationHandle) &&
    isSafeTime(issuedAtMs) && isSafeTime(expiresAtMs) && expiresAtMs > issuedAtMs;
}

function payloadBytes(payload: CapabilityPayload): Buffer {
  return Buffer.from(JSON.stringify([
    EPOCH_DOMAIN, payload.generation, payload.epochId, payload.kid, payload.scopeKeyVersion,
    payload.ownerScope, payload.endpoint, payload.operationHandle, payload.issuedAtMs, payload.expiresAtMs,
  ]), 'utf8');
}

export function isCapabilityPayload(value: unknown): value is CapabilityPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return Object.keys(p).length === 9 && isPayload([EPOCH_DOMAIN, p.generation, p.epochId, p.kid,
    p.scopeKeyVersion, p.ownerScope, p.endpoint, p.operationHandle, p.issuedAtMs, p.expiresAtMs]);
}

function mac(key: Uint8Array, kid: string, payloadEncoded: string): Buffer {
  if (key.byteLength !== 32 || !KEY_ID.test(kid)) throw new TypeError('invalid capability signing key');
  const input = Buffer.from(JSON.stringify([CAPABILITY_DOMAIN, kid, payloadEncoded]), 'utf8');
  return createHmac('sha256', key).update(input).digest();
}

export function newOperationHandle(): string {
  return randomBytes(32).toString('base64url');
}

export function makeIssuanceCommandId(epochId: string, uuid: string): string {
  if (epochId.length > 64 || !ISO_EPOCH.test(epochId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid) ||
      `${epochId}.${uuid}`.length > 101)
    throw new TypeError('invalid issuance command');
  return `${epochId}.${uuid}`;
}

export function deriveOwnerScope(key: Uint8Array, scopeKeyVersion: string, subject: string): string {
  if (key.byteLength !== 32 || !VERSION.test(scopeKeyVersion) || !SUBJECT.test(subject))
    throw new TypeError('invalid owner scope input');
  return createHmac('sha256', key)
    .update(JSON.stringify([OWNER_SCOPE_DOMAIN, scopeKeyVersion, subject]), 'utf8')
    .digest('base64url');
}

export function deriveRequestEpochIndex(
  key: Uint8Array,
  domain: 'tm/issuance-index/v1' | 'tm/operation-index/v1',
  values: readonly string[],
): string {
  if (key.byteLength !== 32 || values.some((value) => !/^[\x21-\x7e]{1,256}$/.test(value)))
    throw new TypeError('invalid request epoch index input');
  return createHmac('sha256', key).update(JSON.stringify([domain, ...values]), 'utf8').digest('base64url');
}

export function signCapability(payload: CapabilityPayload, key: Uint8Array): string {
  const wire = [
    EPOCH_DOMAIN, payload.generation, payload.epochId, payload.kid, payload.scopeKeyVersion,
    payload.ownerScope, payload.endpoint, payload.operationHandle, payload.issuedAtMs, payload.expiresAtMs,
  ] as const;
  if (!isPayload(wire)) throw new TypeError('invalid capability payload');
  const encodedPayload = payloadBytes(payload).toString('base64url');
  const encodedMac = mac(key, payload.kid, encodedPayload).toString('base64url');
  const token = `v1.${payload.kid}.${encodedPayload}.${encodedMac}`;
  if (Buffer.byteLength(token, 'ascii') > 1024) throw new TypeError('capability exceeds limit');
  return token;
}

function decodeBase64url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : null;
}

export function verifyCapability(
  token: string,
  keys: readonly CapabilityVerificationKey[],
): CapabilityPayload | null {
  if (typeof token !== 'string' || !/^[\x21-\x7e]+$/.test(token) || Buffer.byteLength(token, 'ascii') > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !KEY_ID.test(parts[1])) return null;
  const [, kid, encodedPayload, encodedMac] = parts;
  const candidates = keys.filter((candidate) => candidate.kid === kid && candidate.state !== 'revoked');
  if (candidates.length !== 1 || candidates[0].key.byteLength !== 32) return null;
  const payloadBuffer = decodeBase64url(encodedPayload);
  const suppliedMac = decodeBase64url(encodedMac);
  if (!payloadBuffer || !suppliedMac || suppliedMac.byteLength !== 32) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(payloadBuffer.toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (!isPayload(decoded) || decoded[3] !== kid ||
      !Buffer.from(JSON.stringify(decoded), 'utf8').equals(payloadBuffer)) return null;
  const expectedMac = mac(candidates[0].key, kid, encodedPayload);
  if (!timingSafeEqual(expectedMac, suppliedMac)) return null;
  return {
    generation: decoded[1],
    epochId: decoded[2],
    kid: decoded[3],
    scopeKeyVersion: decoded[4],
    ownerScope: decoded[5],
    endpoint: decoded[6],
    operationHandle: decoded[7],
    issuedAtMs: decoded[8],
    expiresAtMs: decoded[9],
  };
}

export function capabilityTimeValid(payload: CapabilityPayload, nowMs: number): boolean {
  return isSafeTime(nowMs) && payload.issuedAtMs <= nowMs && nowMs < payload.expiresAtMs;
}

export function accountingLookupIndex(epochId: string, operationHandle: string): string {
  if (epochId.length > 64 || !ISO_EPOCH.test(epochId) || !HANDLE.test(operationHandle))
    throw new TypeError('invalid accounting lookup');
  return createHash('sha256').update(JSON.stringify(['tm/accounting-lookup/v1', epochId, operationHandle])).digest('hex');
}
