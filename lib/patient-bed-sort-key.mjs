/** Bed label parsing for patientBedSortKey (extracted for complexity budget). */

export function parseBedLabelSortKey(bedLabel) {
  if (!bedLabel || bedLabel === '—') return null;
  const nums = bedLabel.match(/\d+/g);
  if (!nums?.length) return null;
  const n0 = parseInt(nums[0], 10);
  const n1 = nums.length > 1 ? parseInt(nums[1], 10) : 0;
  if (!Number.isFinite(n0)) return null;
  return n0 * 1000 + (Number.isFinite(n1) ? n1 : 0);
}

export function parseRoomBedSortKey(cuarto, cama) {
  const room = parseInt(String(cuarto || '').replace(/\D/g, ''), 10);
  if (!Number.isFinite(room)) return null;
  const bed = parseInt(String(cama || '').replace(/\D/g, ''), 10);
  return room * 1000 + (Number.isFinite(bed) ? bed : 0);
}
