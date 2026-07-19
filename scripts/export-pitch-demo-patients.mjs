#!/usr/bin/env node
/**
 * Genera JSON de DEMO PÉREZ (modo presentación).
 * Uso: node scripts/export-pitch-demo-patients.mjs [directorio-salida]
 */
import fs from 'node:fs';
import { cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPitchDemoPatientExport,
  buildPitchDemoBundleExport,
  buildPitchDemoPatientEntry,
} from '../public/js/pitch-demo-export.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.resolve(root, process.argv[2] || 'docs/demo-patients');
/** Fecha «hoy» al exportar: monitoreo y glucometrías alineados con la ventana actual. */
const exportRef = new Date();

fs.mkdirSync(outDir, { recursive: true });

const perezPath = path.join(outDir, 'demo-perez.json');
fs.writeFileSync(
  perezPath,
  JSON.stringify(buildPitchDemoPatientExport({ refDate: exportRef }), null, 2) + '\n',
  'utf8'
);
console.log('wrote', path.relative(root, perezPath));

const bundlePath = path.join(outDir, 'demo-pitch-bundle.json');
fs.writeFileSync(
  bundlePath,
  JSON.stringify(buildPitchDemoBundleExport({ refDate: exportRef }), null, 2) + '\n',
  'utf8'
);
console.log('wrote', path.relative(root, bundlePath));

const rangePath = path.join(outDir, 'demo-pitch-rango.json');
fs.writeFileSync(
  rangePath,
  JSON.stringify(
    {
      format: 'r-plus-range-export',
      version: 1,
      exportedAt: exportRef.toISOString(),
      from: formatDdMmYyyy(new Date(exportRef.getTime() - 2 * 24 * 60 * 60 * 1000)),
      to: formatDdMmYyyy(exportRef),
      entries: [buildPitchDemoPatientEntry({ refDate: exportRef })],
    },
    null,
    2
  ) + '\n',
  'utf8'
);
console.log('wrote', path.relative(root, rangePath));

const legacyGarcia = path.join(outDir, 'demo-garcia.json');
if (fs.existsSync(legacyGarcia)) {
  fs.unlinkSync(legacyGarcia);
  console.log('removed', path.relative(root, legacyGarcia));
}

console.log('reference date:', exportRef.toISOString());

function formatDdMmYyyy(d) {
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear()
  );
}

const publicDemoDir = path.join(root, 'public/demo-patients');
fs.mkdirSync(publicDemoDir, { recursive: true });
cpSync(perezPath, path.join(publicDemoDir, 'demo-perez.json'), { force: true });
cpSync(bundlePath, path.join(publicDemoDir, 'demo-pitch-bundle.json'), { force: true });
cpSync(rangePath, path.join(publicDemoDir, 'demo-pitch-rango.json'), { force: true });
const publicGarcia = path.join(publicDemoDir, 'demo-garcia.json');
if (fs.existsSync(publicGarcia)) fs.unlinkSync(publicGarcia);
console.log('copied to', path.relative(root, publicDemoDir));
