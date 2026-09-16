export const emergencyPromptRules = `
請判斷是否為緊急狀況，並以 JSON 回應：safety, emergencyGuide。
- safety 只可為 'normal' | 'emergency'
- 若使用者提到護照遺失、手機遺失、受傷、地震、警察協助、急病等，判定為 emergency
- emergencyGuide 需至少包含 immediateAction, nextAction，兩者皆必須是 JSON 字串陣列（string[]），不得回傳單一字串。
- phrasing 只在現場需要與人溝通時提供，若有提供必須是 JSON 字串陣列（string[]），並以簡潔日文句子列出
- 不要給出一般旅遊推薦，優先安全與官方聯絡管道
`.trim();

export function emergencyInstruction(contextSummary: string): string {
  return `${emergencyPromptRules}\n相關背景：${contextSummary}`;
}
