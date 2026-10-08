import { createMeEndpoints, type MeEndpointOptions } from '../../../_lib/me-endpoints';
export const createHandler = (options?: MeEndpointOptions) => createMeEndpoints(options).withdraw;
export const POST = createHandler();
