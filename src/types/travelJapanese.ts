export type TravelJapaneseCategory =
  | 'airport'
  | 'hotel'
  | 'restaurant'
  | 'shopping'
  | 'transportation'
  | 'emergency'
  | 'daily';

export interface TravelJapanesePhrase {
  id: string;
  japanese: string;
  traditionalChinese: string;
  categories: TravelJapaneseCategory[];
  safetyCritical?: boolean;
}
