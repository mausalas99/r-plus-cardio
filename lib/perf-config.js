'use strict';

// Config de rendimiento persistida en userData, leída ANTES de app.whenReady().
// Default: aceleración por hardware ACTIVADA — las animaciones del premium UI
// (transform/opacity/backdrop-filter) componen en GPU; en software se ven
// entrecortadas. Opt-out para equipos con muy poca RAM:
//   userData/performance.json → {"hardwareAcceleration": false}

const PERF_CONFIG_FILE = 'performance.json';

function normalizePerfConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  return { hardwareAcceleration: cfg.hardwareAcceleration !== false };
}

function readPerfConfig(fsLike, filePath) {
  try {
    return normalizePerfConfig(JSON.parse(fsLike.readFileSync(filePath, 'utf8')));
  } catch {
    return normalizePerfConfig(null);
  }
}

function writePerfConfig(fsLike, filePath, raw) {
  const cfg = normalizePerfConfig(raw);
  fsLike.writeFileSync(filePath, JSON.stringify(cfg), 'utf8');
  return cfg;
}

module.exports = { PERF_CONFIG_FILE, normalizePerfConfig, readPerfConfig, writePerfConfig };
