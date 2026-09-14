export type KnowledgeCategory = 'area' | 'transport' | 'food' | 'shopping' | 'culture' | 'emergency';

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  area?: string;
  title: string;
  summary: string;
  content: {
    recommendedFor?: string[];
    highlights?: string[];
    howToExplore?: string[];
    mustTryOrBuy?: string[];
    transportTips?: string[];
    stayDuration?: string;
    dayNightDifference?: string;
    importantNotes?: string[];
    practicalJapanese?: Array<{ japanese: string; meaning: string }>;
  };
  tags: string[];
  updatedAt: string;
}