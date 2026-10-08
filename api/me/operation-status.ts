import { createMeEndpoints, type MeEndpointOptions } from '../_lib/me-endpoints';
export const createHandler = (options?: MeEndpointOptions) => createMeEndpoints(options).operation;
export const POST = createHandler();
