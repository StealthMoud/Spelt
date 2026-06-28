import { getLocalDateString } from '../../../shared/storage.js';
import { findBucketForDate } from './date_buckets.js';

export function calculateSummary(words, sandboxActivity, chartBuckets, sessions) {
  const hasSessions = Array.isArray(sessions) && sessions.some(s => s.startTime && s.endTime && s.endTime > s.startTime);
  
  chartBuckets.forEach(b => {
    b.created = 0; b.rtSum = 0; b.rtCount = 0; b.sandboxChecks = 0; b.sandboxCorrect = 0;
    b.studyTimeMs = 0;
  });

  let totalReviews = 0, correctReviews = 0;
  const buttonCounts = { again: 0, hard: 0, good: 0, easy: 0 };
  const reviewActivity = {};
  const studyTimeActivity = {};
  
  let globalRtSum = 0, globalRtCount = 0, globalRtMax = 0, globalRtMin = Infinity;
  let todayStudyTimeMs = 0;
  const todayDateStr = getLocalDateString();

  if (Array.isArray(sessions)) {
    sessions.forEach(s => {
      if (s.startTime && s.endTime && s.endTime > s.startTime) {
        const duration = s.endTime - s.startTime;
        const sDateStr = getLocalDateString(new Date(s.startTime));
        studyTimeActivity[sDateStr] = (studyTimeActivity[sDateStr] || 0) + duration;
        
        const matchingBucket = chartBuckets.find(b => 
          (b.type === 'day' && b.dateStr === sDateStr) ||
          (b.type === 'week' && s.startTime >= b.weekStart.getTime() && s.startTime <= b.weekEnd.getTime()) ||
          (b.type === 'month' && b.dateStr === `${new Date(s.startTime).getFullYear()}-${String(new Date(s.startTime).getMonth() + 1).padStart(2, '0')}`)
        );
        if (matchingBucket) matchingBucket.studyTimeMs += duration;
      }
    });
  }

  words.forEach(w => {
    if (w.createdAt) { const b = findBucketForDate(w.createdAt, chartBuckets); if (b) b.created++; }

    if (Array.isArray(w.history)) {
      w.history.forEach(h => {
        totalReviews++;
        const isCorrect = h.q >= 3;
        if (isCorrect) correctReviews++;

        if (h.date) {
          const hDateStr = (typeof h.date === 'string' && h.date.includes('-')) ? h.date : getLocalDateString(new Date(Number(h.date)));
          reviewActivity[hDateStr] = (reviewActivity[hDateStr] || 0) + 1;
          if (hDateStr === todayDateStr && h.rt) todayStudyTimeMs += h.rt;
          if (!studyTimeActivity[hDateStr] && h.rt && typeof h.rt === 'number') studyTimeActivity[hDateStr] = (studyTimeActivity[hDateStr] || 0) + h.rt;
        }

        if (h.q < 3) buttonCounts.again++; else if (h.q === 3) buttonCounts.hard++; else if (h.q === 4) buttonCounts.good++; else if (h.q === 5) buttonCounts.easy++;

        if (h.rt && typeof h.rt === 'number') {
          globalRtSum += h.rt; globalRtCount++;
          globalRtMax = Math.max(globalRtMax, h.rt); globalRtMin = Math.min(globalRtMin, h.rt);
          const bRt = findBucketForDate(h.date, chartBuckets); if (bRt) { bRt.rtSum += h.rt; bRt.rtCount++; }
        }

        if (h.date) {
          const rDate = new Date(h.date), rTime = rDate.getTime();
          const matchingBucket = chartBuckets.find(b => 
            (b.type === 'day' && b.dateStr === getLocalDateString(rDate)) ||
            (b.type === 'week' && rTime >= b.weekStart.getTime() && rTime <= b.weekEnd.getTime()) ||
            (b.type === 'month' && b.dateStr === `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`)
          );

          if (matchingBucket) {
            matchingBucket.total++;
            if (isCorrect) matchingBucket.correct++; else matchingBucket.incorrect++;
            if (!hasSessions && h.rt && typeof h.rt === 'number') matchingBucket.studyTimeMs += h.rt;
          }
        }
      });
    }
  });

  let globalSandboxChecks = 0, globalSandboxCorrect = 0, globalSandboxToday = 0;
  Object.entries(sandboxActivity).forEach(([dk, s]) => {
    globalSandboxChecks += s.checks || 0; globalSandboxCorrect += s.correct || 0;
    if (dk === todayDateStr) globalSandboxToday = s.checks || 0;
    const b = findBucketForDate(new Date(dk), chartBuckets); if (b) { b.sandboxChecks += s.checks || 0; b.sandboxCorrect += s.correct || 0; }
  });

  return {
    totalReviews, correctReviews, buttonCounts, reviewActivity, studyTimeActivity,
    globalRtSum, globalRtCount, globalRtMax, globalRtMin, todayStudyTimeMs,
    globalSandboxChecks, globalSandboxCorrect, globalSandboxToday
  };
}
