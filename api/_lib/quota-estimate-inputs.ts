import type { ProtectedEndpoint } from './cost-price-table';

export type EstimateInputs = Partial<{
  inputTokens: number;
  maxOutputTokens: number;
  imageBytes: number;
  detail: 'low' | 'high' | 'auto';
  audioDataBytes: number;
  billedMinutes: number;
  characterCount: number;
  speed: number;
}>;
export type EstimateBounds = Partial<Record<Exclude<keyof EstimateInputs, 'detail'>, number>>;

export const ESTIMATE_FIELDS = {
  assistant: ['inputTokens', 'maxOutputTokens'],
  'photo-translate': ['inputTokens', 'maxOutputTokens', 'imageBytes', 'detail'],
  'photo-ocr': ['inputTokens', 'maxOutputTokens', 'imageBytes', 'detail'],
  transcribe: ['audioDataBytes', 'billedMinutes'],
  places: [],
  speech: ['characterCount', 'speed'],
} as const satisfies Record<ProtectedEndpoint, readonly (keyof EstimateInputs)[]>;

export class EstimateInputError extends Error {
  constructor() {
    super('estimateInputs 或可信上限無效');
    this.name = 'EstimateInputError';
  }
}

export function validateEstimateInputs(endpoint: ProtectedEndpoint, value: unknown, bounds?: EstimateBounds): EstimateInputs {
  const fields: readonly string[] | undefined = ESTIMATE_FIELDS[endpoint];
  if (!fields || !value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw new EstimateInputError();
  const entries = Object.entries(Object.getOwnPropertyDescriptors(value));
  if (Reflect.ownKeys(value).length !== entries.length) throw new EstimateInputError();
  if (bounds !== undefined) {
    if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds) ||
        (Object.getPrototypeOf(bounds) !== Object.prototype && Object.getPrototypeOf(bounds) !== null)) throw new EstimateInputError();
    for (const key of Reflect.ownKeys(bounds)) {
      const descriptor = Object.getOwnPropertyDescriptor(bounds, key);
      if (typeof key !== 'string' || !fields.includes(key) || key === 'detail' ||
          !descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new EstimateInputError();
    }
    for (const field of fields) {
      if (field === 'detail') continue;
      const max = bounds[field as keyof EstimateBounds];
      if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0 || max > Number.MAX_SAFE_INTEGER ||
          (field !== 'speed' && !Number.isSafeInteger(max))) throw new EstimateInputError();
    }
  }
  const output: EstimateInputs = {};
  for (const [field, descriptor] of entries) {
    if (!fields.includes(field) || !('value' in descriptor) || !descriptor.enumerable) throw new EstimateInputError();
    const v: unknown = descriptor.value;
    if (field === 'detail') {
      if (v !== 'low' && v !== 'high' && v !== 'auto') throw new EstimateInputError();
      output.detail = v;
    } else {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > Number.MAX_SAFE_INTEGER ||
          (field === 'speed' ? v <= 0 : !Number.isSafeInteger(v))) throw new EstimateInputError();
      if (!['inputTokens', 'characterCount'].includes(field) && v === 0) throw new EstimateInputError();
      if (field === 'audioDataBytes' && v % 2 !== 0) throw new EstimateInputError();
      const key = field as keyof EstimateBounds;
      if (bounds !== undefined && v > bounds[key]!) throw new EstimateInputError();
      output[key] = v;
    }
  }
  if (output.audioDataBytes !== undefined && output.billedMinutes !== undefined &&
      output.billedMinutes !== Math.ceil(output.audioDataBytes / 1_920_000)) throw new EstimateInputError();
  return output;
}
