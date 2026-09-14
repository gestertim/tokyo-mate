export interface AudioTranscriptionResult {
  text: string;
  detectedLanguage?: string;
}

export interface SpeechGenerationRequest {
  text: string;
  language: 'ja' | 'zh-TW';
  speed: 'normal' | 'slow';
}