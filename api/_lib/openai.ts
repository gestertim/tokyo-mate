import OpenAI from 'openai';
import { createInstrumentedFetch } from './openai-attempt-instrumentation.js';

// verificationCorrelationId 僅用於一次性 attempt-level 驗證記錄，不影響 request semantics、maxRetries 或 timeout（均維持 SDK 預設）。
export function createOpenAIClient(verificationCorrelationId?: string): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey, fetch: createInstrumentedFetch(verificationCorrelationId) });
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}