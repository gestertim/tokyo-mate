export type InputType = 'text' | 'voice' | 'quick_action';
export type UserTone = 'default' | 'polite' | 'casual';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface UserLocation {
  type: 'coordinates' | 'manual';
  coordinates?: LocationCoordinates;
  manualArea?: string;
}

export interface UserRequest {
  id: string;
  text: string;
  inputType: InputType;
  tone?: UserTone;
  location?: UserLocation;
  context?: {
    previousIntent?: string;
    currentArea?: string;
  };
}