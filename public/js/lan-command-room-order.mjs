export function shouldApplyCommandBroadcast(state, msg) {
  const lastAppliedSeq = Number(state && state.lastAppliedSeq || 0);
  const seq = Number(msg && msg.deltaSeq || 0);
  if (!seq || seq <= lastAppliedSeq) return { action: 'ignore' };
  if (seq > lastAppliedSeq + 1) return { action: 'catch_up', afterSeq: lastAppliedSeq };
  return { action: 'apply' };
}

export function updateCommandSeqState(state, msg) {
  return {
    ...(state || {}),
    lastAppliedSeq: Number(msg && msg.deltaSeq || state && state.lastAppliedSeq || 0),
    lastAckedCommandId: String(msg && msg.commandId || state && state.lastAckedCommandId || ''),
  };
}
