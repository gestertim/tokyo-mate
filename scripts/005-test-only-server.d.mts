export interface TestOnlyIdentity {
  id: string; label: string; status: string | null; tier?: string; admin?: boolean;
}
export function parseTestOnlyArguments(argv: string[], env?: Record<string, string | undefined>):
  { port: number; origin: string };
export function createTestOnlyApi(options: { origin: string }): Promise<{
  handle(request: Request): Promise<Response>;
  identities: readonly TestOnlyIdentity[];
}>;
export function startTestOnlyServer(argv?: string[]): Promise<import('node:http').Server>;
