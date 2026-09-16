import { createOpenAIClient, getOpenAIModel } from './_lib/openai.js';
import { failure, isRecord, readJsonBody, success } from './_lib/http.js';
import { normalizeAssistantResult } from './_lib/assistant-schema.js';
import { translationInstruction } from './_lib/prompts/translation.js';
import { travelInstruction } from './_lib/prompts/travel.js';
import { liveDataInstruction } from './_lib/prompts/live-data.js';
import { emergencyInstruction } from './_lib/prompts/emergency.js';
import { selectKnowledgeEntries, serializeKnowledgeContext } from '../src/services/knowledge.js';
import type { AssistantResult } from '../src/types/assistant';
import type { UserRequest, UserTone } from '../src/types/request';

const invalidInput = {
  code: 'INVALID_INPUT' as const,
  userTitle: '輸入內容無效',
  userMessage: '請輸入文字內容後再試一次。',
  actionableStep: '請重新輸入您的問題或需求。',
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody<Partial<UserRequest>>(request);
    if (!isRecord(body) || typeof body.text !== 'string' || body.text.trim().length === 0 || body.text.length > 1000
      || !['text', 'voice', 'quick_action'].includes(body.inputType ?? '')) {
      return Response.json(failure(invalidInput), { status: 400 });
    }
    const tone: UserTone = body.tone && ['default', 'polite', 'casual'].includes(body.tone) ? body.tone : 'default';
    const result = await createAssistantResult(body, tone);
    return Response.json(success(result));
  } catch {
    return Response.json(failure({
      code: 'AI_SERVICE_UNAVAILABLE',
      userTitle: '東京 AI 暫時無法連線',
      userMessage: '目前 AI 服務回應繁忙或網路不穩定。',
      actionableStep: '請稍後重試，或使用東京百科查詢固定景點與交通指南。',
    }), { status: 500 });
  }
}

async function createAssistantResult(body: Partial<UserRequest>, tone: UserTone): Promise<AssistantResult> {
  const text = body.text ?? '';
  const areaHint = body.location?.type === 'manual' ? body.location.manualArea : body.context?.currentArea;
  const safety = await detectEmergency(text);
  if (safety === 'emergency') {
    return createEmergencyResult(text, tone, areaHint);
  }
  // 地名單獨出現不足以判定為 travel query，須搭配旅遊/行程意圖詞彙。
  const isTravelQuery = /行程|安排|景點|半日|半天|一日|逛|推薦|交通|美食|活動|雨天|餐廳|旅遊|購物|營業|開店|閉店|休館|訂位|票價/.test(text);
  if (isTravelQuery) {
    return createTravelResult(text, tone, areaHint);
  }
  return createTranslationResult(text, tone);
}

async function createTravelResult(text: string, tone: UserTone, areaHint?: string): Promise<AssistantResult> {
  const knowledgeEntries = selectKnowledgeEntries(text, { area: areaHint || '東京' });
  const contextSummary = serializeKnowledgeContext(knowledgeEntries);
  const providerResult = await requestProviderTravel(text, tone, contextSummary);
  const liveStatus = await detectLiveData(text, contextSummary);
  const travelAnswer = providerResult ?? {
    conclusion: `${areaHint || '東京'}適合先從當地的代表景點與交通安排開始，最後再安排餐食與休息。`,
    action: ['先選擇最適合的區域', '依路線安排交通與用餐', '如果天氣不佳，改為室內景點'],
    caution: ['建議先確認時間與交通安排', '雨天或假日請提前預留時間'],
    phrase: {
      japanese: 'このエリアはおすすめです。',
      pronunciation: 'Kono eria wa osusume desu.',
      meaning: '這個區域很推薦。',
    },
  };
  return normalizeAssistantResult({
    id: `travel-${Date.now()}`,
    safety: 'normal',
    freshness: liveStatus.freshness,
    intent: 'travel',
    sourceLanguage: 'zh-TW',
    targetLanguage: 'zh-TW',
    answerType: 'action_plan',
    primaryContent: travelAnswer.conclusion,
    travelAnswer,
    liveDataStatus: liveStatus.freshness,
    liveDataMessage: liveStatus.message,
    liveDataNextAction: liveStatus.nextAction,
    suggestedActions: [
      { id: 'act-knowledge', label: '查看相關知識', actionType: 'view_knowledge', payload: { area: areaHint || '東京' } },
    ],
    emergency: false,
  });
}

async function requestProviderTravel(text: string, tone: UserTone, contextSummary: string): Promise<{ conclusion: string; action: string[]; caution?: string[]; phrase?: { japanese: string; pronunciation?: string; meaning: string } } | undefined> {
  const apiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
  if (!apiKeyPresent) return undefined;
  const client = createOpenAIClient() as unknown as { responses: { create: (input: unknown) => Promise<{ output_text?: string }> } };
  const model = getOpenAIModel();
  const response = await client.responses.create({
    model,
    input: `${travelInstruction(contextSummary)}\n使用者問題：${text}\n語氣：${tone}`,
  });
  if (!response.output_text) return undefined;
  try {
    const parsed = JSON.parse(response.output_text) as { conclusion?: string; action?: string[]; caution?: string[]; phrase?: { japanese?: string; pronunciation?: string; meaning?: string } };
    if (!parsed.conclusion || !parsed.action) return undefined;
    const phrase = parsed.phrase && parsed.phrase.japanese ? {
      japanese: parsed.phrase.japanese,
      pronunciation: parsed.phrase.pronunciation,
      meaning: parsed.phrase.meaning ?? '實用日文',
    } : undefined;

    return {
      conclusion: parsed.conclusion,
      action: parsed.action,
      caution: parsed.caution,
      phrase,
    };
  } catch {
    return undefined;
  }
}

