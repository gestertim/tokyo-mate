import { describe, expect, it } from 'vitest';
import { POST } from './assistant';
import latencyCases from '../tests/fixtures/latency-cases.json';

// Deterministic intent routing regression matrix.
// Reuses the authoritative SC-002 acceptance dataset (tests/fixtures/latency-cases.json, unmodified)
// to verify all 32 cases route to the expected intent, plus 3 explicit-translation collision cases
// uncovered by the Full Acceptance Dataset Routing Audit (R2 regex coverage problem).

async function postAssistant(text: string) {
  return POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, inputType: 'text', tone: 'default' }),
  }));
}

const expectedIntentByCategory: Record<string, { intent: string; answerType: string }> = {
  'zh-to-ja': { intent: 'translation', answerType: 'direct_translation' },
  'ja-to-zh': { intent: 'translation', answerType: 'direct_translation' },
  'travel-qa': { intent: 'travel', answerType: 'action_plan' },
};

describe('POST /api/assistant deterministic routing regression (acceptance dataset)', () => {
  for (const testCase of latencyCases.cases as Array<{ id: string; category: string; input: string }>) {
    const expected = expectedIntentByCategory[testCase.category];
    it(`routes ${testCase.id} (${testCase.category}) to ${expected.intent}/${expected.answerType}`, async () => {
      const response = await postAssistant(testCase.input);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.data).toMatchObject({ intent: expected.intent, answerType: expected.answerType });
    });
  }
});

describe('POST /api/assistant explicit translation framing collision regression', () => {
  const collisionCases = [
    '請幫我把「附近有推薦的餐廳嗎」翻成日文',
    '我要去銀座購物，這句話日文怎麼說',
    '幫我翻譯：淺草有什麼景點',
  ];

  for (const input of collisionCases) {
    it(`routes explicit translation framing "${input}" to translation/direct_translation despite embedded travel keywords`, async () => {
      const response = await postAssistant(input);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.data).toMatchObject({ intent: 'translation', answerType: 'direct_translation' });
    });
  }
});
