export class RequestBoundaryError extends Error {
  constructor(readonly code: 'INVALID_INPUT' | 'PAYLOAD_TOO_LARGE' | 'PROTECTION_SERVICE_UNAVAILABLE') { super(code); }
}
export interface ReadLimits { maxBytes: number; readTimeoutMs: number; maxDepth: number; maxNodes: number }
export async function readBoundedBytes(request: Pick<Request, 'body'>, limits: Pick<ReadLimits, 'maxBytes' | 'readTimeoutMs'>,
  audit: (event: { stage: string; outcome: string }) => void): Promise<Uint8Array> {
  if (!request.body) throw new RequestBoundaryError('INVALID_INPUT');
  const reader = request.body.getReader();
  let complete = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([(async () => {
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > limits.maxBytes) throw new RequestBoundaryError('PAYLOAD_TOO_LARGE');
        chunks.push(chunk.value);
      }
      const joined = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
      return joined;
    })(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RequestBoundaryError('INVALID_INPUT')), limits.readTimeoutMs);
    })]);
    complete = true;
    return result;
  } finally {
    clearTimeout(timer);
    if (!complete) void reader.cancel().catch(() => audit({ stage: 'reader', outcome: 'cancel_failed' }));
    reader.releaseLock();
  }
}
export async function readBoundedJson(request: Request, limits: ReadLimits,
  audit: (event: { stage: string; outcome: string }) => void): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new RequestBoundaryError('INVALID_INPUT');
  try {
    const bytes = await readBoundedBytes(request, limits, audit);
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    let nodes = 0;
    const stack = [{ value: body, depth: 1 }];
    while (stack.length) {
      const item = stack.pop()!;
      if (++nodes > limits.maxNodes || item.depth > limits.maxDepth) throw new RequestBoundaryError('INVALID_INPUT');
      if (item.value !== null && typeof item.value === 'object')
        for (const value of Object.values(item.value)) stack.push({ value, depth: item.depth + 1 });
    }
    return body;
  } catch (error) {
    if (error instanceof RequestBoundaryError) throw error;
    throw new RequestBoundaryError('INVALID_INPUT');
  }
}
