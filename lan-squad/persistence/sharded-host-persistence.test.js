'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { hashTeamCode } = require('../team-code.js');
const {
  loadShardedState,
  migrateMonolithToShards,
  repairShardsOnBoot,
  isShardedLayout,
} = require('./sharded-host-persistence.js');
const { readMeta } = require('./json-meta-repository.js');
const { readRoomBundle } = require('./json-room-bundle-repository.js');

function fixtureMonolith(teamCodeHash) {
  return {
    version: 2,
    teamCodeHash,
    patients: [{ id: 'p1', nombre: 'Uno', version: 1 }],
    rooms: [
      { id: 'sala-1', displayName: 'Sala 1', version: 1 },
      { id: 'sala-2', displayName: 'Sala 2', version: 1 },
    ],
    roomSyncBundles: {
      'sala-1': {
        revision: 3,
        entityVersions: {},
        entities: {},
        agenda: [],
        todos: {},
        entries: [{ patient: { id: 'p1' }, note: { texto: 'a' } }],
      },
      'sala-2': {
        revision: 7,
        entityVersions: {},
        entities: {},
        agenda: [],
        todos: {},
        entries: [],
      },
    },
  };
}

describe('sharded-host-persistence', () => {
  let dir;
  let monolithPath;
  let hostStateDir;
  let teamCodeHash;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-shard-'));
    monolithPath = path.join(dir, 'lan-squad-host-state.json');
    hostStateDir = path.join(dir, 'lan-host');
    teamCodeHash = hashTeamCode('test-team');
  });

  it('monolith migration round-trip preserves two room bundles', async () => {
    const original = fixtureMonolith(teamCodeHash);
    fs.writeFileSync(monolithPath, JSON.stringify(original), 'utf8');

    await migrateMonolithToShards({ monolithPath, hostStateDir, teamCodeHash });
    assert.ok(isShardedLayout(hostStateDir));
    assert.ok(!fs.existsSync(monolithPath));
    assert.ok(fs.existsSync(`${monolithPath}.pre-shard-backup`));
    assert.ok(fs.existsSync(`${monolithPath}.migrated`));

    const loaded = await loadShardedState(hostStateDir, teamCodeHash);
    assert.deepStrictEqual(loaded.patients, original.patients);
    assert.deepStrictEqual(loaded.rooms, original.rooms);
    assert.deepStrictEqual(loaded.roomSyncBundles['sala-1'], original.roomSyncBundles['sala-1']);
    assert.deepStrictEqual(loaded.roomSyncBundles['sala-2'], original.roomSyncBundles['sala-2']);

    const meta = await readMeta(hostStateDir);
    assert.strictEqual(meta.roomRevisions['sala-1'], 3);
    assert.strictEqual(meta.roomRevisions['sala-2'], 7);
    assert.strictEqual(meta.shardedFrom, 'monolith');
  });

  it('repairShardsOnBoot adopts bundle revision ahead of meta', async () => {
    const original = fixtureMonolith(teamCodeHash);
    fs.writeFileSync(monolithPath, JSON.stringify(original), 'utf8');
    await migrateMonolithToShards({ monolithPath, hostStateDir, teamCodeHash });

    const meta = await readMeta(hostStateDir);
    meta.roomRevisions['sala-1'] = 3;
    fs.writeFileSync(
      path.join(hostStateDir, 'meta.json'),
      JSON.stringify(meta),
      'utf8'
    );

    const bundle = await readRoomBundle(hostStateDir, 'sala-1');
    bundle.revision = 5;
    fs.writeFileSync(
      path.join(hostStateDir, 'bundles', 'sala-1.json'),
      JSON.stringify(bundle),
      'utf8'
    );

    const cache = await loadShardedState(hostStateDir, teamCodeHash);
    cache.roomSyncBundles['sala-1'].revision = 5;

    const { repairedRooms } = await repairShardsOnBoot(hostStateDir, cache);
    assert.ok(repairedRooms.includes('sala-1'));

    const repairedMeta = await readMeta(hostStateDir);
    assert.strictEqual(repairedMeta.roomRevisions['sala-1'], 5);
    assert.ok(repairedMeta.lastRepairAt);
  });

  it('pre-flight aborts on invalid monolith without creating lan-host dir', async () => {
    fs.writeFileSync(monolithPath, '{ not valid json', 'utf8');

    await assert.rejects(
      () => migrateMonolithToShards({ monolithPath, hostStateDir, teamCodeHash }),
      /invalid JSON/
    );
    assert.ok(!fs.existsSync(hostStateDir));
    assert.ok(fs.existsSync(monolithPath));
  });
});
