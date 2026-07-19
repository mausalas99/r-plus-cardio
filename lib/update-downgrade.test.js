const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  GITHUB_RELEASES_BASE,
  parseSemverCore,
  compareSemverCore,
  isValidDowngradeTargetVersion,
  buildGenericFeedUrl,
  buildManualInstallerUrl,
  filterDowngradeCandidates,
  pickMacArch,
} = require('./update-downgrade.js');

test('parseSemverCore acepta X.Y.Z', () => {
  assert.deepEqual(parseSemverCore('6.5.4'), [6, 5, 4]);
  assert.deepEqual(parseSemverCore('v6.5.4'), [6, 5, 4]);
  assert.equal(parseSemverCore('6.5'), null);
});

test('compareSemverCore ordena correctamente', () => {
  assert.equal(compareSemverCore('6.5.3', '6.5.4'), -1);
  assert.equal(compareSemverCore('6.5.4', '6.5.4'), 0);
  assert.equal(compareSemverCore('6.6.0', '6.5.4'), 1);
});

test('isValidDowngradeTargetVersion rechaza actual o superior', () => {
  assert.equal(isValidDowngradeTargetVersion('6.5.3', '6.5.4'), true);
  assert.equal(isValidDowngradeTargetVersion('6.5.4', '6.5.4'), false);
  assert.equal(isValidDowngradeTargetVersion('6.5.5', '6.5.4'), false);
});

test('buildGenericFeedUrl apunta al tag de release', () => {
  assert.equal(
    buildGenericFeedUrl('6.5.3'),
    `${GITHUB_RELEASES_BASE}/v6.5.3/`
  );
});

test('buildManualInstallerUrl elige artefacto por plataforma', () => {
  assert.match(
    buildManualInstallerUrl('6.5.3', 'darwin', 'arm64'),
    /R\+-6\.5\.3-arm64\.dmg$/
  );
  assert.match(
    buildManualInstallerUrl('6.5.3', 'darwin', 'x64'),
    /R\+-6\.5\.3-x64\.dmg$/
  );
  assert.match(
    buildManualInstallerUrl('6.5.3', 'win32', 'x64'),
    /R\+-6\.5\.3-x64\.exe$/
  );
});

test('filterDowngradeCandidates solo menores que actual', () => {
  const entries = [
    { version: '6.5.4' },
    { version: '6.5.3', recommended: true },
    { version: '6.5.2' },
    { version: 'bad' },
  ];
  const out = filterDowngradeCandidates(entries, '6.5.4');
  assert.deepEqual(out.map((e) => e.version), ['6.5.3', '6.5.2']);
  assert.equal(out[0].recommended, true);
});

test('pickMacArch usa process.arch en main', () => {
  assert.equal(pickMacArch('arm64'), 'arm64');
  assert.equal(pickMacArch('x64'), 'x64');
  assert.equal(pickMacArch('ia32'), 'x64');
});
