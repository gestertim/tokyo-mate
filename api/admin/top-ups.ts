import { createAdminHandler, type AdminEndpointOptions } from '../_lib/admin-endpoints';
export const createHandler = (options?: AdminEndpointOptions) => createAdminHandler('topups', options);
export const POST = createHandler();
