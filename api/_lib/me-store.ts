import { randomUUID } from 'node:crypto';
import { ADMIN_REDIS_LUA } from './admin-redis-script';
import { ADMIN_REDIS_KEYS } from './admin-redis-store';
import { createRedisAtomicTransport } from './redis-atomic-transport';
import { decodeRedisReply, type RedisStoreOptions } from './redis-shared-store';
import type { ProtectedEndpoint } from './cost-price-table';
import { accountingLookupIndex } from './request-epoch';
import { meRecord, isOwnRequest, isOwnRequestPage, meDate, operationMessages,
  type OwnRequestInput, type OwnRequest, type OwnRequestPage, type OperationState } from '../../src/types/self-service';

export interface RequestMutationResult {
  outcome: 'created' | 'duplicate' | 'conflict' | 'not_found' | 'resolved' | 'withdrawn' | 'invalid' | 'not_approved';
  review?: OwnRequest;
}
export type OperationResult = { outcome: 'found'; state: OperationState; updatedAt: string } |
  { outcome: 'not_found' | 'not_approved' };
export interface MeStore {
  access(subject: string): Promise<{ approved: boolean; weekWindowKey: string }>;
  operation(subject: string, endpoint: ProtectedEndpoint, key: string): Promise<OperationResult>;
  epochOperation?(subject: string, endpoint: ProtectedEndpoint, epochId: string, handle: string): Promise<OperationResult>;
  enqueue(subject: string, input: OwnRequestInput): Promise<RequestMutationResult>;
  list(subject: string, offset: number, limit: number): Promise<OwnRequestPage>;
  withdraw(subject: string, reviewId: string): Promise<RequestMutationResult>;
}
function isMutationResult(v: unknown): v is RequestMutationResult {
  return meRecord(v) && ['created', 'duplicate', 'conflict', 'not_found', 'resolved', 'withdrawn', 'invalid', 'not_approved']
    .includes(String(v.outcome)) &&
    (!['created', 'duplicate', 'withdrawn'].includes(String(v.outcome)) || isOwnRequest(v.review));
}
export function createRedisMeStore(options: RedisStoreOptions): MeStore {
  const driver = createRedisAtomicTransport({ ...options, keys: [
    ...ADMIN_REDIS_KEYS(options.namespace), `${options.namespace}:me-idempotency`, `${options.namespace}:me-events`,
  ] });
  const execute = async (operation: string, command: object): Promise<unknown> =>
    decodeRedisReply(await driver.execute(ADMIN_REDIS_LUA, { operation, command }));
  const mutation = async (operation: string, command: object): Promise<RequestMutationResult> => {
    const v = await execute(operation, command);
    if (!isMutationResult(v)) throw new TypeError('無效本人異動回應');
    return v;
  };
  const operationResult = (v: unknown): OperationResult => {
    if (!meRecord(v)) throw new TypeError('無效操作回應');
    if (v.outcome === 'not_found' || v.outcome === 'not_approved') return { outcome: v.outcome };
    if (v.outcome !== 'found' || !Object.hasOwn(operationMessages, String(v.state)) || !meDate(v.updatedAt))
      throw new TypeError('無效操作狀態');
    return { outcome: 'found', state: v.state as OperationState, updatedAt: v.updatedAt };
  };
  return {
    async access(subject) {
      const v = await execute('me_access', { subject });
      if (!meRecord(v) || typeof v.approved !== 'boolean' || typeof v.weekWindowKey !== 'string' ||
        !/^\d{4}-W\d{2}$/.test(v.weekWindowKey)) throw new TypeError('無效本人資格回應');
      return { approved: v.approved, weekWindowKey: v.weekWindowKey };
    },
    async operation(subject, endpoint, key) {
      return operationResult(await execute('me_operation', { subject, endpoint, key }));
    },
    async epochOperation(subject, endpoint, epochId, handle) {
      return operationResult(await execute('me_operation', { subject, endpoint,
        accountingIndex: accountingLookupIndex(epochId, handle) }));
    },
    enqueue: (subject, input) => mutation('me_enqueue', { subject, ...input, reviewId: randomUUID(), eventId: randomUUID() }),
    async list(subject, offset, limit) {
      const v = await execute('me_list', { subject, offset, limit });
      if (!isOwnRequestPage(v) || v.items.length > limit ||
        (v.nextOffset !== null && v.nextOffset !== offset + v.items.length)) throw new TypeError('無效本人清單');
      return v;
    },
    withdraw: (subject, reviewId) => mutation('me_withdraw', { subject, reviewId, eventId: randomUUID() }),
  };
}
