export const liveDataPromptRules = `
請判斷使用者是否需要即時資訊，並以 JSON 回應：freshness, liveDataMessage, liveDataNextAction。
- freshness 只可為 'not_required' | 'live_required' | 'verified' | 'unavailable' | 'uncertain'
- 如果使用者詢問今天/今晚/現在/目前/最新、營業狀態、車班延誤、天氣、活動或訂位等，判定為 live_required
- 若已確認外部最新資料，則回傳 verified 並說明查詢時間與來源
- 若查詢失敗或缺資料，回傳 unavailable 或 uncertain，並給出重新查詢或官方確認建議
- 回應內容需簡潔、誠實，避免假裝已確認最新資訊
`.trim();

export function liveDataInstruction(contextSummary: string): string {
  return `${liveDataPromptRules}\n相關背景：${contextSummary}`;
}
