import { createSelfServiceEndpoints, type SelfServiceOptions } from '../_lib/self-service-endpoints';
export const createHandler = (options?: SelfServiceOptions) => createSelfServiceEndpoints(options).quota;
export const GET = createHandler();
