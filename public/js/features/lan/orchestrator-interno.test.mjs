import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const internoSrc = readFileSync(join(here, 'orchestrator-interno.mjs'), 'utf8');
const eaPanelSrc = readFileSync(join(dirname(here), 'estado-actual-panel.mjs'), 'utf8');

test('interno host sync applies monitoreo when census row is missing', () => {
  assert.match(internoSrc, /ensureLocalPatientForInternoSync/);
  assert.match(internoSrc, /if \(monitoreo && typeof monitoreo === 'object'\)/);
  assert.doesNotMatch(internoSrc, /if \(local && detail\.monitoreo/);
});

test('estado actual panel refreshes on interno vitals for active patient', () => {
  assert.match(eaPanelSrc, /rpc-interno-vitals-synced/);
  assert.match(eaPanelSrc, /renderEstadoActualPanel\(\{ force: true, syncHeavy: true \}\)/);
});
