/** Código personal para activar privilegios de administración del programa. */
export const ADMIN_ACCESS_CODE = 'Msg170699';

/** @param {unknown} input */
export function verifyAdminAccessCode(input) {
  return String(input ?? '').trim() === ADMIN_ACCESS_CODE;
}
