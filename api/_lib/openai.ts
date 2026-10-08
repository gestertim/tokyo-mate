import OpenAI from 'openai';
import { createInstrumentedFetch, type OpenAIAttemptInstrumentationDeps } from './openai-attempt-instrumentation.js';

export function createOpenAIClient(
  verificationCorrelationId?: string,
  options: OpenAIAttemptInstrumentationDeps & { apiKey?: string; timeoutMs?: number } = {},
): OpenAI {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0))
    throw new RangeError('timeoutMs 必須為正安全整數');
  return new OpenAI({ apiKey, maxRetries: 0, fetch: createInstrumentedFetch(verificationCorrelationId, options),
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}) });
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}