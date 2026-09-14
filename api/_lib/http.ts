import type { ProductError } from '../../src/types/error';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: ProductError;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export function success<T>(data: T): SuccessEnvelope<T> {
  return { success: true, data };
}

export function failure(error: ProductError): ErrorEnvelope {
  return { success: false, error };
}

export function assertMethod(request: Request, method: string): void {
  if (request.method !== method) {
    throw new Error(`Method ${request.method} is not allowed`);
  }
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Expected application/json');
  }
  return (await request.json()) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}