import { getSession, logoutUser, syncUserData, getSyncStats, loginWithEmail } from '../../shared/auth.js';
import { getWords } from '../../shared/storage.js';
import { updateSidebarUserDisplay } from './navigation.js';

let onAuthChangedCallback = null;

export function initAuthPanel(onAuthChanged) {
  onAuthChangedCallback = onAuthChanged;
  document.getElementById('unified-auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    if (email) {
      handleAuthAction(() => loginWithEmail(email), 'Connecting profile...', 'Profile connected successfully!');
    }
  });
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('sync-now-btn').addEventListener('click', handleCloudSync);

  if (new URLSearchParams(window.location.search).get('action') === 'sync') {
    document.querySelector('.nav-item[data-target="auth-section"]')?.click();
  }
}

async function handleLogout() {
  await logoutUser();
  await refreshSessionUI();
  showAuthFeedback('Logged out of cloud session', 'var(--text-muted)');
}

async function handleAuthAction(authPromiseFn, loadingText, successText) {
  try {
    showAuthFeedback(loadingText, 'var(--primary-light)');
    await authPromiseFn();
    showAuthFeedback(successText, 'var(--success)');
    await refreshSessionUI();
  } catch (err) {
    showAuthFeedback(err.message || 'Authentication error', 'var(--danger)');
  }
}

async function handleCloudSync() {
  const syncBtn = document.getElementById('sync-now-btn');
  try {
    syncBtn.disabled = true;
    showAuthFeedback('Uploading vault and analysis data...', 'var(--primary-light)');
    const result = await syncUserData(await getWords());
    if (result.success) {
      showAuthFeedback(`Sync finished! Saved ${result.itemCount} items.`, 'var(--success)');
      await refreshSessionUI();
    }
  } catch (err) {
    showAuthFeedback(err.message || 'Sync failed', 'var(--danger)');
  } finally {
    syncBtn.disabled = false;
  }
}

export async function refreshSessionUI() {
  const session = await getSession();
  updateSidebarUserDisplay(session);

  const activePanel = document.getElementById('sync-panel-active');
  const formsPanel = document.getElementById('auth-panel-forms');

  if (session) {
    activePanel.style.display = 'block';
    formsPanel.style.display = 'none';
    document.getElementById('sync-user-email').textContent = session.email;
    const stats = await getSyncStats();
    const syncTimeStr = stats?.syncDate ? new Date(stats.syncDate).toLocaleString() : 'Never';
    document.getElementById('sync-last-date').textContent = `Last synchronized: ${syncTimeStr}`;
  } else {
    activePanel.style.display = 'none';
    formsPanel.style.display = 'flex';
  }

  if (onAuthChangedCallback) onAuthChangedCallback();
}

function showAuthFeedback(msg, color) {
  const el = document.getElementById('auth-feedback-msg');
  if (el) { el.textContent = msg; el.style.color = color; }
}
