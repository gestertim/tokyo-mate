import { createSelfServiceEndpoints, type SelfServiceOptions } from '../_lib/self-service-endpoints';
export const createHandler = (options?: SelfServiceOptions) => createSelfServiceEndpoints(options).mapEligibility;
export const GET = createHandler();
