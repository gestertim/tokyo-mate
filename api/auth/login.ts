import { createOidcFlow, type OidcFlowOptions } from '../_lib/oidc-flow';
import { errorResponse } from '../_lib/error-envelope';

export const createHandler = (options?: OidcFlowOptions) => options ? createOidcFlow(options).login :
  async (request: Request) => errorResponse({ kind: 'code',
    code: request.method === 'GET' ? 'PROTECTION_SERVICE_UNAVAILABLE' : 'METHOD_NOT_ALLOWED' }, 'GET');
export const GET = createHandler();
