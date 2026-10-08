import { createHmac, KeyObject } from 'node:crypto';
import { parseIsoUtc, type CostModelRef, type ProtectedEndpoint } from './cost-price-table';
import { validateEstimateInputs, type EstimateBounds, type EstimateInputs } from './quota-estimate-inputs';

export type RequestContent = null | boolean | number | string | Uint8Array | RequestContent[] | { [key: string]: RequestContent };

export interface FingerprintKey {
  version: string;
  key: KeyObject;
}

export interface TrustedFingerprintCost {
  endpoint: ProtectedEndpoint;
  amountMicroUsd: number;
  costModel: CostModelRef;
  model: string | null;
  billingTier: 'standard';
  attempts: 1;
  estimateInputs: EstimateInputs;
  estimateBounds: EstimateBounds;
  costParametersDigest?: string;
}

export interface FingerprintParts {
  identitySubject: string;
  endpoint: ProtectedEndpoint;
  content: RequestContent;
  trustedCost: TrustedFingerprintCost;
}

export const HMAC_SHA256_HEX = /^[0-9a-f]{64}$/;
export const FINGERPRINT_FORMAT = 'tokyo-mate/quota-fingerprint/hmac-sha256/v2';
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_.:+/-]{1,128}$/.test(value);

export class FingerprintConfigError extends Error {
  constructor() {
    super('HMAC 設定無效');
    this.name = 'FingerprintConfigError';
  }
}

export class FingerprintInputError extends Error {
  constructor(public readonly field: string) {
    super(`指紋輸入無效：${field}`);
    this.name = 'FingerprintInputError';
  }
}

export function validateFingerprintKey(value: FingerprintKey | undefined): FingerprintKey {
  if (!value || !identifier(value.version) || !(value.key instanceof KeyObject) ||
      value.key.type !== 'secret' || typeof value.key.symmetricKeySize !== 'number' ||
      value.key.symmetricKeySize < 32) throw new FingerprintConfigError();
  return value;
}

export function validateTrustedCost(value: TrustedFingerprintCost | undefined, endpoint: ProtectedEndpoint): TrustedFingerprintCost {
  if (!value || value.endpoint !== endpoint || !Number.isSafeInteger(value.amountMicroUsd) || value.amountMicroUsd <= 0 ||
      value.billingTier !== 'standard' || value.attempts !== 1 || !value.estimateBounds ||
      (endpoint === 'places' ? value.model !== null : !identifier(value.model))) {
    throw new FingerprintInputError('trustedCost');
  }
  const fields = ['endpoint', 'amountMicroUsd', 'costModel', 'model', 'billingTier', 'attempts', 'estimateInputs', 'estimateBounds', 'costParametersDigest'];
  if (value.costParametersDigest !== undefined && !HMAC_SHA256_HEX.test(value.costParametersDigest)) {
    throw new FingerprintInputError('costParametersDigest');
  }
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !fields.includes(key))) {
    throw new FingerprintInputError('trustedCost');
  }
  const model = value.costModel;
  const from = parseIsoUtc(model?.effectiveFrom);
  const until = parseIsoUtc(model?.expiresAt);
  if (!model || !identifier(model.version) || from === null || until === null || from >= until) {
    throw new FingerprintInputError('costModel');
  }
  return { ...value, estimateInputs: validateEstimateInputs(endpoint, value.estimateInputs, value.estimateBounds) };
}

// 型別標籤避免文字／數字／binary 碰撞；只有物件鍵排序，陣列順序保留。
export function canonicalContent(value: RequestContent): string {
  const seen = new Set<object>();
  const encode = (item: RequestContent): unknown => {
    if (item === null) return ['null'];
    if (typeof item === 'string' || typeof item === 'boolean') return [typeof item, item];
    if (typeof item === 'number' && Number.isFinite(item)) return ['number', Object.is(item, -0) ? '-0' : String(item)];
    if (item instanceof Uint8Array) return ['bytes', Buffer.from(item).toString('base64')];
    if (!item || typeof item !== 'object' || seen.has(item)) throw new FingerprintInputError('content');
    seen.add(item);
    try {
      if (Array.isArray(item)) {
        if (Reflect.ownKeys(item).length !== item.length + 1 ||
            Array.from({ length: item.length }, (_, i) => Object.getOwnPropertyDescriptor(item, String(i)))
              .some((descriptor) => !descriptor || !('value' in descriptor) || !descriptor.enumerable)) {
          throw new FingerprintInputError('content');
        }
        return ['array', item.map(encode)];
      }
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
        throw new FingerprintInputError('content');
      }
      if (Reflect.ownKeys(item).length !== Object.keys(item).length) throw new FingerprintInputError('content');
      return ['object', Object.keys(item).sort().map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !('value' in descriptor)) throw new FingerprintInputError('content');
        return [key, encode(descriptor.value)];
      })];
    } finally {
      seen.delete(item);
    }
  };
  return JSON.stringify(encode(value));
}

export function buildRequestFingerprint(parts: FingerprintParts, injectedKey: FingerprintKey | undefined): string {
  const key = validateFingerprintKey(injectedKey);
  const cost = validateTrustedCost(parts.trustedCost, parts.endpoint);
  // 內容先做 keyed digest；此中間值僅存在於記憶體，不交給 store。
  const contentHmac = createHmac('sha256', key.key)
    .update(JSON.stringify([FINGERPRINT_FORMAT, 'content', key.version, canonicalContent(parts.content)]))
    .digest('hex');
  return createHmac('sha256', key.key).update(JSON.stringify([
    FINGERPRINT_FORMAT, 'request', key.version,
    parts.identitySubject, parts.endpoint,
    cost.amountMicroUsd, cost.costModel.version, cost.costModel.effectiveFrom, cost.costModel.expiresAt,
    cost.model, cost.billingTier, cost.attempts,
    cost.costParametersDigest ?? null,
    canonicalContent(cost.estimateInputs), contentHmac,
  ])).digest('hex');
}
