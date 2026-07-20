import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedExternalUrl } from './window-open-policy.cjs';

test('isAllowedExternalUrl allows GitHub and LAN hosts', () => {
  assert.equal(isAllowedExternalUrl('https://github.com/mausalas99/r-plus-cardio/releases'), true);
  assert.equal(isAllowedExternalUrl('HTTPS://GitHub.com'), true);
  assert.equal(isAllowedExternalUrl('https://objects.githubusercontent.com/pkg/pkg.zip'), true);
  assert.equal(isAllowedExternalUrl('http://10.0.0.1:3738/join'), true);
  assert.equal(isAllowedExternalUrl('http://192.168.1.20:3738/mobile/?token=x'), true);
  assert.equal(isAllowedExternalUrl('http://172.20.0.5:3738'), true);
  assert.equal(isAllowedExternalUrl('http://rplus-host.local:3738'), true);
});

test('isAllowedExternalUrl rejects arbitrary external hosts', () => {
  assert.equal(isAllowedExternalUrl('https://example.com/path'), false);
  assert.equal(isAllowedExternalUrl('http://172.32.0.1'), false);
  assert.equal(isAllowedExternalUrl('https://evil.github.com.attacker.io'), false);
  assert.equal(isAllowedExternalUrl('file:///etc/passwd'), false);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedExternalUrl('sesion-ingreso://import'), false);
  assert.equal(isAllowedExternalUrl(''), false);
  assert.equal(isAllowedExternalUrl(null), false);
});
