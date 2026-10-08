import type { AdminAuthOptions } from './admin-auth';
import { adminSubjectValid } from './admin-store';

export class AdminAllowlistUnavailableError extends Error {
  constructor() {
    super('管理者可信來源未配置或格式無法確認');
    this.name = 'AdminAllowlistUnavailableError';
  }
}

// M1 的輸入只能來自可信 server options；不讀取 Request、前端 role 或正式環境。
export function createAdminAllowlist(allowlist: unknown): Pick<AdminAuthOptions, 'isAdmin'> {
  let value: unknown = allowlist;
  if (typeof value === 'string') {
    try {
      value = value.length <= 1_000_000 ? JSON.parse(value) : null;
    } catch { value = null; }
  }
  const valid = Array.isArray(value) && value.length > 0 && value.every(adminSubjectValid) &&
    new Set(value).size === value.length;
  const subjects = new Set<string>(valid ? value as string[] : []);
  return {
    async isAdmin(subject) {
      if (!valid) throw new AdminAllowlistUnavailableError();
      return adminSubjectValid(subject) && subjects.has(subject);
    },
  };
}

export function createAdminAuthOptions(
  options: Omit<AdminAuthOptions, 'isAdmin'> & { adminSubjects: unknown },
): AdminAuthOptions {
  const { adminSubjects, ...base } = options;
  return { ...base, ...createAdminAllowlist(adminSubjects) };
}
