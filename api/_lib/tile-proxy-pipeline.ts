import { createHash } from 'node:crypto';
import { errorResponse, type TrustedPublicRejection } from './error-envelope';
import { createSessionEndpoints } from './session-endpoints';
import type { SelfServiceOptions } from './self-service-endpoints';
import { withStoreTimeout } from './shared-store';

export interface TileCoordinate { z: number; x: number; y: number }
export interface TileData { bytes: Uint8Array; etag: string }
export const INITIAL_TILE_POLICY = { perMinute: 120, perDay: 1000, dailyCreditQuarters: 9600, cacheTtlSeconds: 604800 } as const;
export interface TileStore {
  consumeUserRequest(subject: string, nowIso: string, policy: typeof INITIAL_TILE_POLICY):
    Promise<'allowed' | 'limited' | 'unavailable'>;
  /** shared 原子 cache／flight／0.25-credit 預留；不得用 process Map 作正式實作。 */
  lookupOrReserve(tile: TileCoordinate, nowIso: string, policy: typeof INITIAL_TILE_POLICY):
    Promise<{ kind: 'hit'; data: TileData } | { kind: 'leader'; flightId: string; reservedAtMs?: number; leaseExpiresAtMs?: number } |
      { kind: 'wait'; flightId: string } | { kind: 'unavailable' }>;
  wait(flightId: string): Promise<TileData>;
  finish(flightId: string, observation: { kind: 'success'; data: TileData } | { kind: 'uncertain' },
    cacheTtlSeconds: number): Promise<void>;
}
export interface TileProxyOptions extends SelfServiceOptions {
  tiles: TileStore;
  maxTileBytes: number;
  upstreamTimeoutMs: number;
  flightBudget?: { leaseMs: number; executionTimeoutMs: number; settlementBufferMs: number };
  upstream: { fetchTile(tile: TileCoordinate, signal: AbortSignal): Promise<Uint8Array> };
}

export function createTileProxyPipeline(options?: TileProxyOptions) {
  return async (request: Request): Promise<Response> => {
    const finishHeaders = (response: Response) => {
      response.headers.set('CDN-Cache-Control', 'no-store');
      response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
      return response;
    };
    const reject = (rejection: TrustedPublicRejection) => finishHeaders(errorResponse(rejection, 'GET'));
    const unavailable = () => reject({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    if (request.method !== 'GET') return reject({ kind: 'code', code: 'METHOD_NOT_ALLOWED' });
    const url = new URL(request.url);
    const matches = /^\/api\/map\/tile\/(0|[1-9]\d*)\/(0|[1-9]\d*)\/(0|[1-9]\d*)\.png$/.exec(url.pathname);
    const tile = matches ? { z: Number(matches[1]), x: Number(matches[2]), y: Number(matches[3]) } : null;
    if (!tile || url.search || ![tile.z, tile.x, tile.y].every(Number.isSafeInteger) ||
        tile.z > 20 || tile.x >= 2 ** tile.z || tile.y >= 2 ** tile.z)
      return reject({ kind: 'code', code: 'INVALID_TILE_COORDINATE' });
    if (!options) return unavailable();
    if (!Number.isSafeInteger(options.maxTileBytes) || options.maxTileBytes < 8 ||
        !Number.isSafeInteger(options.upstreamTimeoutMs) || options.upstreamTimeoutMs <= 0) return unavailable();
    const validateTile = (data: TileData): TileData => {
      const png = [137, 80, 78, 71, 13, 10, 26, 10];
      if (!(data.bytes instanceof Uint8Array) || data.bytes.length < 8 || data.bytes.length > options.maxTileBytes ||
          !png.every((byte, index) => data.bytes[index] === byte) ||
          data.etag !== `"${createHash('sha256').update(data.bytes).digest('hex')}"`)
        throw new TypeError('無效或無法確認的圖磚資料');
      return data;
    };
    try {
      const session = await createSessionEndpoints(options).lookup(request);
      if (session.kind === 'unauthenticated') return reject({ kind: 'code', code: 'AUTH_REQUIRED' });
      if (session.kind !== 'authenticated') return unavailable();
      const quota = await withStoreTimeout(options.engine.getAtomicSnapshot(session.subject), options.timeoutMs);
      if (!quota.ok) {
        if (quota.status === 403) return reject({ kind: 'code', code: 'ACCESS_NOT_APPROVED' });
        if (quota.status === 429) return reject({ kind: 'quota', state: quota.denialClass, window: quota.window });
        return unavailable();
      }
      const counted = await withStoreTimeout(options.tiles.consumeUserRequest(session.subject,
        options.now().toISOString(), INITIAL_TILE_POLICY), options.timeoutMs);
      if (counted === 'limited') return reject({ kind: 'code', code: 'MAP_TILE_QUOTA_EXHAUSTED' });
      if (counted !== 'allowed') return unavailable();
      const access = await withStoreTimeout(options.tiles.lookupOrReserve(tile,
        options.now().toISOString(), INITIAL_TILE_POLICY), options.timeoutMs);
      let data: TileData;
      if (access.kind === 'hit') data = validateTile(access.data);
      else if (access.kind === 'wait') {
        data = validateTile(await withStoreTimeout(options.tiles.wait(access.flightId), options.upstreamTimeoutMs));
      } else if (access.kind === 'leader') {
        if (options.flightBudget) {
          const budget = options.flightBudget, grantAt = options.now().getTime();
          if (typeof access.reservedAtMs !== 'number' || typeof access.leaseExpiresAtMs !== 'number' ||
              ![access.reservedAtMs, access.leaseExpiresAtMs, grantAt, budget.leaseMs,
                budget.executionTimeoutMs, budget.settlementBufferMs].every(Number.isSafeInteger) ||
              budget.executionTimeoutMs !== options.upstreamTimeoutMs ||
              access.leaseExpiresAtMs - access.reservedAtMs !== budget.leaseMs ||
              grantAt < access.reservedAtMs ||
              access.leaseExpiresAtMs - grantAt <= budget.executionTimeoutMs + budget.settlementBufferMs) {
            await withStoreTimeout(options.tiles.finish(access.flightId, { kind: 'uncertain' },
              INITIAL_TILE_POLICY.cacheTtlSeconds), options.timeoutMs);
            return unavailable();
          }
        }
        const controller = new AbortController();
        try {
          const pending = options.upstream.fetchTile(tile, controller.signal);
          const bytes = await withStoreTimeout(pending, options.upstreamTimeoutMs);
          data = validateTile({ bytes, etag: `"${createHash('sha256').update(bytes).digest('hex')}"` });
        } catch (error) {
          controller.abort();
          // leader 的未知結果保守保留 credits；finish 失敗也不得再預留或呼叫上游。
          await withStoreTimeout(options.tiles.finish(access.flightId, { kind: 'uncertain' },
            INITIAL_TILE_POLICY.cacheTtlSeconds), options.timeoutMs);
          throw error;
        }
        await withStoreTimeout(options.tiles.finish(access.flightId, { kind: 'success', data },
          INITIAL_TILE_POLICY.cacheTtlSeconds), options.timeoutMs);
      } else return unavailable();
      const headers = { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-cache', ETag: data.etag };
      const response = request.headers.get('if-none-match') === data.etag ?
        new Response(null, { status: 304, headers }) :
        new Response(Uint8Array.from(data.bytes), { status: 200, headers });
      return finishHeaders(response);
    } catch (error) {
      options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
      if (!(error instanceof Error)) throw error;
      return unavailable();
    }
  };
}
