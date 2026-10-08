import { createAdminHandler, type AdminEndpointOptions } from '../_lib/admin-endpoints';
export const createHandler = (options?: AdminEndpointOptions) => createAdminHandler('reviews', options);
export const GET = createHandler();
