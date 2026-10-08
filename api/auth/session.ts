import { createSessionEndpoints, type SessionEndpointOptions } from '../_lib/session-endpoints';
export const createHandler = (options?: SessionEndpointOptions) => createSessionEndpoints(options).session;
export const GET = createHandler();
