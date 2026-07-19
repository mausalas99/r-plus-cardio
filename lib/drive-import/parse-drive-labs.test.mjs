import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDriveLaboratorios,
  driveLabPanelLineToResLab,
  normalizeDriveLabPanel,
  extractLaboratoriosBody,
} from './parse-drive-labs.mjs';
import { filterNewDriveLabSets } from './merge-drive-labs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, 'fixtures', 'labs-drive-sample.txt'), 'utf8');

test('normalizeDriveLabPanel aliases ES PFH GV', () => {
  assert.equal(normalizeDriveLabPanel('ES'), 'ESC');
  assert.equal(normalizeDriveLabPanel('PFH'), 'PFHs');
  assert.equal(normalizeDriveLabPanel('GV'), 'GASES');
});

test('driveLabPanelLineToResLab compact BH line', () => {
  const chunk = driveLabPanelLineToResLab('BH Hb 8.95* Hto 29.5* Leu 15.1*');
  assert.equal(chunk, 'BH\tHb 8.95* Hto 29.5* Leu 15.1*');
});

test('driveLabPanelLineToResLab infers panel without prefix', () => {
  const chunk = driveLabPanelLineToResLab('Glu 96 Cr 6.4* BUN 42');
  assert.equal(chunk, 'QS\tGlu 96 Cr 6.4* BUN 42');
});

test('parseDriveLaboratorios groups by date with aliases', () => {
  const { sets, warnings } = parseDriveLaboratorios(fixture, { documentYear: 2026 });
  assert.equal(warnings.length, 0);
  assert.equal(sets.length, 4);

  const feb6 = sets.find((s) => s.fecha === '02/06/2026');
  assert.ok(feb6);
  assert.equal(feb6.resLabs.length, 4);
  assert.ok(feb6.resLabs[0].startsWith('BH\t'));
  assert.ok(feb6.resLabs.some((c) => c.startsWith('PFHs\t')));

  const may25 = sets.find((s) => s.fecha === '25/05/2026');
  assert.ok(may25);
  assert.equal(may25.resLabs.length, 4);
  assert.ok(may25.resLabs[0].startsWith('BH\t'));
  assert.ok(may25.resLabs[1].startsWith('QS\t'));

  const may26 = sets.find((s) => s.fecha === '26/05/2026');
  assert.ok(may26);
  assert.ok(may26.resLabs.some((c) => c.startsWith('GASES\t')));
});

test('filterNewDriveLabSets skips duplicate fecha+lines', () => {
  const { sets } = parseDriveLaboratorios(
    '02/06\nBH Hb 8.95* Hto 29.5*\nQS Glu 77',
    { documentYear: 2026 },
  );
  const existing = [{ fecha: '02/06/2026', hora: '', resLabs: sets[0].resLabs }];
  const filtered = filterNewDriveLabSets(existing, sets);
  assert.equal(filtered.skipped, 1);
  assert.equal(filtered.sets.length, 0);
});

test('extractLaboratoriosBody from full document', () => {
  const body = extractLaboratoriosBody('HEADER\nLABORATORIOS\n02/06\nBH Hb 1\nEVENTUALIDADES\nfoo', '');
  assert.match(body, /02\/06/);
  assert.doesNotMatch(body, /EVENTUALIDADES/);
});
