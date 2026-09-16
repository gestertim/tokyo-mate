// Verification-only, one-time instrumentation to distinguish SDK retry latency from single-attempt
// provider latency (H1 vs H2). Transparent fetch wrapper: never alters request/response semantics,
// never logs request/response bodies, headers wholesale, or credentials.

export interface OpenAIAttemptRecord {
  event: 'tokyo-mate.verification.openai-attempt';
  verificationCorrelationId?: string;
  attemptSequence: number;
  attemptStartMs: number;
  attemptEndMs: number;
  attemptDurationMs: number;
  httpStatus?: number;
  requestId?: string;
  retryAfterMsHeaderPresent: boolean;
  retryAfterMsHeaderValue?: number;
  retryAfterHeaderPresent: boolean;
  retryAfterHeaderValue?: number;
  networkErrorClass?: string;
}

type FetchFn = typeof fetch;

export interface OpenAIAttemptInstrumentationDeps {
  fetchImpl?: FetchFn;
  onAttempt?: (record: OpenAIAttemptRecord) => void;
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

// 僅接受非負有限數值視為合法；其餘（缺少、非數字、負數）一律視為不合法並回傳 undefined。
function parseValidNonNegativeNumber(headerValue: string | null): number | undefined {
  if (headerValue === null) return undefined;
  const parsed = Number(headerValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function defaultOnAttempt(record: OpenAIAttemptRecord): void {
  console.info(JSON.stringify(record));
}

// 每次呼叫回傳一個新的 attempt-sequence 計數器，因此一個 logical request（一次 createOpenAIClient() 呼叫）
// 恰好對應一個 fetch wrapper 實例，同一 wrapper 內遞增的 sequence 即為同一 logical request 內的 attempt 順序。
export function createInstrumentedFetch(
  verificationCorrelationId: string | undefined,
  deps: OpenAIAttemptInstrumentationDeps = {},
): FetchFn {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const onAttempt = deps.onAttempt ?? defaultOnAttempt;
  let attemptSequence = 0;

  return async function instrumentedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const sequence = ++attemptSequence;
    const attemptStartMs = performance.now();
    let response: Response;
    try {
      response = await fetchImpl(input, init);
    } catch (error) {
      const attemptEndMs = performance.now();
      onAttempt({
        event: 'tokyo-mate.verification.openai-attempt',
        verificationCorrelationId,
        attemptSequence: sequence,
        attemptStartMs: roundMilliseconds(attemptStartMs),
        attemptEndMs: roundMilliseconds(attemptEndMs),
        attemptDurationMs: roundMilliseconds(attemptEndMs - attemptStartMs),
        retryAfterMsHeaderPresent: false,
        retryAfterHeaderPresent: false,
        networkErrorClass: error instanceof Error ? error.name : typeof error,
      });
      throw error;
    }
    const attemptEndMs = performance.now();
    const retryAfterMsHeader = response.headers.get('retry-after-ms');
    const retryAfterHeader = response.headers.get('retry-after');
    onAttempt({
      event: 'tokyo-mate.verification.openai-attempt',
      verificationCorrelationId,
      attemptSequence: sequence,
      attemptStartMs: roundMilliseconds(attemptStartMs),
      attemptEndMs: roundMilliseconds(attemptEndMs),
      attemptDurationMs: roundMilliseconds(attemptEndMs - attemptStartMs),
      httpStatus: response.status,
      requestId: response.headers.get('x-request-id') ?? undefined,
      retryAfterMsHeaderPresent: retryAfterMsHeader !== null,
      retryAfterMsHeaderValue: parseValidNonNegativeNumber(retryAfterMsHeader),
      retryAfterHeaderPresent: retryAfterHeader !== null,
      retryAfterHeaderValue: parseValidNonNegativeNumber(retryAfterHeader),
    });
    return response;
  };
}
