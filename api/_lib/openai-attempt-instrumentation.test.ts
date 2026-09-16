import { describe, expect, it, vi } from 'vitest';
import { createInstrumentedFetch, type OpenAIAttemptRecord } from './openai-attempt-instrumentation';

function jsonResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ output_text: 'ok' }), { status, headers });
}

describe('createInstrumentedFetch', () => {
  it('records a successful single attempt with status and sequence', async () => {
    const records: OpenAIAttemptRecord[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { 'x-request-id': 'req-123' }));
    const instrumentedFetch = createInstrumentedFetch('corr-1', { fetchImpl, onAttempt: (r) => records.push(r) });

    const response = await instrumentedFetch('https://api.openai.com/v1/responses', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: 'tokyo-mate.verification.openai-attempt',
      verificationCorrelationId: 'corr-1',
      attemptSequence: 1,
      httpStatus: 200,
      requestId: 'req-123',
    });
    expect(typeof records[0].attemptStartMs).toBe('number');
    expect(typeof records[0].attemptEndMs).toBe('number');
    expect(typeof records[0].attemptDurationMs).toBe('number');
  });

  it('does not swallow or rewrite a retryable HTTP response, and increments sequence per attempt', async () => {
    const records: OpenAIAttemptRecord[] = [];
    const retryableResponse = jsonResponse(429, { 'retry-after-ms': '250', 'retry-after': '1' });
    const successResponse = jsonResponse(200);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(retryableResponse)
      .mockResolvedValueOnce(successResponse);
    const instrumentedFetch = createInstrumentedFetch('corr-2', { fetchImpl, onAttempt: (r) => records.push(r) });

    const first = await instrumentedFetch('https://api.openai.com/v1/responses', { method: 'POST' });
    expect(first).toBe(retryableResponse);
    expect(first.status).toBe(429);
    const body = await first.json();
    expect(body).toEqual({ output_text: 'ok' });

    const second = await instrumentedFetch('https://api.openai.com/v1/responses', { method: 'POST' });
    expect(second).toBe(successResponse);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      attemptSequence: 1,
      httpStatus: 429,
      retryAfterMsHeaderPresent: true,
      retryAfterMsHeaderValue: 250,
      retryAfterHeaderPresent: true,
      retryAfterHeaderValue: 1,
    });
    expect(records[1]).toMatchObject({ attemptSequence: 2, httpStatus: 200 });
  });

  it('records a network error and still rethrows the original error unchanged', async () => {
    const records: OpenAIAttemptRecord[] = [];
    const networkError = new TypeError('fetch failed');
    const fetchImpl = vi.fn().mockRejectedValue(networkError);
    const instrumentedFetch = createInstrumentedFetch('corr-3', { fetchImpl, onAttempt: (r) => records.push(r) });

    await expect(instrumentedFetch('https://api.openai.com/v1/responses', { method: 'POST' })).rejects.toBe(networkError);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      attemptSequence: 1,
      networkErrorClass: 'TypeError',
    });
    expect(records[0].httpStatus).toBeUndefined();
  });

  it('never includes the request body in the instrumentation payload', async () => {
    const records: OpenAIAttemptRecord[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200));
    const instrumentedFetch = createInstrumentedFetch('corr-4', { fetchImpl, onAttempt: (r) => records.push(r) });
    const sensitiveBody = JSON.stringify({ input: 'super secret prompt about a user location', model: 'gpt-4o-mini' });

    await instrumentedFetch('https://api.openai.com/v1/responses', { method: 'POST', body: sensitiveBody });

    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain('super secret prompt');
    expect(serialized).not.toContain('gpt-4o-mini');
    // wrapper 必須 transparent：原始 body 原樣傳給底層 fetch
    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.com/v1/responses', { method: 'POST', body: sensitiveBody });
  });

  it('never includes Authorization header or API key in the instrumentation payload', async () => {
    const records: OpenAIAttemptRecord[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200));
    const instrumentedFetch = createInstrumentedFetch('corr-5', { fetchImpl, onAttempt: (r) => records.push(r) });
    const init: RequestInit = { method: 'POST', headers: { Authorization: 'Bearer sk-super-secret-key' } };

    await instrumentedFetch('https://api.openai.com/v1/responses', init);

    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain('sk-super-secret-key');
    expect(serialized).not.toContain('Authorization');
    // wrapper 必須 transparent：原始 headers 原樣傳給底層 fetch
    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.com/v1/responses', init);
  });
});
