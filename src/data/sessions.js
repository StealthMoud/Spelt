import { getStored, setStored } from './storage.js';
import { previousDay } from '../core/learning.js';

// Get YYYY-MM-DD date string in local timezone
export function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Track study streaks and daily activity
// Note: activity[today] tracks total review interactions for that date (read by heatmap as review count),
// while updateStreak updates the daily streak on the first interaction of each consecutive calendar day.
export async function logActivity() {
  const activity = await getStored('spelt_activity') || {};
  const today = getLocalDateString();
  activity[today] = (activity[today] || 0) + 1;
  await setStored('spelt_activity', activity);
  await updateStreak(today);
}

// Recalculate streak based on consecutive days logged
export async function updateStreak(todayStr) {
  const streak = await getStored('spelt_streak') || { current: 0, lastDate: '', max: 0 };
  const yesterday = previousDay();

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

export async function getStreak() {
  return await getStored('spelt_streak') || { current: 0, lastDate: '', max: 0 };
}

export async function getActivity() {
  return await getStored('spelt_activity') || {};
}

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

export async function getSandboxActivity() {
  return await getStored('spelt_sandbox_activity') || {};
}

export async function getSessions() {
  return await getStored('spelt_sessions') || [];
}

export async function logSession(sessionData) {
  const sessions = await getSessions();
  const idx = sessions.findIndex(s => s.startTime === sessionData.startTime);
  if (idx !== -1) {
    sessions[idx] = sessionData;
  } else {
    sessions.push(sessionData);
  }
  
  if (sessions.length > 200) {
    sessions.shift();
  }
  
  await setStored('spelt_sessions', sessions);
}
