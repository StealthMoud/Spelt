import { logSession } from '../../../shared/storage.js';

let currentSession = null;

export async function trackSession(q) {
  if (!currentSession || (Date.now() - currentSession.endTime > 10 * 60 * 1000)) {
    currentSession = {
      startTime: Date.now(),
      endTime: Date.now(),
      reviewCount: 0,
      correctCount: 0
    };
  }
  currentSession.reviewCount++;
  if (q >= 3) {
    currentSession.correctCount++;
  }
  currentSession.endTime = Date.now();
  try {
    await logSession(currentSession);
  } catch (err) {
    console.error('Error logging session:', err);
  }
}
