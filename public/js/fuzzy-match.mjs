/**
 * Minimal accent-insensitive fuzzy matcher for the ⌘K palette.
 * Greedy subsequence per whitespace token; word-start and consecutive hits
 * score higher; all tokens must match or the result is -Infinity.
 */
export function foldText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function tokenScore(token, text) {
  var t = foldText(token);
  var hay = foldText(text);
  if (!t) return 0;
  var score = 0;
  var prevHit = -2;
  var hi = 0;
  for (var ti = 0; ti < t.length; ti++) {
    var ch = t[ti];
    var found = -1;
    for (; hi < hay.length; hi++) {
      if (hay[hi] === ch) {
        found = hi;
        break;
      }
    }
    if (found === -1) return -Infinity;
    var prev = found === 0 ? ' ' : hay[found - 1];
    var atWordStart = prev === ' ' || prev === '-' || prev === '—' || prev === '·';
    if (found === prevHit + 1) score += 4;
    else if (atWordStart) score += 3;
    else score += 1;
    prevHit = found;
    hi = found + 1;
  }
  return score - hay.length * 0.01;
}

export function fuzzyScore(query, text) {
  var tokens = String(query || '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  var total = 0;
  for (var i = 0; i < tokens.length; i++) {
    var s = tokenScore(tokens[i], text);
    if (s === -Infinity) return -Infinity;
    total += s;
  }
  return total;
}

export function rankItems(query, items, getText) {
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var s = fuzzyScore(query, getText(items[i]));
    if (s !== -Infinity) out.push({ item: items[i], score: s });
  }
  out.sort(function (a, b) {
    return b.score - a.score;
  });
  return out;
}
