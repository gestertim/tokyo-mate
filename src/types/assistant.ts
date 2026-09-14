import type { UserTone } from './request';

export type SafetyLevel = 'normal' | 'emergency';
export type FreshnessLevel = 'not_required' | 'live_required' | 'verified' | 'unavailable' | 'uncertain';
export type RequestIntent = 'translation' | 'travel' | 'nearby' | 'knowledge' | 'emergency';
export type AnswerType = 'direct_translation' | 'action_plan' | 'place_recommendation' | 'knowledge_summary' | 'emergency_guide';
export type LiveDataStatus = FreshnessLevel;

export interface SuggestedAction {
  id: string;
  label: string;
  actionType: 'adjust_tone' | 'tts' | 'navigate' | 'search_nearby' | 'view_knowledge';
  payload?: Record<string, unknown>;
}

export interface TravelAnswerStructure {
  conclusion: string;
  action: string | string[];
  caution?: string[];
  phrase?: { japanese: string; pronunciation?: string; meaning?: string };
}

export interface EmergencyGuideStructure {
  immediateAction: string[];
  nextAction: string[];
  phrase?: string[];
  importantNotice?: string;
}

export interface AssistantResult {
  id: string;
  safety: SafetyLevel;
  freshness: FreshnessLevel;
  intent: RequestIntent;
  sourceLanguage: 'zh-TW' | 'ja' | 'other';
  targetLanguage?: 'zh-TW' | 'ja';
  answerType: AnswerType;
  primaryContent: string;
  translation?: {
    sourceText: string;
    targetText: string;
    pronunciation?: string;
    toneUsed: UserTone;
  };
  travelAnswer?: TravelAnswerStructure;
  liveDataStatus: LiveDataStatus;
  liveDataMessage?: string;
  liveDataNextAction?: string;
  suggestedActions: SuggestedAction[];
  emergency: boolean;
  emergencyGuide?: EmergencyGuideStructure;
}