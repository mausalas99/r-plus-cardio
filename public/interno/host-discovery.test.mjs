import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLoopbackHostname,
  isPrivateIpv4,
  subnetPrefixFromIpv4,
  orderedSubnetHosts,
  normalizeHostOverride,
} from './host-discovery.mjs';

test('isLoopbackHostname', () => {
  assert.equal(isLoopbackHostname('127.0.0.1'), true);
  assert.equal(isLoopbackHostname('localhost'), true);
  assert.equal(isLoopbackHostname('192.168.1.5'), false);
});

test('isPrivateIpv4', () => {
  assert.equal(isPrivateIpv4('192.168.0.10'), true);
  assert.equal(isPrivateIpv4('10.0.0.1'), true);
  assert.equal(isPrivateIpv4('172.16.5.1'), true);
  assert.equal(isPrivateIpv4('8.8.8.8'), false);
});

test('subnetPrefixFromIpv4', () => {
  assert.equal(subnetPrefixFromIpv4('192.168.1.44'), '192.168.1');
  assert.equal(subnetPrefixFromIpv4('bad'), '');
});

test('orderedSubnetHosts prioritizes common DHCP range', () => {
  const hosts = orderedSubnetHosts('192.168.1', '192.168.1.44');
  assert.equal(hosts[0], '192.168.1.1');
  assert.ok(hosts.indexOf('192.168.1.100') < hosts.indexOf('192.168.1.220'));
  assert.ok(!hosts.includes('192.168.1.44'));
  assert.equal(hosts.length, 253);
});

test('normalizeHostOverride adds http scheme', () => {
  assert.equal(normalizeHostOverride('192.168.1.5:3738'), 'http://192.168.1.5:3738');
  assert.equal(normalizeHostOverride('http://192.168.1.5:3738'), 'http://192.168.1.5:3738');
});
