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

describe('POST /api/assistant live-data handling', () => {
  it('marks live-required questions as freshness live_required and exposes nextAction guidance', async () => {
    const response = await postAssistant({
      text: '今天新宿燒肉店還營業嗎？',
      inputType: 'text',
      tone: 'default',
      location: { type: 'manual', manualArea: '新宿' },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.freshness).toBe('live_required');
    expect(payload.data.liveDataStatus).toBe('live_required');
    expect(payload.data.liveDataNextAction).toMatch(/官方|重新查詢|確認/i);
  });
});
