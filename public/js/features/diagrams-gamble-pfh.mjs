import { escTxt } from '../labs.js';

export const DIAGRAM_LINE = 'stroke="var(--diagram-line)" stroke-width="1.5"';

/** @param {number} x @param {number} cy @param {string} lbl @param {object|null} obj @param {string} [anchor] */
export function diagramSpBlock(x, cy, lbl, obj, anchor) {
  anchor = anchor || 'middle';
  const ax = anchor === 'start' ? 'start' : anchor === 'end' ? 'end' : 'middle';
  const isAb = obj && obj.ab;
  const vc = isAb ? 'var(--error)' : 'var(--diagram-value)';
  const vt = obj ? escTxt(obj.val) : '—';
  const dec = isAb ? ' text-decoration="underline"' : '';
  return (
    '<g transform="translate(' + x + ',' + cy + ')">' +
    '<text x="0" y="-9" text-anchor="' + ax + '" dominant-baseline="middle" font-size="10" fill="var(--diagram-label)" font-family="Arial,sans-serif">' +
    lbl + '</text>' +
    '<text x="0" y="11" text-anchor="' + ax + '" dominant-baseline="middle" font-size="14" fill="' + vc + '" font-weight="bold" font-family="Arial,sans-serif"' + dec + '>' +
    vt + '</text></g>'
  );
}

/** @param {number} x @param {string} lbl @param {object|null} obj @param {boolean} isTop */
export function diagramGambleCell(x, lbl, obj, isTop) {
  const cy = isTop ? 40 : 92;
  const vc = obj && obj.ab ? 'var(--error)' : 'var(--diagram-value)';
  const vt = obj ? escTxt(obj.val) : '—';
  const dec = obj && obj.ab ? ' text-decoration="underline"' : '';
  return (
    '<g transform="translate(' + x + ',' + cy + ')">' +
    '<text x="0" y="-10" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--diagram-label)" font-family="Arial,sans-serif">' +
    lbl + '</text>' +
    '<text x="0" y="11" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="' + vc + '" font-weight="bold" font-family="Arial,sans-serif"' + dec + '>' +
    vt + '</text></g>'
  );
}

/** @param {number} x @param {string} lbl @param {object|null} obj @param {number} y_lbl */
export function diagramPfhCell(x, lbl, obj, y_lbl) {
  const cy = y_lbl + 7.5;
  const vc = obj && obj.ab ? 'var(--error)' : 'var(--diagram-value)';
  const vt = obj ? escTxt(obj.val) : '—';
  const dec = obj && obj.ab ? ' text-decoration="underline"' : '';
  return (
    '<g transform="translate(' + x + ',' + cy + ')">' +
    '<text x="0" y="-10" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--diagram-label)" font-family="Arial,sans-serif">' +
    lbl + '</text>' +
    '<text x="0" y="11" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="' + vc + '" font-weight="bold" font-family="Arial,sans-serif"' + dec + '>' +
    vt + '</text></g>'
  );
}

/**
 * @param {Record<string, Record<string, object>>} secs
 * @param {(sec: string, key: string) => object|null} g
 */
