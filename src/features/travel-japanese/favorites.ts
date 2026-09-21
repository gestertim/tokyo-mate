const STORAGE_KEY = 'tokyo-mate:travel-japanese:favorites';

export function loadFavoriteIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function persistFavoriteIds(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 寫入失敗（例如 quota 已滿或 localStorage 不可用）不得影響其餘功能，安全忽略。
  }
}
