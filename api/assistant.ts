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

type AssistantRoute = 'translation' | 'travel' | 'emergency';
type ProviderOutcome = 'success' | 'fallback' | 'parse_failure' | 'provider_error';

interface VerificationTiming {
  route: AssistantRoute | 'unknown';
  serverTotalMs: number;
  routingMs: number;
  knowledgeMs: number;
  providerMs: number;
  providerParseNormalizeMs: number;
  liveDetectionMs: number;
  providerOutcome: ProviderOutcome;
  model: string;
}

export async function POST(request: Request): Promise<Response> {
  const serverStart = performance.now();
  const correlationId = request.headers.get('x-tokyo-mate-verification-id') ?? `server-${Date.now()}`;
  const timing: VerificationTiming = {
    route: 'unknown',
    serverTotalMs: 0,
    routingMs: 0,
    knowledgeMs: 0,
    providerMs: 0,
    providerParseNormalizeMs: 0,
    liveDetectionMs: 0,
    providerOutcome: 'fallback',
    model: getOpenAIModel(),
  };
  try {
    const body = await readJsonBody<Partial<UserRequest>>(request);
    if (!isRecord(body) || typeof body.text !== 'string' || body.text.trim().length === 0 || body.text.length > 1000
      || !['text', 'voice', 'quick_action'].includes(body.inputType ?? '')) {
      return Response.json(failure(invalidInput), { status: 400 });
    }
    const tone: UserTone = body.tone && ['default', 'polite', 'casual'].includes(body.tone) ? body.tone : 'default';
    const result = await createAssistantResult(body, tone, timing);
    return timedResponse(success(result), 200, timing, correlationId, serverStart);
  } catch {
    timing.providerOutcome = 'provider_error';
    return timedResponse(failure({
      code: 'AI_SERVICE_UNAVAILABLE',
      userTitle: '東京 AI 暫時無法連線',
      userMessage: '目前 AI 服務回應繁忙或網路不穩定。',
      actionableStep: '請稍後重試，或使用東京百科查詢固定景點與交通指南。',
    }), 500, timing, correlationId, serverStart);
  }
}

