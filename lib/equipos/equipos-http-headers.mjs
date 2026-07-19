/** Equipos API auth header builder (X-Equipos-Token). */

/** @param {string} token */
export function bearerHeaders(token) {
  return { 'X-Equipos-Token': String(token || '') };
}
