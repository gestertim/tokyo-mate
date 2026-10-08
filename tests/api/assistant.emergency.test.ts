import { describe, expect, it } from 'vitest';
// 歷史內容契約的隔離回歸；真實 HTTP 拒絕路徑另見 paid-handlers-rejection.test.ts。
import { executeUpstream as POST } from '../../api/assistant';

async function postAssistant(body: unknown) {
  return POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/assistant emergency handling', () => {
  it('prioritizes emergency guidance before general recommendations', async () => {
    const response = await postAssistant({
      text: '我護照遺失了，現在在東京怎麼辦？',
      inputType: 'text',
      tone: 'default',
      location: { type: 'manual', manualArea: '淺草' },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.safety).toBe('emergency');
    expect(payload.data.emergency).toBe(true);
    expect(payload.data.emergencyGuide.immediateAction.length).toBeGreaterThan(0);
    expect(payload.data.emergencyGuide.nextAction.length).toBeGreaterThan(0);
    expect(payload.data.suggestedActions).toEqual([]);
  });
});