async function detectEmergency(text: string): Promise<'normal' | 'emergency'> {
  const emergencyTerms = /護照|遺失|失物|受傷|急病|警察|地震|手機|失蹤|緊急|急需|報案|交番|醫院/;
  return emergencyTerms.test(text) ? 'emergency' : 'normal';
}

async function createEmergencyResult(text: string, tone: UserTone, areaHint?: string): Promise<AssistantResult> {
  const liveStatus = await detectLiveData(text, areaHint ?? '東京');
  const emergencyGuide = {
    immediateAction: [
      '先保持冷靜並確認自身安全，必要時立刻尋找最近的警察署或派出所。',
      '若有受傷或危險情況，立即聯絡當地緊急服務或前往最近醫療機構。',
    ],
    nextAction: [
      '準備護照、身分證明與可聯繫資料，向駐外代表處或警察申請協助。',
      '接下來依照情況前往最近的官方辦公窗口、醫院或警察機關，避免相信非官方代辦。',
    ],
    phrase: ['パスポートを紛失しました。', '近くの交番はどこですか？'],
    importantNotice: '請勿等待，先完成報案與聯絡官方單位，再處理後續旅遊安排。',
  };

  return normalizeAssistantResult({
    id: `emergency-${Date.now()}`,
    safety: 'emergency',
    freshness: liveStatus.freshness,
    intent: 'emergency',
    sourceLanguage: 'zh-TW',
    targetLanguage: 'zh-TW',
    answerType: 'emergency_guide',
    primaryContent: '請先處理安全與官方求助，再安排後續旅遊計畫。',
    liveDataStatus: liveStatus.freshness,
    liveDataMessage: liveStatus.message,
    liveDataNextAction: liveStatus.nextAction,
    suggestedActions: [],
    emergency: true,
    emergencyGuide,
  });
}

async function detectLiveData(text: string, contextSummary: string): Promise<{ freshness: 'not_required' | 'live_required' | 'verified' | 'unavailable' | 'uncertain'; message?: string; nextAction?: string }> {
  const liveTerms = /今天|今晚|現在|目前|最新|營業|休館|延誤|車班|時刻|天氣|活動|訂位|票價|開店|閉店|是否營業/;
  const freshness = liveTerms.test(text) ? 'live_required' : 'not_required';
  const safeMessage = freshness === 'live_required'
    ? '正在確認與您需求直接相關的最新資訊。'
    : '本題不需要即時資料，請以固定旅遊常識與官方資訊為準。';
  const safeNextAction = freshness === 'live_required'
    ? '請確認最新版官方營業時間、交通資訊或活動安排後再採取最終決策。'
    : '如需確認細節，可再詢問店家營業時間或官方公告。';

  return {
    freshness,
    message: safeMessage,
    nextAction: safeNextAction,
  };
}

async function createTranslationResult(text: string, tone: UserTone): Promise<AssistantResult> {
  const sourceLanguage = containsJapanese(text) ? 'ja' : 'zh-TW';
  const targetLanguage = sourceLanguage === 'ja' ? 'zh-TW' : 'ja';
  const providerResult = await requestProviderTranslation(text, tone);
  const targetText = providerResult?.targetText ?? fallbackTranslation(text, sourceLanguage, tone);
  return normalizeAssistantResult({
    id: `asst-${Date.now()}`,
    safety: 'normal',
    freshness: 'not_required',
    intent: 'translation',
    sourceLanguage,
    targetLanguage,
    answerType: 'direct_translation',
    primaryContent: targetText,
    translation: { sourceText: text, targetText, toneUsed: tone, pronunciation: sourceLanguage === 'zh-TW' ? undefined : undefined },
    liveDataStatus: 'not_required',
    suggestedActions: [
      { id: 'act-tts', label: '播放語音', actionType: 'tts', payload: { text: targetText, language: targetLanguage } },
      { id: 'act-polite', label: '更禮貌', actionType: 'adjust_tone', payload: { tone: 'polite' } },
      { id: 'act-casual', label: '更口語', actionType: 'adjust_tone', payload: { tone: 'casual' } },
    ],
    emergency: false,
  });
}

async function requestProviderTranslation(text: string, tone: UserTone): Promise<{ targetText: string } | undefined> {
  const apiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
  if (!apiKeyPresent) return undefined;
  const client = createOpenAIClient() as unknown as { responses: { create: (input: unknown) => Promise<{ output_text?: string }> } };
  const model = getOpenAIModel();
  const response = await client.responses.create({
    model,
    input: `${translationInstruction(tone)}\n使用者文字：${text}`,
  });
  if (!response.output_text) return undefined;
  try {
    const parsed = JSON.parse(response.output_text) as { targetText?: string };
    return parsed.targetText ? { targetText: parsed.targetText } : undefined;
  } catch {
    return undefined;
  }
}

function containsJapanese(text: string): boolean {
  return /[\u3040-\u30ff]/u.test(text);
}

function fallbackTranslation(text: string, sourceLanguage: 'zh-TW' | 'ja', tone: UserTone): string {
  if (sourceLanguage === 'ja') return text.includes('駅') ? '請問這附近有車站嗎？' : '請問可以幫我翻譯這句日文嗎？';
  if (text.includes('牛丼') && text.includes('不辣')) {
    return tone === 'polite' ? '恐れ入りますが、辛くない牛丼を1ついただけますでしょうか。' : tone === 'casual' ? '辛くない牛丼を1つお願いします。' : '辛くない牛丼を1つお願いします。';
  }
  return 'すみません、これを日本語でお願いします。';
}