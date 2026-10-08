import { randomUUID } from 'node:crypto';
import { createRedisAtomicTransport } from './redis-atomic-transport';
import { REDIS_QUOTA_KEYS, decodeRedisReply, type RedisStoreOptions } from './redis-shared-store';
import { ADMIN_REDIS_LUA } from './admin-redis-script';
import { adminIdValid, adminSubjectValid, type AdminStore, type AdminMutationResult, type AdminOverviewData } from './admin-store';
import { SharedStoreUnavailableError } from './shared-store';
import { ADMIN_NEAR_LIMIT_PERCENT } from './local-protection-policy';

export interface RedisAdminStoreOptions extends RedisStoreOptions {
  nearLimitPercent?: number;
}

export function ADMIN_REDIS_KEYS(namespace: string): readonly string[] {
  return [...REDIS_QUOTA_KEYS(namespace), `${namespace}:admin-users`, `${namespace}:admin-reviews`,
    `${namespace}:admin-audit`, `${namespace}:admin-idempotency`];
}
export function createRedisAdminStore(options: RedisAdminStoreOptions): AdminStore & { overview(): Promise<AdminOverviewData> } {
  const driver = createRedisAtomicTransport({ ...options, keys: ADMIN_REDIS_KEYS(options.namespace) });
  const execute = async <T>(operation: string, command: object): Promise<T> =>
    decodeRedisReply(await driver.execute(ADMIN_REDIS_LUA, { operation, command })) as T;
  const page = <T>(operation: string, offset: number, limit: number) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 999999 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError('無效管理分頁');
    return execute<T>(operation, { offset, limit });
  };
  return {
    async overview() {
      const percent = options.nearLimitPercent === undefined ? ADMIN_NEAR_LIMIT_PERCENT : options.nearLimitPercent;
      if (typeof percent !== 'number' || !Number.isSafeInteger(percent) || percent < 1 || percent > 100) {
        options.audit({ operation: 'redis_atomic', outcome: 'unavailable' });
        throw new SharedStoreUnavailableError('ADMIN_NEAR_LIMIT_POLICY_UNAVAILABLE');
      }
      return execute('overview', { nearLimitPercent: percent });
    },
    users: (offset, limit) => page('users', offset, limit),
    reviews: (offset, limit) => page('reviews', offset, limit),
    audits: (offset, limit) => page('audits', offset, limit),
    detail: (subject, nowIso) => {
      if (!adminSubjectValid(subject) || !Number.isFinite(Date.parse(nowIso))) throw new TypeError('無效詳情查詢');
      return execute('detail', { subject, nowIso });
    },
    async mutate(command) {
      if (!adminIdValid(command.idempotencyKey) || !adminSubjectValid(command.adminSubject) ||
        !adminSubjectValid(command.targetIdentitySubject) || !adminIdValid(command.reasonCode) ||
        command.confirmed !== true) throw new TypeError('無效管理異動');
      const result = await execute<AdminMutationResult>('mutate', {
        ...command, auditId: randomUUID(), generatedTopUpId: randomUUID(),
      });
      if (!result || !['applied', 'duplicate', 'conflict', 'not_found', 'invalid'].includes(result.outcome) ||
        (['applied', 'duplicate'].includes(result.outcome) && !adminIdValid(result.auditId))) throw new TypeError('無效管理異動回覆');
      return result;
    },
  };
}
