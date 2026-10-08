import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node 24 的本機 caller 直接載入既有 TS adapter；不產生含秘密的編譯檔。
export async function loadPhaseBAdapters() {
  const root = new URL('../', import.meta.url).href;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL?.startsWith(root) && specifier.startsWith('.') &&
          !extname(specifier) && existsSync(`${fileURLToPath(new URL(specifier, context.parentURL))}.ts`))
        specifier += '.ts';
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith(root) && url.endsWith('.ts')) return {
        format: 'module', shortCircuit: true,
        source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
      };
      return nextLoad(url, context);
    },
  });
  const [rest, store] = await Promise.all([
    import('../api/_lib/redis-rest-transport.ts'),
    import('../api/_lib/redis-shared-store.ts'),
  ]);
  return { ...rest, ...store };
}
