import { getSession, loginUser, registerUser, logoutUser, syncUserData, getSyncStats, loginWithGoogle, checkEmailExists, authenticateWithGoogle } from '../../shared/auth.js';
import { getWords } from '../../shared/storage.js';
import { updateSidebarUserDisplay } from './navigation.js';

let onAuthChangedCallback = null;
let authMode = 'login'; // 'login' or 'register'

export function initAuthPanel(onAuthChanged) {
  onAuthChangedCallback = onAuthChanged;
  document.getElementById('unified-auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value;
    if (authMode === 'login') handleAuthAction(() => loginUser(email, pass), 'Logging in...', 'Login successful!');
    else handleAuthAction(() => registerUser(email, pass), 'Creating cloud profile...', 'Profile created & backup synced!');
  });
  let checkTimeout = null;
  document.getElementById('auth-email').addEventListener('input', () => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(checkEmailState, 200);
  });
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('sync-now-btn').addEventListener('click', handleCloudSync);
  initGoogleAuthElements();
  if (new URLSearchParams(window.location.search).get('action') === 'google-login') {
    document.querySelector('.nav-item[data-target="auth-section"]')?.click();
    setTimeout(() => document.getElementById('google-login-btn')?.click(), 150);
  }
}

async function checkEmailState() {
  const email = document.getElementById('auth-email')?.value.trim() || '';
  const subtext = document.getElementById('auth-form-subtext');
  const btn = document.getElementById('auth-submit-btn');
  if (!btn) return;

  const valid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const exists = valid && await checkEmailExists(email);
  authMode = exists ? 'login' : 'register';

  if (!valid) {
    authMode = 'login';
    if (subtext) { subtext.textContent = 'Enter email and password to sync your progress.'; subtext.style.color = 'var(--text-muted)'; }
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span>Continue with Email</span>`;
  } else if (exists) {
    if (subtext) { subtext.textContent = 'Welcome back! Enter password to sign in.'; subtext.style.color = 'var(--primary-light)'; }
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg><span>Sign In & Sync</span>`;
  } else {
    if (subtext) { subtext.textContent = 'New email! Enter a password to create your profile.'; subtext.style.color = 'var(--success)'; }
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg><span>Register & Sync</span>`;
  }
}

function initGoogleAuthElements() {
  const googleLoginBtn = document.getElementById('google-login-btn');
  const googleModal = document.getElementById('google-auth-modal');
  const googleClose = document.getElementById('google-modal-close');
  const customEmailField = document.getElementById('custom-gmail-field');
  const customEmailSubmit = document.getElementById('custom-gmail-submit-btn');
  const profileContainer = document.getElementById('chrome-profile-container');
  const profileBtn = document.getElementById('chrome-profile-btn');
  const profileEmail = document.getElementById('chrome-profile-email');

  const openFallbackModal = async (noticeMsg = '') => {
    customEmailField.value = '';
    const noticeEl = document.getElementById('google-modal-notice');
    if (noticeEl) {
      noticeEl.textContent = noticeMsg;
      noticeEl.style.display = noticeMsg ? 'block' : 'none';
    }
    let activeEmail = '';
    if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getProfileUserInfo) {
      const info = await new Promise(resolve => chrome.identity.getProfileUserInfo(resolve));
      activeEmail = info?.email;
    }
    if (activeEmail) {
      if (profileContainer) profileContainer.style.display = 'flex';
      if (profileEmail) profileEmail.textContent = activeEmail;
      if (profileBtn) profileBtn.setAttribute('data-email', activeEmail);
    } else if (profileContainer) {
      profileContainer.style.display = 'none';
    }
    googleModal.classList.add('active');
  };

  googleLoginBtn.addEventListener('click', async () => {
    googleModal.classList.remove('active');
    showAuthFeedback('Connecting Google OAuth...', 'var(--primary-light)');
    try {
      await authenticateWithGoogle();
      showAuthFeedback('Authenticated successfully!', 'var(--success)');
      await refreshSessionUI();
    } catch (err) {
      console.warn('Google OAuth failed:', err.message);
      showAuthFeedback('', '');
      let msg = 'Google OAuth Client ID is not configured. Please use manual Gmail login below, or configure a client ID in settings.';
      if (!err.message.includes('Client ID')) {
        msg = `Google OAuth failed: ${err.message}. Using manual fallback.`;
      }
      await openFallbackModal(msg);
    }
  });

  googleClose.addEventListener('click', () => googleModal.classList.remove('active'));

  if (profileBtn) {
    profileBtn.addEventListener('click', async () => {
      const email = profileBtn.getAttribute('data-email');
      googleModal.classList.remove('active');
      await handleAuthAction(() => loginWithGoogle(email), 'Connecting Google OAuth...', 'Authenticated successfully!');
    });
  }

  customEmailSubmit.addEventListener('click', async () => {
    const email = customEmailField.value.trim();
    if (!email || !email.toLowerCase().endsWith('@gmail.com')) {
      alert('Please enter a valid Gmail address');
      return;
    }
    googleModal.classList.remove('active');
    await handleAuthAction(() => loginWithGoogle(email), 'Authorizing Gmail credentials...', 'Authenticated successfully!');
  });
}

async function handleLogout() {
  await logoutUser(); await refreshSessionUI();
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
    checkEmailState();
  }

  if (onAuthChangedCallback) onAuthChangedCallback();
}

function showAuthFeedback(msg, color) {
  const el = document.getElementById('auth-feedback-msg');
  if (el) { el.textContent = msg; el.style.color = color; }
}
