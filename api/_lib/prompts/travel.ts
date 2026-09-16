export const travelPromptRules = `
請為一般東京旅遊問題提供 action-first 回答。
格式為 JSON：conclusion, action, caution?, phrase?
- conclusion 必須直接回答最推薦的做法。
- action 必須是 JSON 字串陣列（string[]），內容為可採取行動的步驟，不得回傳單一字串。
- action 最多 5 項，每項限一句話，且不得重複 conclusion 已說明的內容。
- caution 為可選，但若有提供必須是 JSON 字串陣列（string[]），不得回傳單一字串。
- caution 最多 2 項，每項限一句話，且不得重複 conclusion 已說明的內容。
- phrase 為可選；僅在使用者很可能需要與日本人現場溝通時才提供。
- 回答應優先依序顯示結論、行動、注意事項與實用日文。
- 若問題與地區、交通、美食、雨天活動有關，請明確用對應地區名稱說明。
`.trim();

export function travelInstruction(contextSummary: string): string {
  return `${travelPromptRules}\n旅遊知識背景：${contextSummary}`;
}
