// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createOpenAIClient } from '../../api/_lib/openai';
import type { OpenAIAttemptRecord } from '../../api/_lib/openai-attempt-instrumentation';

describe('T135 A＝1（僅注入 fetch；不連外）', () => {
  it.each([429, 500, 502, 503])('SDK %s 恰好一次，instrumentation 不觸發重試', async (status) => {
    const attempts: OpenAIAttemptRecord[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'FIXTURE', type: 'fixture', code: 'fixture' } }),
      { status, headers: { 'Content-Type': 'application/json', 'retry-after': '0' } }));
    const client = createOpenAIClient('FIXTURE_OPERATION', {
      apiKey: 'FIXTURE_NOT_A_SECRET', fetchImpl, onAttempt: (record) => attempts.push(record),
    });
    await expect(client.chat.completions.create({ model: 'FIXTURE_MODEL',
      messages: [{ role: 'user', content: 'fixture' }] })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ attemptSequence: 1, httpStatus: status });
    expect(JSON.stringify(attempts)).not.toContain('FIXTURE_NOT_A_SECRET');
  });

  it.each(['disconnect', 'timeout'] as const)('%s 不重試', async (kind) => {
    const attempts: OpenAIAttemptRecord[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (kind === 'disconnect') throw new TypeError('FIXTURE_DISCONNECT');
      return await new Promise<Response>((_resolve, reject) => {
        const fail = () => reject(new DOMException('FIXTURE_TIMEOUT', 'AbortError'));
        if (init?.signal?.aborted) fail();
        else init?.signal?.addEventListener('abort', fail, { once: true });
      });
    });
    const client = createOpenAIClient(undefined, {
      apiKey: 'FIXTURE_NOT_A_SECRET', fetchImpl, onAttempt: (record) => attempts.push(record), timeoutMs: 20,
    });
    await expect(client.chat.completions.create({
      model: 'FIXTURE_MODEL', messages: [{ role: 'user', content: 'fixture' }],
    })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(attempts).toHaveLength(1);
  });
});
