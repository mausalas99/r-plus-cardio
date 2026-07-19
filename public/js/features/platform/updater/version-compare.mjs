/** Semantic version comparison. */

function compareSemver(a, b) {
  function parse(v) {
    var m = String(v == null ? '' : v).trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-.+].*)?$/);
    if (!m) return null;
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  }
  var pa = parse(a); var pb = parse(b);
  if (!pa || !pb) return 0;
  for (var i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

export { compareSemver };
