/** API client for equipos micro-app. */

import { bearerHeaders } from '../lib/equipos/equipos-http-headers.mjs';

/** Sync with lib/equipos/equipos-constants.mjs */
const TARGET_DATA_URL_LEN = 320_000;
const DEFAULT_MAX_DIM = 720;
const DEFAULT_JPEG_QUALITY = 0.72;

/**
 * @param {string} apiBase
 * @param {string} token
 * @param {string} path
 * @param {RequestInit} [opts]
 */
export async function equiposFetch(apiBase, token, path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${apiBase}/api/equipos/v1${path}${sep}t=${encodeURIComponent(token)}`;
  const headers = {
    ...(opts.headers || {}),
    ...bearerHeaders(token),
  };
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Error de red.');
    err.code = data.error;
    throw err;
  }
  return data;
}

/**
 * Resize + JPEG compress for upload (target well under 1 MB server cap).
 * @param {File} file
 * @param {number} [maxDim]
 */
export function resizeImageFile(file, maxDim = DEFAULT_MAX_DIM) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let dim = maxDim;
      let quality = DEFAULT_JPEG_QUALITY;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));

      const encode = () => {
        let { width, height } = img;
        const scale = Math.min(1, dim / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > TARGET_DATA_URL_LEN && quality > 0.42) {
          quality -= 0.1;
          return encode();
        }
        if (dataUrl.length > TARGET_DATA_URL_LEN && dim > 480) {
          dim = Math.round(dim * 0.82);
          quality = DEFAULT_JPEG_QUALITY;
          return encode();
        }
        resolve(dataUrl);
      };
      encode();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagen'));
    };
    img.src = url;
  });
}
