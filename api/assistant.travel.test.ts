import { describe, expect, it } from 'vitest';
import { POST } from './assistant';

async function postAssistant(body: unknown) {
  return POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/assistant travel contract', () => {
  it('returns an action-first travel answer with conclusion, action, and optional phrase', async () => {
    const response = await postAssistant({
      text: '我今天下午想在淺草逛半天，想知道該怎麼安排和吃什麼。',
      inputType: 'text',
      tone: 'default',
      location: { type: 'manual', manualArea: '淺草' },
      context: { currentArea: '淺草' },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toMatchObject({
      intent: 'travel',
      answerType: 'action_plan',
      emergency: false,
    });
    expect(payload.data.travelAnswer.conclusion).toBeTruthy();
    expect(Array.isArray(payload.data.travelAnswer.action)).toBe(true);
    expect(payload.data.travelAnswer.action.length).toBeGreaterThan(0);
    expect(payload.data.suggestedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionType: 'view_knowledge' }),
    ]));
  });

  it('keeps suggested knowledge action aligned with travel context and area', async () => {
    const response = await postAssistant({
      text: '新宿轉乘和美食，晚上想吃適合打卡的地方',
      inputType: 'text',
      tone: 'default',
      location: { type: 'manual', manualArea: '新宿' },
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.travelAnswer.conclusion).toContain('新宿');
    expect(payload.data.suggestedActions.some((action: { actionType: string }) => action.actionType === 'view_knowledge')).toBe(true);
  });
});
