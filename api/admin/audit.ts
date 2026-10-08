import { createAdminHandler, type AdminEndpointOptions } from '../_lib/admin-endpoints';
export const createHandler = (options?: AdminEndpointOptions) => createAdminHandler('audits', options);
export const GET = createHandler();
