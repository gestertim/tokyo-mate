import { describe, expect, it } from 'vitest';
import { POST } from './assistant';

async function postAssistant(body: unknown) {
  return POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/assistant translation contract', () => {
  it('rejects missing or oversized text with the shared error envelope', async () => {
    const response = await postAssistant({ inputType: 'text' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_INPUT' },
    });
  });

  it('returns a normalized zh-TW to Japanese translation with tone actions', async () => {
    const response = await postAssistant({
      text: '我想點一份不辣的牛丼，麻煩幫我點一份',
      inputType: 'text',
      tone: 'default',
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toMatchObject({
      intent: 'translation',
      sourceLanguage: 'zh-TW',
      targetLanguage: 'ja',
      answerType: 'direct_translation',
      translation: { toneUsed: 'default' },
      emergency: false,
      freshness: 'not_required',
      liveDataStatus: 'not_required',
    });
    expect(payload.data.translation.targetText).toBeTruthy();
    expect(payload.data.suggestedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionType: 'adjust_tone' }),
      expect.objectContaining({ actionType: 'tts' }),
    ]));
  });

  it('supports Japanese input and polite/casual tone values', async () => {
    const response = await postAssistant({
      text: 'この近くに駅はありますか？',
      inputType: 'text',
      tone: 'polite',
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toMatchObject({
      intent: 'translation',
      sourceLanguage: 'ja',
      targetLanguage: 'zh-TW',
      translation: { toneUsed: 'polite' },
    });
  });

  it('routes a place-name-only question without travel intent to translation, not travel', async () => {
    const response = await postAssistant({
      text: '請問這班電車到新宿嗎？',
      inputType: 'text',
      tone: 'default',
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toMatchObject({
      intent: 'translation',
      answerType: 'direct_translation',
    });
  });
});