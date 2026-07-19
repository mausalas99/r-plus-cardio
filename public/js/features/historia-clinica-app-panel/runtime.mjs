import { esc } from '../../dom-escape.mjs';
export { esc };
export function newRowId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}
