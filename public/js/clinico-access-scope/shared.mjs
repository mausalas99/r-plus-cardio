/**
 * allow/deny constructors shared by evaluateClinicalScope evaluators.
 * @param {object|null|undefined} currentUser
 * @param {object|null|undefined} targetPatient
 * @param {Date} now
 */
export function makeAllowDeny(currentUser, targetPatient, now) {
  const deny = (reasoning, extra = {}) => ({
    readable: false,
    writable: false,
    reasoning,
    audit: { userId: currentUser?.user_id, rank: currentUser?.rank, patientId: targetPatient?.id, timestamp: now.toISOString() },
    ...extra,
  });

  const allow = (reasoning, readable = true, writable = true, extra = {}) => ({
    readable,
    writable,
    reasoning,
    audit: { userId: currentUser?.user_id, rank: currentUser?.rank, patientId: targetPatient?.id, timestamp: now.toISOString() },
    ...extra,
  });

  return { allow, deny };
}
