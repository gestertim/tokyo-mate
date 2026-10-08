import { createAdminHandler } from '../_lib/admin-endpoints';
export { type AdminEndpointOptions } from '../_lib/admin-endpoints';
export const createHandler = (options?: import('../_lib/admin-endpoints').AdminEndpointOptions) => createAdminHandler('users', options);
export const GET = createHandler();
