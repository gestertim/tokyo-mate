import type { RedisEvalTransport } from '../../api/_lib/redis-atomic-transport';
import { runLuaRedis, type LuaInvocation } from './lua-redis-harness';

// Replays an ordered TEST_ONLY history against the interpreter, never contacts a Redis service.
export function createEpochLuaTransport(now: () => Date) {
  const history: LuaInvocation[] = [];
  const transport: RedisEvalTransport = {
    async eval(script, keys, argumentsJson) {
      history.push({ script, keys, command: JSON.parse(argumentsJson), now: now().toISOString() });
      const result = runLuaRedis(history).at(-1);
      if (result && typeof result === 'object' && 'fixtureError' in result)
        throw new Error(String(result.fixtureError));
      return JSON.stringify(result);
    },
  };
  return { transport, history };
}
