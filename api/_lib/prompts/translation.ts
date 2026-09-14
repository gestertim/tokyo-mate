import type { UserTone } from '../../../src/types/request';

export const translationRules = `
判斷輸入是台灣繁體中文或日文，將內容翻成另一種語言。
保留原意與現場情境，不逐字翻譯；使用台灣繁體中文，不使用中國大陸用語。
語氣 default 為自然禮貌，polite 更正式，casual 更口語但仍適合旅遊場合。
輸出 JSON：sourceLanguage、targetLanguage、sourceText、targetText、toneUsed、pronunciation。
`.trim();

export function translationInstruction(tone: UserTone): string {
  return `${translationRules}\n目前語氣：${tone}`;
}