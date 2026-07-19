'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createWardHostRegistry } = require('./ward-host-registry.js');

function tempRegistry() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-host-reg-'));
  const filePath = path.join(dir, 'lan-ward-host-registry.json');
  return {
    dir,
    reg: createWardHostRegistry({ filePath }),
  };
}

test('recordUrl and merge dedupe URLs and prefixes', () => {
  const { dir, reg } = tempRegistry();
  try {
    reg.recordUrl('http://10.0.57.52:3738', { source: 'host' });
    reg.recordUrl('http://10.0.57.52:3738', { source: 'client' });
    reg.merge({
      hostUrls: [{ url: 'http://10.0.166.59:3738', source: 'host' }],
      prefixes: ['10.0.166', '10.0.57'],
    });
    const loaded = reg.load();
    const urls = loaded.hostUrls.map((e) => e.url);
    assert.strictEqual(new Set(urls).size, urls.length);
    assert.ok(urls.includes('http://10.0.57.52:3738'));
    assert.ok(urls.includes('http://10.0.166.59:3738'));
    assert.deepStrictEqual(new Set(loaded.prefixes), new Set(['10.0.166', '10.0.57']));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('prune drops stale URLs', () => {
  const { dir, reg } = tempRegistry();
  try {
    const stale = Date.now() - 8 * 24 * 60 * 60 * 1000;
    reg.save({
      version: 1,
      updatedAt: Date.now(),
      hostUrls: [
        {
          url: 'http://10.0.1.1:3738',
          prefix: '10.0.1',
          lastSeenAt: stale,
          lastOkAt: stale,
          source: 'host',
        },
        {
          url: 'http://10.0.2.2:3738',
          prefix: '10.0.2',
          lastSeenAt: Date.now(),
          lastOkAt: Date.now(),
          source: 'host',
        },
      ],
      prefixes: ['10.0.1', '10.0.2'],
    });
    reg.prune();
    const after = reg.load();
    assert.strictEqual(after.hostUrls.length, 1);
    assert.strictEqual(after.hostUrls[0].url, 'http://10.0.2.2:3738');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getHintsForExchange caps URLs and includes prefixes', () => {
  const { dir, reg } = tempRegistry();
  try {
    reg.recordUrl('http://10.0.57.52:3738', { source: 'host' });
    reg.recordPrefix('10.0.166');
    const hints = reg.getHintsForExchange();
    assert.ok(Array.isArray(hints.hostUrls));
    assert.ok(hints.hostUrls.length >= 1);
    assert.strictEqual(hints.hostUrls[0].url, 'http://10.0.57.52:3738');
    assert.ok(hints.prefixes.includes('10.0.166'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
