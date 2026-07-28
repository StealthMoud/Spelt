/**
 * Computes a deterministic 14-value fingerprint hash for stats caching.
 */
export function buildStatsHash({
  wordsCount = 0,
  newCount = 0,
  learningCount = 0,
  matureCount = 0,
  masteredCount = 0,
  totalReviews = 0,
  retentionRate = 0,
  currentStreak = 0,
  maxStreak = 0,
  leechesStr = '',
  sandboxChecks = 0,
  avgResponseTime = 0,
  totalSessions = 0,
  studyTimeMin = 0
} = {}) {
  return `${wordsCount}-${newCount}-${learningCount}-${matureCount}-${masteredCount}-${totalReviews}-${retentionRate}-${currentStreak}-${maxStreak}-${leechesStr}-${sandboxChecks}-${avgResponseTime}-${totalSessions}-${studyTimeMin}`;
}
