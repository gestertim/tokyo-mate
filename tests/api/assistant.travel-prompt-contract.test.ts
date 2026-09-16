import { beforeEach, describe, expect, it, vi } from 'vitest';
import { travelPromptRules } from '../../api/_lib/prompts/travel.js';

const { createResponse, createOpenAIClient } = vi.hoisted(() => ({
  createResponse: vi.fn(),
  createOpenAIClient: vi.fn(),
}));

vi.mock('../../api/_lib/openai.js', () => ({
  createOpenAIClient,
  getOpenAIModel: () => 'gpt-5.6-terra',
}));

import { POST } from '../../api/assistant';

async function postAssistant(text: string) {
  return POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, inputType: 'text', tone: 'default' }),
  }));
}

describe('Travel prompt bounded concise output contract', () => {
  it('states action ≤ 5 items, one sentence each, without repeating conclusion', () => {
    expect(travelPromptRules).toMatch(/action\s*最多\s*5\s*項/);
    expect(travelPromptRules).toMatch(/action[^\n]*限一句話/);
  });

  it('states caution ≤ 2 items, one sentence each, without repeating conclusion', () => {
    expect(travelPromptRules).toMatch(/caution\s*最多\s*2\s*項/);
    expect(travelPromptRules).toMatch(/caution[^\n]*限一句話/);
  });

  it('instructs both action and caution to avoid repeating the conclusion', () => {
    const boundedLines = travelPromptRules
      .split('\n')
      .filter((line) => line.trim().startsWith('- action 最多') || line.trim().startsWith('- caution 最多'));
    expect(boundedLines).toHaveLength(2);
    for (const line of boundedLines) {
      expect(line).toContain('不得重複 conclusion');
    }
  });

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    createResponse.mockReset();
    createOpenAIClient.mockReset();
    createOpenAIClient.mockReturnValue({ responses: { create: createResponse } });
  });

  it('sends the bounded action/caution constraints to the provider for a travel request', async () => {
    createResponse.mockResolvedValueOnce({ output_text: JSON.stringify({ conclusion: '先去淺草。', action: ['搭銀座線'] }) });

    const response = await postAssistant('淺草半日行程怎麼安排？');

    expect(response.status).toBe(200);
    expect(createResponse).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.stringContaining('action 最多 5 項'),
    }));
    expect(createResponse).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.stringContaining('caution 最多 2 項'),
    }));
  });
});
