/** Fetch min-version policy: local static file first, then GitHub main. */

const REMOTE_MIN_VERSION_URL =
  'https://raw.githubusercontent.com/mausalas99/r-mas/main/min-version.json';

/**
 * @returns {Promise<{ minVersion: string, message?: string }|null>}
 */
export async function fetchMinVersionPayload() {
  if (typeof fetch !== 'function') return null;
  const urls = ['/min-version.json', REMOTE_MIN_VERSION_URL];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && typeof data === 'object' && data.minVersion) {
        return {
          minVersion: String(data.minVersion),
          message: data.message ? String(data.message) : undefined,
        };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export { REMOTE_MIN_VERSION_URL as MIN_VERSION_URL };
