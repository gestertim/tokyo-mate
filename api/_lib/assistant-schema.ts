import { isRecord } from './http.js';
import type { AssistantResult } from '../../src/types/assistant';

export const assistantSystemRules = [
  '使用台灣繁體中文回覆，翻譯需符合現場情境。',
  '一般旅遊回答依序提供結論、行動、可選注意與必要日文。',
  'Safety 與 Freshness 是獨立決策維度，不得互相覆蓋。',
  '緊急情境先提供 immediateAction 與 nextAction，不等待即時資料。',
].join('\n');

// 將 AI provider 可能回傳的 array-like 欄位正規化為 canonical string[]，避免非法型態流入前端造成 .map() crash。
function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }
  return [];
}

function normalizeOptionalStringArray(value: unknown): string[] | undefined {
  const normalized = normalizeStringArray(value);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeArrayLikeFields(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = { ...value };
  if (isRecord(result.travelAnswer)) {
    result.travelAnswer = {
      ...result.travelAnswer,
      action: normalizeStringArray(result.travelAnswer.action),
      caution: normalizeOptionalStringArray(result.travelAnswer.caution),
    };
  }
  if (isRecord(result.emergencyGuide)) {
    result.emergencyGuide = {
      ...result.emergencyGuide,
      immediateAction: normalizeStringArray(result.emergencyGuide.immediateAction),
      nextAction: normalizeStringArray(result.emergencyGuide.nextAction),
      phrase: normalizeOptionalStringArray(result.emergencyGuide.phrase),
    };
  }
  return result;
}

export function normalizeAssistantResult(value: unknown): AssistantResult {
  const normalized = normalizeArrayLikeFields(value);
  if (!isAssistantResult(normalized)) {
    throw new Error('Assistant provider response does not match the internal contract');
  }
  return { ...normalized, emergency: normalized.safety === 'emergency', liveDataStatus: normalized.freshness };
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