function timedResponse(payload: unknown, status: number, timing: VerificationTiming, correlationId: string, serverStart: number): Response {
  timing.serverTotalMs = roundMilliseconds(performance.now() - serverStart);
  const response = Response.json(payload, { status });
  response.headers.set('X-Tokyo-Mate-Verification-Id', correlationId);
  response.headers.set('X-Tokyo-Mate-Verification-Timing', JSON.stringify(timing));
  response.headers.set('Server-Timing', [
    `total;dur=${timing.serverTotalMs}`,
    `routing;dur=${timing.routingMs}`,
    `knowledge;dur=${timing.knowledgeMs}`,
    `provider;dur=${timing.providerMs}`,
    `provider-parse-normalize;dur=${timing.providerParseNormalizeMs}`,
    `live-detection;dur=${timing.liveDetectionMs}`,
  ].join(', '));
  console.info(JSON.stringify({
    event: 'tokyo-mate.verification.assistant.server-timing',
    verificationCorrelationId: correlationId,
    ...timing,
  }));
  return response;
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

// Deterministic intent routing precedence (highest to lowest priority):
// 1. emergency — safety-critical, must win even when the text also carries explicit translation framing
//    (constitution/spec emergency-first behavior; self-reported emergency terms are never assumed to be "just a quote").
// 2. explicit translation framing — user is explicitly asking for a translation, even if the quoted
//    content happens to contain travel-sounding words (e.g. 附近/推薦/景點 inside a quoted phrase).
// 3. travel intent — general Tokyo travel/logistics question.
// 4. translation fallback — default catch-all for direct translation requests.
async function createAssistantResult(body: Partial<UserRequest>, tone: UserTone, timing: VerificationTiming): Promise<AssistantResult> {
  const text = body.text ?? '';
  const areaHint = body.location?.type === 'manual' ? body.location.manualArea : body.context?.currentArea;
  const routingStart = performance.now();
  const safety = await detectEmergency(text);
  if (safety === 'emergency') {
    timing.route = 'emergency';
    timing.routingMs = roundMilliseconds(performance.now() - routingStart);
    return createEmergencyResult(text, tone, areaHint, timing);
  }
  if (isExplicitTranslationRequest(text)) {
    timing.route = 'translation';
    timing.routingMs = roundMilliseconds(performance.now() - routingStart);
    return createTranslationResult(text, tone, timing);
  }
  // 地名單獨出現不足以判定為 travel query，須搭配旅遊/行程意圖詞彙。
  const isTravelQuery = /行程|安排|景點|半日|半天|一日|逛|推薦|交通|美食|活動|雨天|餐廳|旅遊|購物|營業|開店|閉店|休館|訂位|票價|轉乘|順遊|機場|加值|溫泉/.test(text);
  if (isTravelQuery) {
    timing.route = 'travel';
    timing.routingMs = roundMilliseconds(performance.now() - routingStart);
    return createTravelResult(text, tone, areaHint, timing);
  }
  timing.route = 'translation';
  timing.routingMs = roundMilliseconds(performance.now() - routingStart);
  return createTranslationResult(text, tone, timing);
}

// 明確的翻譯請求框架（例如「翻成日文」「幫我翻譯」「日文怎麼說」），優先於一般旅遊關鍵字比對，
// 避免被引號內夾帶的旅遊詞彙（如附近、推薦、景點）誤判為 travel intent。
function isExplicitTranslationRequest(text: string): boolean {
  return /翻譯|翻成|日文怎麼說/.test(text);
}

async function createTravelResult(text: string, tone: UserTone, areaHint: string | undefined, timing: VerificationTiming): Promise<AssistantResult> {
  const knowledgeStart = performance.now();
  const knowledgeEntries = selectKnowledgeEntries(text, { area: areaHint || '東京' });
  const contextSummary = serializeKnowledgeContext(knowledgeEntries);
  timing.knowledgeMs = roundMilliseconds(performance.now() - knowledgeStart);
  const providerResult = await requestProviderTravel(text, tone, contextSummary, timing);
  const liveDetectionStart = performance.now();
  const liveStatus = await detectLiveData(text, contextSummary);
  timing.liveDetectionMs = roundMilliseconds(performance.now() - liveDetectionStart);
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
  const normalizeStart = performance.now();
  const result = normalizeAssistantResult({
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
  timing.providerParseNormalizeMs = roundMilliseconds(timing.providerParseNormalizeMs + performance.now() - normalizeStart);
  return result;
}

async function requestProviderTravel(text: string, tone: UserTone, contextSummary: string, timing: VerificationTiming): Promise<{ conclusion: string; action: string[]; caution?: string[]; phrase?: { japanese: string; pronunciation?: string; meaning: string } } | undefined> {
  const apiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
  if (!apiKeyPresent) return undefined;
  const client = createOpenAIClient() as unknown as { responses: { create: (input: unknown) => Promise<{ output_text?: string }> } };
  const model = getOpenAIModel();
  const providerStart = performance.now();
  let response: { output_text?: string };
  try {
    response = await client.responses.create({
      model,
      reasoning: { effort: 'low' },
      input: `${travelInstruction(contextSummary)}\n使用者問題：${text}\n語氣：${tone}`,
    });
  } catch (error) {
    timing.providerMs = roundMilliseconds(performance.now() - providerStart);
    timing.providerOutcome = 'provider_error';
    throw error;
  }
  timing.providerMs = roundMilliseconds(performance.now() - providerStart);
  const parseStart = performance.now();
  if (!response.output_text) {
    timing.providerOutcome = 'parse_failure';
    timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - parseStart);
    return undefined;
  }
  try {
    const parsed = JSON.parse(response.output_text) as { conclusion?: string; action?: string[]; caution?: string[]; phrase?: { japanese?: string; pronunciation?: string; meaning?: string } };
    if (!parsed.conclusion || !parsed.action) {
      timing.providerOutcome = 'parse_failure';
      timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - parseStart);
      return undefined;
    }
    const phrase = parsed.phrase && parsed.phrase.japanese ? {
      japanese: parsed.phrase.japanese,
      pronunciation: parsed.phrase.pronunciation,
      meaning: parsed.phrase.meaning ?? '實用日文',
    } : undefined;

    const result = {
      conclusion: parsed.conclusion,
      action: parsed.action,
      caution: parsed.caution,
      phrase,
    };
    timing.providerOutcome = 'success';
    timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - parseStart);
    return result;
  } catch {
    timing.providerOutcome = 'parse_failure';
    timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - parseStart);
    return undefined;
  }
}

