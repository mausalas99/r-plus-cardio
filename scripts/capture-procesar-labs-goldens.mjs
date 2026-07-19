// Regenerates the procesarLabs characterization goldens.
// Run ONLY when the expected output legitimately changes (never during Phase 6).
//   node scripts/capture-procesar-labs-goldens.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { procesarLabs } from '../public/js/labs.js';
import { PROCESAR_LABS_FIXTURES } from '../public/js/labs-procesar-fixtures.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const goldens = {};
for (const [name, texto] of Object.entries(PROCESAR_LABS_FIXTURES)) {
  goldens[name] = procesarLabs(texto);
}
const outPath = join(root, 'public/js/labs-procesar-goldens.json');
writeFileSync(outPath, JSON.stringify(goldens, null, 2) + '\n');
console.log('wrote', outPath, '—', Object.keys(goldens).join(', '));
