/**
 * QR SVG for interno URLs (offline LAN, no external API).
 */
import qrcode from 'qrcode-generator';

/** @param {string} text @param {number} [cellSize] */
export function renderQrSvg(text, cellSize = 4) {
  const qr = qrcode(0, 'M');
  qr.addData(String(text || ''));
  qr.make();

  const n = qr.getModuleCount();
  const size = n * cellSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="100%" height="100%" fill="#fff"/>`;
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (!qr.isDark(row, col)) continue;
      const x = col * cellSize;
      const y = row * cellSize;
      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#000"/>`;
    }
  }
  svg += '</svg>';
  return svg;
}
