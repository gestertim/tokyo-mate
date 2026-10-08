import { createAdminHandler, type AdminEndpointOptions } from '../../_lib/admin-endpoints';
export const createHandler = (options?: AdminEndpointOptions) => createAdminHandler('detail', options);
export const GET = createHandler();
