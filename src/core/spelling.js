export function getLevenshtein(a, b) {
  const r = Array(b.length + 1).fill(0).map((_, i) => [i]);
  for (let j = 0; j <= a.length; j++) r[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      r[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? r[i - 1][j - 1]
        : Math.min(r[i - 1][j - 1] + 1, r[i][j - 1] + 1, r[i - 1][j] + 1);
    }
  }
  return r[b.length][a.length];
}

export function isValidSuggestion(query, candidate, d) {
  const qLower = query.toLowerCase();
  const cLower = candidate.toLowerCase();
  if (qLower[0] !== cLower[0]) {
    if (qLower.length <= 5 || cLower.length <= 5) return d < 2;
  }
  return true;
}
