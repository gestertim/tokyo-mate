import { describe, expect, it } from 'vitest';
import { normalizeAssistantResult } from './assistant-schema';

function baseTravelResult(travelAnswer: unknown) {
  return {
    id: 'travel-test',
    safety: 'normal',
    freshness: 'not_required',
    intent: 'travel',
    sourceLanguage: 'zh-TW',
    targetLanguage: 'zh-TW',
    answerType: 'action_plan',
    primaryContent: '結論',
    travelAnswer,
    liveDataStatus: 'not_required',
    suggestedActions: [],
    emergency: false,
  };
}

function baseEmergencyResult(emergencyGuide: unknown) {
  return {
    id: 'emergency-test',
    safety: 'emergency',
    freshness: 'not_required',
    intent: 'emergency',
    sourceLanguage: 'zh-TW',
    targetLanguage: 'zh-TW',
    answerType: 'emergency_guide',
    primaryContent: '請先確保安全',
    liveDataStatus: 'not_required',
    suggestedActions: [],
    emergency: true,
    emergencyGuide,
  };
}

describe('normalizeAssistantResult array-like field normalization', () => {
  it('normalizes travelAnswer.caution provider string output into a string array', () => {
    const result = normalizeAssistantResult(baseTravelResult({
      conclusion: '先去淺草寺再吃晚餐',
      action: ['先去淺草寺', '再到附近吃晚餐'],
      caution: '假日人潮較多',
    }));

    expect(result.travelAnswer?.caution).toEqual(['假日人潮較多']);
  });

  it('keeps travelAnswer.caution unchanged when already a string array', () => {
    const result = normalizeAssistantResult(baseTravelResult({
      conclusion: '先去淺草寺再吃晚餐',
      action: ['先去淺草寺', '再到附近吃晚餐'],
      caution: ['假日人潮較多', '雨天請攜帶雨具'],
    }));

    expect(result.travelAnswer?.caution).toEqual(['假日人潮較多', '雨天請攜帶雨具']);
  });

  it('normalizes travelAnswer.action provider string output into a string array', () => {
    const result = normalizeAssistantResult(baseTravelResult({
      conclusion: '先去淺草寺再吃晚餐',
      action: '先去淺草寺',
    }));

    expect(result.travelAnswer?.action).toEqual(['先去淺草寺']);
  });

  it('normalizes emergencyGuide array-like fields when provider returns a single string', () => {
    const result = normalizeAssistantResult(baseEmergencyResult({
      immediateAction: '立即前往最近的派出所',
      nextAction: '聯絡駐外代表處',
      phrase: 'パスポートを紛失しました。',
    }));

    expect(result.emergencyGuide?.immediateAction).toEqual(['立即前往最近的派出所']);
    expect(result.emergencyGuide?.nextAction).toEqual(['聯絡駐外代表處']);
    expect(result.emergencyGuide?.phrase).toEqual(['パスポートを紛失しました。']);
  });

  it('drops invalid non-string array items and undefined/null array-like fields safely', () => {
    const result = normalizeAssistantResult(baseTravelResult({
      conclusion: '先去淺草寺再吃晚餐',
      action: ['先去淺草寺', 42, null],
      caution: undefined,
    }));

    expect(result.travelAnswer?.action).toEqual(['先去淺草寺']);
    expect(result.travelAnswer?.caution).toBeUndefined();
  });
});
