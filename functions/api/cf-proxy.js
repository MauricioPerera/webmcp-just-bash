/**
 * Cloudflare Pages Function: Transparent Edge Proxy for Cloudflare Provisioning & Workers API
 * 
 * Bypasses browser CORS restrictions when making client-side calls to api.cloudflare.com.
 */
export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/api\/cf-proxy/, '');
  const targetUrl = `https://api.cloudflare.com/client/v4${targetPath}${url.search}`;

  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lk = key.toLowerCase();
    if (lk !== 'host' && lk !== 'origin' && lk !== 'referer') {
      forwardHeaders.set(key, value);
    }
  }
  forwardHeaders.set('User-Agent', 'wrangler/4.102.0');

  const cfResponse = await fetch(targetUrl, {
    method: request.method,
    headers: forwardHeaders,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer()
  });

  const responseHeaders = new Headers(cfResponse.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', '*');

  return new Response(cfResponse.body, {
    status: cfResponse.status,
    statusText: cfResponse.statusText,
    headers: responseHeaders
  });
}
