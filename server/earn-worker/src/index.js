/* global Response */
// Cloudflare Worker (module syntax, free plan): BitLabs reward / reconciliation callback.
//   GET /bitlabsPostback?uid=..&val=..&tx=..&type=..&ref=..&hash=..
// Same behaviour as bitlabsPostback in server/earn/index.js; see server/earn/README.md for setup.
import { handleBitlabsPostback } from './handler.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== '/bitlabsPostback') {
      return new Response('not found', { status: 404 });
    }
    if (request.method !== 'GET') {
      return new Response('method not allowed', { status: 405, headers: { allow: 'GET' } });
    }
    const { status, body } = await handleBitlabsPostback({ url: request.url, env });
    return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
