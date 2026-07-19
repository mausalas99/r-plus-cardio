const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allReleaseArtifactNames, expandArtifactPattern } = require('./artifact-names');

const pkg = {
  name: 'r-plus',
  version: '3.4.3',
  build: {
    productName: 'R+',
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
};

test('expande R+- con productName', () => {
  const p = pkg.build.artifactName;
  assert.equal(expandArtifactPattern(p, '3.4.3', 'arm64', 'zip', pkg), 'R+-3.4.3-arm64.zip');
  assert.equal(expandArtifactPattern(p, '3.4.3', 'x64', 'exe', pkg), 'R+-3.4.3-x64.exe');
});

test('allReleaseArtifactNames incluye mac y win', () => {
  const a = allReleaseArtifactNames(pkg);
  assert.ok(a.mac.includes('R+-3.4.3-arm64.dmg'));
  assert.equal(a.win, 'R+-3.4.3-x64.exe');
});
