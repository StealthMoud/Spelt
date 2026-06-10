import { initNavigation, setDueReviewsBadge, updateSidebarUserDisplay } from './js/navigation.js';
import { initPractice, loadDeck } from './js/practice.js';
import { initVault, reloadVault } from './js/vault.js';
import { reloadAnalytics } from './js/analytics.js';
import { initSettings } from './js/settings.js';
import { getSession, loginUser, registerUser, logoutUser, syncUserData, getSyncStats, loginWithGoogle } from '../shared/auth.js';
import { getWords } from '../shared/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Bind views
  await initNavigation(handleViewChange);
  await initPractice(handleDeckUpdated);
  await initVault(handleVaultUpdated);
  initSettings(handleDbRestored);

  // Bind auth panels
  initAuthPanel();

  // Load initial displays
  await handleDbRestored();
});

// Refresh all sections when db is wiped or JSON imported
async function handleDbRestored() {
  await loadDeck();
  await reloadVault();
  await reloadAnalytics();
  await refreshSessionUI();
}

// Reload tab contents when user clicks sidebar nav
async function handleViewChange(viewId) {
  if (viewId === 'practice-section') {
    await loadDeck();
  } else if (viewId === 'vault-section') {
    await reloadVault();
  } else if (viewId === 'analytics-section') {
    await reloadAnalytics();
  } else if (viewId === 'auth-section') {
    await refreshSessionUI();
  }
}

// Sync counts to sidebar review badge
function handleDeckUpdated(dueCount) {
  setDueReviewsBadge(dueCount);
}

// Re-cache review decks when changes occur in vault
async function handleVaultUpdated() {
  await loadDeck();
  await reloadAnalytics();
}

// Bound login / register logic
function initAuthPanel() {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const logoutBtn = document.getElementById('logout-btn');
  const syncBtn = document.getElementById('sync-now-btn');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleAuthAction(async () => {
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      return await loginUser(email, pass);
    }, 'Logging in...', 'Login successful!');
  });

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleAuthAction(async () => {
      const email = document.getElementById('register-email').value;
      const pass = document.getElementById('register-password').value;
      return await registerUser(email, pass);
    }, 'Creating account...', 'Account registered & backup configured!');
  });

  logoutBtn.addEventListener('click', async () => {
    await logoutUser();
    await refreshSessionUI();
    showAuthFeedback('Logged out of cloud session', 'var(--text-muted)');
  });

  syncBtn.addEventListener('click', handleCloudSync);

  // Bind Google OAuth selector modal triggers
  const googleLoginBtn = document.getElementById('google-login-btn');
  const googleRegBtn = document.getElementById('google-register-btn');
  const googleModal = document.getElementById('google-auth-modal');
  const googleClose = document.getElementById('google-modal-close');
  const googleAccs = document.querySelectorAll('.google-account-row[data-email]');
  const customAccTrigger = document.getElementById('google-use-different-acc');
  const customInputContainer = document.getElementById('custom-gmail-input-container');
  const customEmailField = document.getElementById('custom-gmail-field');
  const customEmailSubmit = document.getElementById('custom-gmail-submit-btn');

  const openGoogleModal = () => {
    customInputContainer.style.display = 'none';
    customEmailField.value = '';
    googleModal.classList.add('active');
  };

  googleLoginBtn.addEventListener('click', openGoogleModal);
  googleRegBtn.addEventListener('click', openGoogleModal);
  googleClose.addEventListener('click', () => googleModal.classList.remove('active'));

  // Trigger login on choosing mock account row
  googleAccs.forEach(row => {
    row.addEventListener('click', async () => {
      const email = row.getAttribute('data-email');
      googleModal.classList.remove('active');
      await handleAuthAction(async () => {
        return await loginWithGoogle(email);
      }, 'Redirecting to Google account picker...', 'Authenticated with Google account!');
    });
  });

  // Toggle custom gmail field
  customAccTrigger.addEventListener('click', () => {
    customInputContainer.style.display = 'block';
    customEmailField.focus();
  });

  // Submit custom gmail field
  customEmailSubmit.addEventListener('click', async () => {
    const email = customEmailField.value.trim();
    if (!email.toLowerCase().endsWith('@gmail.com') && !email.toLowerCase().endsWith('@googlemail.com')) {
      alert('Please enter a valid Gmail address (e.g. user@gmail.com)');
      return;
    }
    googleModal.classList.remove('active');
    await handleAuthAction(async () => {
      return await loginWithGoogle(email);
    }, 'Authorizing Google credentials...', 'Authenticated with Google account!');
  });
}

// Execute login / signup actions with loader feedback
async function handleAuthAction(authPromiseFn, loadingText, successText) {
  const feedback = document.getElementById('auth-feedback-msg');
  try {
    feedback.textContent = loadingText;
    feedback.style.color = 'var(--primary-light)';
    
    await authPromiseFn();
    
    feedback.textContent = successText;
    feedback.style.color = 'var(--success)';
    await refreshSessionUI();
  } catch (err) {
    feedback.textContent = err.message || 'Authentication error';
    feedback.style.color = 'var(--danger)';
  }
}

// Simulated data sync
async function handleCloudSync() {
  const feedback = document.getElementById('auth-feedback-msg');
  const syncBtn = document.getElementById('sync-now-btn');

  try {
    syncBtn.disabled = true;
    feedback.textContent = 'Uploading vault and analysis data...';
    feedback.style.color = 'var(--primary-light)';

    const words = await getWords();
    const result = await syncUserData(words);

    if (result.success) {
      feedback.textContent = `Sync finished! Saved ${result.itemCount} items.`;
      feedback.style.color = 'var(--success)';
      await refreshSessionUI();
    }
  } catch (err) {
    feedback.textContent = err.message || 'Sync failed';
    feedback.style.color = 'var(--danger)';
  } finally {
    syncBtn.disabled = false;
  }
}

// Refresh auth panels based on session state
async function refreshSessionUI() {
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
}

function showAuthFeedback(msg, color) {
  const el = document.getElementById('auth-feedback-msg');
  el.textContent = msg;
  el.style.color = color;
}
