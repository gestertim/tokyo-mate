import areas from '../data/tokyo/areas.json';
import transport from '../data/tokyo/transport.json';
import food from '../data/tokyo/food.json';
import shopping from '../data/tokyo/shopping.json';
import culture from '../data/tokyo/culture.json';
import emergency from '../data/tokyo/emergency.json';
import type { KnowledgeCategory, KnowledgeEntry } from '../types/knowledge';

const catalog = [...areas, ...transport, ...food, ...shopping, ...culture, ...emergency] as KnowledgeEntry[];

export function selectKnowledgeEntries(query: string, context?: { area?: string }): KnowledgeEntry[] {
  const keywords = query.toLowerCase().split(/[\s、，。！？]/).filter(Boolean);
  const areaHint = context?.area?.trim();

  return [...catalog]
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, keywords, areaHint),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ entry }) => entry);
}

function scoreEntry(entry: KnowledgeEntry, queryTerms: string[], areaHint?: string): number {
  let score = 0;
  const contentFragments = Object.values(entry.content)
    .flatMap((value) => Array.isArray(value) ? value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)) : [String(value)])
    .filter((item): item is string => typeof item === 'string');

  const haystack = [entry.title, entry.summary, entry.area ?? '', ...entry.tags, ...contentFragments]
    .join(' ')
    .toLowerCase();

  for (const term of queryTerms) {
    if (!term) continue;
    if (entry.title.toLowerCase().includes(term) || haystack.includes(term)) score += 2;
    if (entry.tags.some((tag) => tag.toLowerCase().includes(term))) score += 1;
  }

  if (areaHint && entry.area && entry.area.includes(areaHint)) score += 3;
  if (entry.category === 'area' && queryTerms.some((term) => /淺草|新宿|上野|澀谷|銀座/.test(term))) score += 1;
  if (entry.category === 'transport' && queryTerms.some((term) => /交通|轉乘|站|路線/.test(term))) score += 1;
  if (entry.category === 'food' && queryTerms.some((term) => /美食|餐飲|吃|食|素食/.test(term))) score += 1;
  if (entry.category === 'shopping' && queryTerms.some((term) => /購物|百貨|電器|行動電源/.test(term))) score += 1;
  if (entry.category === 'culture' && queryTerms.some((term) => /文化|禮儀|雨天|活動/.test(term))) score += 1;
  if (entry.category === 'emergency' && queryTerms.some((term) => /緊急|警察|護照|醫療/.test(term))) score += 1;

  return score;
}

export function serializeKnowledgeContext(entries: KnowledgeEntry[]): string {
  return entries
    .map((entry) => `${entry.area ?? '東京'}｜${entry.title}：${entry.summary}`)
    .join('\n');
}

export function getKnowledgeCategories(): KnowledgeCategory[] {
  return ['area', 'transport', 'food', 'shopping', 'culture', 'emergency'];
}
