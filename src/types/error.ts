export type ErrorCode =
  | 'MIC_PERMISSION_DENIED'
  | 'TRANSCRIPTION_FAILED'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'GEOLOCATION_DENIED'
  | 'GEOLOCATION_UNAVAILABLE'
  | 'PLACES_SERVICE_UNAVAILABLE'
  | 'LIVE_SEARCH_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT';

export interface ProductError {
  code: ErrorCode;
  userTitle: string;
  userMessage: string;
  actionableStep: string;
}