export function buildSvgGamble(secs, g) {
  const na = g(secs, 'ESC', 'Na');
  const k = g(secs, 'ESC', 'K');
  const cl = g(secs, 'ESC', 'Cl');
  const hco3 = g(secs, 'GASES', 'Bica') || g(secs, 'ESC', 'HCO3');
  const f = g(secs, 'ESC', 'F');
  const ca = g(secs, 'ESC', 'Ca');
  const bun = g(secs, 'QS', 'BUN');
  const cr = g(secs, 'QS', 'Cr');
  const glu = g(secs, 'QS', 'Glu');
  if (!na && !k && !cl && !bun && !cr && !glu) return null;

  const sy = 65;
  const dT = 12;
  const dB = 118;
  const d1 = 104;
  const d2 = 192;
  const d3 = 280;
  const forkX = 365;
  const c1 = 61;
  const c2 = 148;
  const c3 = 236;
  const c4 = 323;

  return (
    '<svg viewBox="0 0 470 130" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">' +
    '<line x1="18" y1="' + sy + '" x2="' + forkX + '" y2="' + sy + '" ' + DIAGRAM_LINE + '/>' +
    '<line x1="' + d1 + '" y1="' + dT + '" x2="' + d1 + '" y2="' + dB + '" ' + DIAGRAM_LINE + '/>' +
    '<line x1="' + d2 + '" y1="' + dT + '" x2="' + d2 + '" y2="' + dB + '" ' + DIAGRAM_LINE + '/>' +
    '<line x1="' + d3 + '" y1="' + dT + '" x2="' + d3 + '" y2="' + dB + '" ' + DIAGRAM_LINE + '/>' +
    '<line x1="' + forkX + '" y1="' + sy + '" x2="448" y2="18" ' + DIAGRAM_LINE + '/>' +
    '<line x1="' + forkX + '" y1="' + sy + '" x2="448" y2="112" ' + DIAGRAM_LINE + '/>' +
    diagramGambleCell(c1, 'Na', na, true) +
    diagramGambleCell(c2, 'Cl', cl, true) +
    diagramGambleCell(c3, 'P', f, true) +
    diagramGambleCell(c4, 'BUN', bun, true) +
    diagramGambleCell(c1, 'K', k, false) +
    diagramGambleCell(c2, 'HCO3', hco3, false) +
    diagramGambleCell(c3, 'Ca', ca, false) +
    diagramGambleCell(c4, 'Cr', cr, false) +
    diagramSpBlock(418, 65, 'Glu', glu, 'middle') +
    '</svg>'
  );
}

/**
 * @param {Record<string, Record<string, object>>} secs
 * @param {(sec: string, key: string) => object|null} g
 */
export function buildSvgPFH(secs, g) {
  const ca = g(secs, 'ESC', 'Ca');
  const ast = g(secs, 'PFHs', 'AST');
  const ldh = g(secs, 'PFHs', 'LDH');
  const pcr = g(secs, 'QS', 'PCR');
  const alt = g(secs, 'PFHs', 'ALT');
  const alb = g(secs, 'PFHs', 'Alb');
  const fa = g(secs, 'PFHs', 'FA');
  const bt = g(secs, 'PFHs', 'BT');
  const bd = g(secs, 'PFHs', 'BD');
  const bi = g(secs, 'PFHs', 'BI');
  if (!ast && !alt && !fa && !bt && !alb) return null;

  const cx = 135;
  const lx = 67;
  const rx = 202;
  const midLeft = pcr || ldh;
  const midLbl = pcr ? 'Prot' : 'LDH';

  return (
    '<svg viewBox="0 0 270 230" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">' +
    '<line x1="' + cx + '" y1="10" x2="' + cx + '" y2="145" ' + DIAGRAM_LINE + '/>' +
    '<line x1="22" y1="52" x2="248" y2="52" ' + DIAGRAM_LINE + '/>' +
    '<line x1="22" y1="104" x2="248" y2="104" ' + DIAGRAM_LINE + '/>' +
    '<line x1="22" y1="145" x2="248" y2="145" ' + DIAGRAM_LINE + '/>' +
    '<line x1="' + cx + '" y1="145" x2="45" y2="210" ' + DIAGRAM_LINE + '/>' +
    '<line x1="' + cx + '" y1="145" x2="225" y2="210" ' + DIAGRAM_LINE + '/>' +
    diagramPfhCell(lx, 'Ca', ca, 20) +
    diagramPfhCell(rx, 'AST', ast, 20) +
    (midLeft ? diagramPfhCell(lx, midLbl, midLeft, 65) : '') +
    diagramPfhCell(rx, 'ALT', alt, 65) +
    diagramPfhCell(lx, 'Alb', alb, 117) +
    diagramPfhCell(rx, 'FA', fa, 117) +
    diagramPfhCell(cx, 'BT', bt, 165) +
    diagramPfhCell(cx - 35, 'BD', bd, 195) +
    diagramPfhCell(cx + 35, 'BI', bi, 195) +
    '</svg>'
  );
}
