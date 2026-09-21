import phrases from '../data/tokyo/travel-japanese-phrases.json' with { type: 'json' };
import type { TravelJapaneseCategory, TravelJapanesePhrase } from '../types/travelJapanese';

const catalog = phrases as TravelJapanesePhrase[];

export const TRAVEL_JAPANESE_CATEGORIES = [
  'airport', 'hotel', 'restaurant', 'shopping', 'transportation', 'emergency', 'daily',
] as const satisfies readonly TravelJapaneseCategory[];

export const TRAVEL_JAPANESE_CATEGORY_LABELS: Record<TravelJapaneseCategory, string> = {
  airport: '機場',
  hotel: '飯店',
  restaurant: '餐廳點餐',
  shopping: '購物',
  transportation: '交通',
  emergency: '求助／緊急狀況',
  daily: '日常溝通',
};

const MIN_UNIQUE_PHRASES = 100;
const MIN_TOTAL_PLACEMENTS = 140;
const MIN_PLACEMENTS_PER_CATEGORY = 20;

export function getAllPhrases(): TravelJapanesePhrase[] {
  return catalog;
}

export function getPhrasesByCategory(category: TravelJapaneseCategory): TravelJapanesePhrase[] {
  const matches = catalog.filter((phrase) => phrase.categories.includes(category));
  if (category !== 'emergency') return matches;
  // emergency：safety-critical phrase 排列在非 safety-critical phrase 之前（依 contracts §1）
  return [...matches].sort((a, b) => Number(Boolean(b.safetyCritical)) - Number(Boolean(a.safetyCritical)));
}

export function searchPhrases(query: string): TravelJapanesePhrase[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return catalog.filter(
    (phrase) => phrase.japanese.toLowerCase().includes(normalized) || phrase.traditionalChinese.toLowerCase().includes(normalized),
  );
}

export function getPhraseById(id: string): TravelJapanesePhrase | undefined {
  return catalog.find((phrase) => phrase.id === id);
}

export function getCategoryPlacementCounts(): Record<TravelJapaneseCategory, number> {
  const counts = Object.fromEntries(TRAVEL_JAPANESE_CATEGORIES.map((category) => [category, 0])) as Record<TravelJapaneseCategory, number>;
  for (const phrase of catalog) {
    for (const category of phrase.categories) {
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  return counts;
}

export function getUniquePhraseCount(): number {
  return catalog.length;
}

export function validateTravelJapaneseDataset(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();

  for (const phrase of catalog) {
    if (!phrase.id) {
      issues.push('found a phrase with empty id');
    } else if (seenIds.has(phrase.id)) {
      issues.push(`duplicate id '${phrase.id}'`);
    } else {
      seenIds.add(phrase.id);
    }

    if (!phrase.japanese.trim()) issues.push(`phrase '${phrase.id}' has empty japanese text`);
    if (!phrase.traditionalChinese.trim()) issues.push(`phrase '${phrase.id}' has empty traditionalChinese text`);

    if (!phrase.categories.length) {
      issues.push(`phrase '${phrase.id}' has no categories`);
    }
    for (const category of phrase.categories) {
      if (!(TRAVEL_JAPANESE_CATEGORIES as readonly string[]).includes(category)) {
        issues.push(`phrase '${phrase.id}' has invalid category '${category}'`);
      }
    }

    const contentKey = `${phrase.japanese}\u0000${phrase.traditionalChinese}`;
    if (seenContent.has(contentKey)) {
      issues.push(`phrase '${phrase.id}' duplicates content of another phrase (same japanese + traditionalChinese)`);
    } else {
      seenContent.add(contentKey);
    }
  }

  const uniqueCount = getUniquePhraseCount();
  if (uniqueCount < MIN_UNIQUE_PHRASES) {
    issues.push(`unique phrase count is ${uniqueCount}, expected >= ${MIN_UNIQUE_PHRASES}`);
  }

  const counts = getCategoryPlacementCounts();
  const totalPlacements = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (totalPlacements < MIN_TOTAL_PLACEMENTS) {
    issues.push(`total category placements is ${totalPlacements}, expected >= ${MIN_TOTAL_PLACEMENTS}`);
  }
  for (const category of TRAVEL_JAPANESE_CATEGORIES) {
    if (counts[category] < MIN_PLACEMENTS_PER_CATEGORY) {
      issues.push(`category '${category}' has ${counts[category]} placements, expected >= ${MIN_PLACEMENTS_PER_CATEGORY}`);
    }
  }

  return { valid: issues.length === 0, issues };
}
