import { createTileProxyPipeline, type TileProxyOptions } from '../../_lib/tile-proxy-pipeline';
export const createHandler = (options?: TileProxyOptions) => createTileProxyPipeline(options);
export const GET = createHandler();
