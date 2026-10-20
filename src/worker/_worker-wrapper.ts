// Cloudflare Pages Worker Wrapper
// Converts Hono app to Cloudflare Worker format

import app from './index';
import type { Env } from './types/env';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Return Hono app response
    return app.fetch(request, env, ctx);
  }
};
