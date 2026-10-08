import { createRequestEpochEndpoints, type RequestEpochEndpointsOptions } from '../_lib/request-epoch-endpoints';

export const createHandler = (options?: RequestEpochEndpointsOptions) => createRequestEpochEndpoints(options).issue;
export const POST = createHandler();
