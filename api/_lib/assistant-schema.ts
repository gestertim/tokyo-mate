import type { AssistantResult } from '../../src/types/assistant';

export const assistantSystemRules = [
  '使用台灣繁體中文回覆，翻譯需符合現場情境。',
  '一般旅遊回答依序提供結論、行動、可選注意與必要日文。',
  'Safety 與 Freshness 是獨立決策維度，不得互相覆蓋。',
  '緊急情境先提供 immediateAction 與 nextAction，不等待即時資料。',
].join('\n');

export function normalizeAssistantResult(value: unknown): AssistantResult {
  if (!isAssistantResult(value)) {
    throw new Error('Assistant provider response does not match the internal contract');
  }
  return { ...value, emergency: value.safety === 'emergency', liveDataStatus: value.freshness };
}

function isAssistantResult(value: unknown): value is AssistantResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<AssistantResult>;
  return typeof result.id === 'string'
    && (result.safety === 'normal' || result.safety === 'emergency')
    && typeof result.freshness === 'string'
    && typeof result.primaryContent === 'string'
    && Array.isArray(result.suggestedActions)
    && typeof result.emergency === 'boolean';
}