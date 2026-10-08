import { createAdminHandler, type AdminEndpointOptions } from '../_lib/admin-endpoints';
export const createHandler = (options?: AdminEndpointOptions) => createAdminHandler('approvals', options);
export const POST = createHandler();