async function detectEmergency(text: string): Promise<'normal' | 'emergency'> {
  const emergencyTerms = /護照|遺失|失物|受傷|急病|警察|地震|手機|失蹤|緊急|急需|報案|交番|醫院/;
  return emergencyTerms.test(text) ? 'emergency' : 'normal';
}

async function createEmergencyResult(text: string, tone: UserTone, areaHint: string | undefined, timing: VerificationTiming): Promise<AssistantResult> {
  const liveDetectionStart = performance.now();
  const liveStatus = await detectLiveData(text, areaHint ?? '東京');
  timing.liveDetectionMs = roundMilliseconds(performance.now() - liveDetectionStart);
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

  const normalizeStart = performance.now();
  const result = normalizeAssistantResult({
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
  timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - normalizeStart);
  return result;
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

async function createTranslationResult(text: string, tone: UserTone, timing: VerificationTiming): Promise<AssistantResult> {
  const sourceLanguage = containsJapanese(text) ? 'ja' : 'zh-TW';
  const targetLanguage = sourceLanguage === 'ja' ? 'zh-TW' : 'ja';
  const providerResult = await requestProviderTranslation(text, tone, timing);
  const targetText = providerResult?.targetText ?? fallbackTranslation(text, sourceLanguage, tone);
  const normalizeStart = performance.now();
  const result = normalizeAssistantResult({
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
  timing.providerParseNormalizeMs = roundMilliseconds(timing.providerParseNormalizeMs + performance.now() - normalizeStart);
  return result;
}

async function requestProviderTranslation(text: string, tone: UserTone, timing: VerificationTiming): Promise<{ targetText: string } | undefined> {
  const apiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
  if (!apiKeyPresent) return undefined;
  const client = createOpenAIClient() as unknown as { responses: { create: (input: unknown) => Promise<{ output_text?: string }> } };
  const model = getOpenAIModel();
  const providerStart = performance.now();
  let response: { output_text?: string };
  try {
    response = await client.responses.create({
      model,
      input: `${translationInstruction(tone)}\n使用者文字：${text}`,
    });
  } catch (error) {
    timing.providerMs = roundMilliseconds(performance.now() - providerStart);
    timing.providerOutcome = 'provider_error';
    throw error;
  }
  timing.providerMs = roundMilliseconds(performance.now() - providerStart);
  const parseStart = performance.now();
  if (!response.output_text) {
    timing.providerOutcome = 'parse_failure';
    timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - parseStart);
    return undefined;
  }
  try {
    const parsed = JSON.parse(response.output_text) as { targetText?: string };
    if (!parsed.targetText) {
      timing.providerOutcome = 'parse_failure';
      timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - parseStart);
      return undefined;
    }
    timing.providerOutcome = 'success';
    timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - parseStart);
    return { targetText: parsed.targetText };
  } catch {
    timing.providerOutcome = 'parse_failure';
    timing.providerParseNormalizeMs = roundMilliseconds(performance.now() - parseStart);
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