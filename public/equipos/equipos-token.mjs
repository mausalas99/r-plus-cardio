/** Access token persistence for equipos mobile (URL + storage + cookie for PWA). */

export const TOKEN_KEY = 'rpc-equipos-token';
const TOKEN_COOKIE = 'rpc-equipos-token';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** @param {string} cookieHeader */
export function readTokenFromCookieHeader(cookieHeader) {
  const m = String(cookieHeader || '').match(/(?:^|;\s*)rpc-equipos-token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export function readTokenFromCookie() {
  if (typeof document === 'undefined') return '';
  return readTokenFromCookieHeader(document.cookie);
}

export function readTokenFromUrl(searchOverride) {
  const search =
    searchOverride ??
    (typeof window !== 'undefined' && window.location ? window.location.search : '');
  return new URLSearchParams(search).get('t') || '';
}

/** @param {string} token */
export function persistAccessToken(token) {
  const t = String(token || '').trim();
  if (!t) return false;
  try {
    localStorage.setItem(TOKEN_KEY, t);
    sessionStorage.setItem(TOKEN_KEY, t);
  } catch (_e) {
    void _e;
  }
  try {
    const secure =
      typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${TOKEN_COOKIE}=${encodeURIComponent(t)}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  } catch (_e) {
    void _e;
  }
  return true;
}

export function clearAccessToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch (_e) {
    void _e;
  }
  try {
    const secure =
      typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`;
  } catch (_e) {
    void _e;
  }
}

export function loadAccessToken() {
  const fromUrl = readTokenFromUrl();
  if (fromUrl) {
    persistAccessToken(fromUrl);
    return fromUrl;
  }
  try {
    const fromLocal = localStorage.getItem(TOKEN_KEY);
    if (fromLocal) return fromLocal;
    const fromSession = sessionStorage.getItem(TOKEN_KEY);
    if (fromSession) {
      persistAccessToken(fromSession);
      return fromSession;
    }
  } catch (_e) {
    void _e;
  }
  const fromCookie = readTokenFromCookie();
  if (fromCookie) {
    persistAccessToken(fromCookie);
    return fromCookie;
  }
  return '';
}

/**
 * Cloud lista de espera: bare URL is enough — fetch program token from worker.
 * @param {string} apiBase
 * @param {AbortSignal} [signal]
 */
export async function fetchCloudInviteToken(apiBase, signal) {
  const base = String(apiBase || '').replace(/\/+$/, '');
  if (!base) return '';
  let res;
  try {
    res = await fetch(`${base}/api/equipos/v1/access/invite`, {
      cache: 'no-store',
      signal,
    });
  } catch (_e) {
    void _e;
    return '';
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return '';
  const token = String(data.token || '').trim();
  if (!token) return '';
  persistAccessToken(token);
  return token;
}
