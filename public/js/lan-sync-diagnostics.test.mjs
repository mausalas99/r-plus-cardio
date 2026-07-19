import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordLanSyncError,
  recordClinicalOpsTrace,
  clearClinicalOpsTrace,
  getClinicalOpsTrace,
  getLanSyncDiagnostics,
  formatDiagnosticsReport,
  redactLanSecrets,
  buildCommandSyncDiagnostics,
} from './lan-sync-diagnostics.mjs';

describe('lan-sync-diagnostics', () => {
  it('getLanSyncDiagnostics returns plain object without secrets in fields', () => {
    const diag = getLanSyncDiagnostics({
      hostUrl: 'http://10.0.0.1:3738',
      pingAt: '2026-06-03T12:00:00.000Z',
      pingStatus: 200,
      wsSync: true,
      wsLive: false,
      roomId: 'sala-1',
      phase: 'live',
      bundleRevision: 3,
      outboxCount: 2,
      pinnedHost: 'http://10.0.0.1:3738',
      teamCodeAligned: true,
    });
    assert.equal(diag.hostUrl, 'http://10.0.0.1:3738');
    assert.equal(diag.phase, 'live');
    assert.equal(diag.outboxCount, 2);
    assert.ok(Array.isArray(diag.lastErrors));
    const withNet = getLanSyncDiagnostics({
      phase: 'live',
      networkProfile: 'fast',
      transport: 'ws',
      rttMs: 42,
      registryHostCount: 2,
      role: 'host',
    });
    assert.equal(withNet.networkProfile, 'fast');
    assert.equal(withNet.transport, 'ws');
    assert.equal(withNet.rttMs, 42);
    assert.equal(withNet.registryHostCount, 2);
    assert.equal(withNet.role, 'host');
  });

  it('recordLanSyncError keeps at most 5 entries', () => {
    for (let i = 0; i < 7; i += 1) {
      recordLanSyncError({ op: 'ping', code: 'ERR', message: 'm' + i });
    }
    const diag = getLanSyncDiagnostics();
    assert.equal(diag.lastErrors.length, 5);
    assert.equal(diag.lastErrors[0].message, 'm6');
    assert.equal(diag.lastErrors[4].message, 'm2');
  });

  it('recordClinicalOpsTrace appears in diagnostics report', () => {
    clearClinicalOpsTrace();
    recordClinicalOpsTrace('export', { usersExported: 3, teamMembership: 5 });
    recordClinicalOpsTrace('merge', { ok: true, incomingUsers: 2 });
    assert.equal(getClinicalOpsTrace().length, 2);
    const diag = getLanSyncDiagnostics({ phase: 'live' });
    assert.equal(diag.clinicalOpsTrace.length, 2);
    assert.equal(diag.clinicalOpsTrace[0].boundary, 'merge');
    const raw = formatDiagnosticsReport(diag);
    assert.match(raw, /clinicalOpsTrace/);
    assert.match(raw, /usersExported/);
  });

  it('formatDiagnosticsReport redacts Bearer and teamCode', () => {
    recordLanSyncError({
      op: 'fetch',
      code: '401',
      message: 'Bearer abc123secret token failed',
    });
    const raw = formatDiagnosticsReport(
      getLanSyncDiagnostics({
        hostUrl: 'http://192.168.1.5:3738',
        teamCode: 'should-not-appear',
      })
    );
    assert.ok(!raw.includes('abc123secret'));
    assert.ok(raw.includes('Bearer ***') || !/Bearer\s+[A-Za-z0-9]/i.test(raw));
    const redacted = redactLanSecrets(
      '{"teamCode":"super-secret-32chars-minimum-here","Authorization":"Bearer xyz"}'
    );
    assert.ok(!redacted.includes('super-secret'));
    assert.match(redacted, /teamCode.*\*\*\*/);
    assert.match(redacted, /Bearer \*\*\*/);
  });

  it('buildCommandSyncDiagnostics returns defaults for empty input', () => {
    const out = buildCommandSyncDiagnostics();
    assert.equal(out.commandQueueDepth, 0);
    assert.equal(out.lastAppliedSeq, 0);
    assert.deepEqual(out.schedulerPendingRooms, []);
    assert.equal(out.lastAckedCommandId, '');
    assert.equal(out.replayGapCount, 0);
  });
});
