import { getStored, setStored } from './core.js';

// Get YYYY-MM-DD date string in local timezone
export function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Track study streaks and daily activity
export async function logActivity() {
  const activity = await getStored('spelt_activity') || {};
  const today = getLocalDateString();
  activity[today] = (activity[today] || 0) + 1;
  await setStored('spelt_activity', activity);
  await updateStreak(today);
}

// Recalculate streak based on days consecutive
export async function updateStreak(todayStr) {
  const streak = await getStored('spelt_streak') || { current: 0, lastDate: '', max: 0 };
  const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

  if (streak.lastDate === yesterday) {
    streak.current += 1;
  } else if (streak.lastDate !== todayStr) {
    streak.current = 1;
  }
  streak.lastDate = todayStr;
  
  if (!streak.max) {
    streak.max = streak.current;
  }
  if (streak.current > streak.max) {
    streak.max = streak.current;
  }
  
  await setStored('spelt_streak', streak);
}

// Export streak values for statistics
export async function getStreak() {
  return await getStored('spelt_streak') || { current: 0, lastDate: '', max: 0 };
}

// Export daily activity data for heatmap and analytics
export async function getActivity() {
  return await getStored('spelt_activity') || {};
}

// Log sandbox spelling-check activity for analytics
export async function logSandboxActivity(result) {
  const data = await getStored('spelt_sandbox_activity') || {};
  const today = getLocalDateString();
  if (!data[today]) data[today] = { checks: 0, correct: 0, misspelled: 0, notFound: 0 };
  data[today].checks++;
  if (result === 'correct') data[today].correct++;
  else if (result === 'misspelled') data[today].misspelled++;
  else if (result === 'not_found') data[today].notFound++;
  await setStored('spelt_sandbox_activity', data);
}

// Read sandbox activity data for stats
export async function getSandboxActivity() {
  return await getStored('spelt_sandbox_activity') || {};
}

// Read continuous study session history
export async function getSessions() {
  return await getStored('spelt_sessions') || [];
}

// Log or update continuous study session
export async function logSession(sessionData) {
  const sessions = await getSessions();
  const idx = sessions.findIndex(s => s.startTime === sessionData.startTime);
  if (idx !== -1) {
    sessions[idx] = sessionData;
  } else {
    sessions.push(sessionData);
  }
  
  // Cap at 200 sessions to avoid unbounded storage usage
  if (sessions.length > 200) {
    sessions.shift();
  }
  
  await setStored('spelt_sessions', sessions);
}
