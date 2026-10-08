import { createSessionEndpoints, type SessionEndpointOptions } from '../_lib/session-endpoints';
export const createHandler = (options?: SessionEndpointOptions) => createSessionEndpoints(options).logout;
export const POST = createHandler();
