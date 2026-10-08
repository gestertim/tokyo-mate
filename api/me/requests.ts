import { createMeEndpoints, type MeEndpointOptions } from '../_lib/me-endpoints';
export const createHandler = (options?: MeEndpointOptions) => createMeEndpoints(options).requests;
export const GET = createHandler();
export const POST = createHandler();
