import { applyCors, corsPreflight } from './cors.js';
import { handleEquiposApi } from './routes.js';
import { purgeExpiredEquiposPhotos } from './purge.js';

const API_PREFIX = '/api/equipos/v1';

/** @param {string} pathname */
function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

/** @param {Request} request @param {import('@cloudflare/workers-types').ExecutionContext} env */
async function handleRequest(request, env, ctx) {
  const preflight = corsPreflight(request);
  if (preflight) return applyCors(request, preflight);

  const url = new URL(request.url);
  const path = normalizePath(url.pathname);

  if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
    const subpath = path.slice(API_PREFIX.length) || '/';
    const res = await handleEquiposApi(request, env, subpath, ctx);
    return applyCors(request, res);
  }

  if (env.ASSETS) {
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status !== 404) {
      return applyCors(request, assetRes);
    }
    // Trailing-slash static paths (e.g. /equipos/) — retry without slash.
    if (url.pathname !== path) {
      const slashless = new Request(new URL(path + url.search, url.origin), request);
      const retryRes = await env.ASSETS.fetch(slashless);
      if (retryRes.status !== 404) {
        return applyCors(request, retryRes);
      }
    }
  }

  if (path === '/' || path === '/equipos') {
    const indexReq = new Request(new URL('/index.html', url.origin), request);
    const indexRes = env.ASSETS ? await env.ASSETS.fetch(indexReq) : new Response('Not found', { status: 404 });
    return applyCors(request, indexRes);
  }

  return applyCors(
    request,
    new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })
  );
}

export default {
  /** @param {Request} request @param {import('@cloudflare/workers-types').ExecutionContext} env */
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },

  /** @param {ScheduledEvent} event @param {import('@cloudflare/workers-types').ExecutionContext} env */
  async scheduled(event, env) {
    try {
      await purgeExpiredEquiposPhotos(env.DB, env.PHOTOS);
    } catch (e) {
      console.error('[equipos-purge]', e?.message || e);
    }
  },
};
