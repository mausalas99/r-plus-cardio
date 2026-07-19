/** Build LAN sync diagnostics payload fields (extracted for complexity budget). */

/** @param {Record<string, unknown>} d */
export function resolveClinicalOpsTraceSource(d) {
  if (Array.isArray(d.clinicalOpsTrace) && d.clinicalOpsTrace.length) {
    return d.clinicalOpsTrace;
  }
  return null;
}

/** @param {Record<string, unknown>} d */
function buildLanSyncConnectionFields(d) {
  return {
    hostUrl: String(d.hostUrl || ''),
    pingAt: d.pingAt != null ? d.pingAt : null,
    pingStatus: d.pingStatus != null ? d.pingStatus : null,
    wsSync: !!d.wsSync,
    wsLive: !!d.wsLive,
    liveRoomId: String(d.liveRoomId || ''),
    roomId: String(d.roomId || ''),
    phase: String(d.phase || 'offline'),
  };
}

/** @param {Record<string, unknown>} d */
function buildLanSyncTransportFields(d) {
  return {
    bundleRevision: Number(d.bundleRevision || 0),
    outboxCount: Number(d.outboxCount || 0),
    pinnedHost: String(d.pinnedHost || ''),
    teamCodeAligned: d.teamCodeAligned == null ? null : !!d.teamCodeAligned,
    peerHostCount: Number(d.peerHostCount || 0),
    networkProfile: String(d.networkProfile || ''),
    transport: String(d.transport || ''),
    rttMs: Number(d.rttMs || 0),
    registryHostCount: Number(d.registryHostCount || 0),
    wardHostRegistry:
      d.wardHostRegistry && typeof d.wardHostRegistry === 'object'
        ? { ...d.wardHostRegistry }
        : null,
    role: String(d.role || ''),
  };
}

/** @param {Record<string, unknown>} d */
export function buildLanSyncDiagnosticsCore(d) {
  return {
    ...buildLanSyncConnectionFields(d),
    ...buildLanSyncTransportFields(d),
  };
}
