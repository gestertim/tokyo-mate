import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createResponse, createOpenAIClient } = vi.hoisted(() => ({
  createResponse: vi.fn(),
  createOpenAIClient: vi.fn(),
}));

vi.mock('./_lib/openai.js', () => ({
  createOpenAIClient,
  getOpenAIModel: () => 'gpt-5.6-terra',
}));

import { POST } from './assistant';

async function postAssistant(text: string) {
  return POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, inputType: 'text', tone: 'default' }),
  }));
}

describe('POST /api/assistant travel reasoning configuration', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    createResponse.mockReset();
    createOpenAIClient.mockReset();
    createOpenAIClient.mockReturnValue({ responses: { create: createResponse } });
  });

  it('sends low reasoning effort only for travel and preserves one provider call per request', async () => {
    createResponse
      .mockResolvedValueOnce({ output_text: JSON.stringify({ conclusion: '先去淺草。', action: ['搭銀座線'] }) })
      .mockResolvedValueOnce({ output_text: JSON.stringify({ targetText: '浅草に行きます。' }) });

    const travelResponse = await postAssistant('淺草半日行程怎麼安排？');
    const translationResponse = await postAssistant('我要去淺草，日文怎麼說？');

    expect(travelResponse.status).toBe(200);
    expect(translationResponse.status).toBe(200);
    expect(createResponse).toHaveBeenCalledTimes(2);
    expect(createResponse).toHaveBeenNthCalledWith(1, expect.objectContaining({
      model: 'gpt-5.6-terra',
      reasoning: { effort: 'low' },
    }));
    expect(createResponse).toHaveBeenNthCalledWith(2, expect.not.objectContaining({
      reasoning: expect.anything(),
    }));
  });
});