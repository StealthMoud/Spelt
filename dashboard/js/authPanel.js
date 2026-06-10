import { getSession, loginUser, registerUser, logoutUser, syncUserData, getSyncStats, loginWithGoogle, checkEmailExists } from '../../shared/auth.js';
import { getWords } from '../../shared/storage.js';
import { updateSidebarUserDisplay } from './navigation.js';

let onAuthChangedCallback = null;
let authMode = 'login'; // 'login' or 'register'

export function initAuthPanel(onAuthChanged) {
  onAuthChangedCallback = onAuthChanged;

  const authForm = document.getElementById('unified-auth-form');
  const logoutBtn = document.getElementById('logout-btn');
  const syncBtn = document.getElementById('sync-now-btn');
  const emailInput = document.getElementById('auth-email');

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const pass = document.getElementById('auth-password').value;

    if (authMode === 'login') {
      handleAuthAction(() => loginUser(email, pass), 'Logging in...', 'Login successful!');
    } else {
      handleAuthAction(() => registerUser(email, pass), 'Creating cloud profile...', 'Profile created & backup synced!');
    }
  });

  let checkTimeout = null;
  emailInput.addEventListener('input', () => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(checkEmailState, 200);
  });

  logoutBtn.addEventListener('click', handleLogout);
  syncBtn.addEventListener('click', handleCloudSync);

  initGoogleAuthElements();

  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'google-login') {
    const navItem = document.querySelector('.nav-item[data-target="auth-section"]');
    if (navItem) navItem.click();
    setTimeout(() => {
      const googleBtn = document.getElementById('google-login-btn');
      if (googleBtn) googleBtn.click();
    }, 150);
  }
}

async function checkEmailState() {
  const emailInput = document.getElementById('auth-email');
  const email = emailInput?.value.trim() || '';
  const subtext = document.getElementById('auth-form-subtext');
  const btn = document.getElementById('auth-submit-btn');
  if (!btn) return;

  const valid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const exists = valid && await checkEmailExists(email);
  authMode = exists ? 'login' : 'register';

  if (!valid) {
    authMode = 'login';
    if (subtext) { subtext.textContent = 'Enter email and password to sync your progress.'; subtext.style.color = 'var(--text-muted)'; }
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span id="auth-btn-text">Continue with Email</span>`;
  } else if (exists) {
    if (subtext) { subtext.textContent = 'Welcome back! Enter password to sign in.'; subtext.style.color = 'var(--primary-light)'; }
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg><span id="auth-btn-text">Sign In & Sync</span>`;
  } else {
    if (subtext) { subtext.textContent = 'New email! Enter a password to create your profile.'; subtext.style.color = 'var(--success)'; }
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg><span id="auth-btn-text">Register & Sync</span>`;
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

  const openGoogleModal = async () => {
    customEmailField.value = '';
    let activeEmail = '';
    
    if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getProfileUserInfo) {
      const info = await new Promise(resolve => chrome.identity.getProfileUserInfo(resolve));
      activeEmail = info?.email;
    }

    if (activeEmail) {
      if (profileContainer) profileContainer.style.display = 'flex';
      if (profileEmail) profileEmail.textContent = activeEmail;
      if (profileBtn) profileBtn.setAttribute('data-email', activeEmail);
    } else {
      if (profileContainer) profileContainer.style.display = 'none';
    }
    googleModal.classList.add('active');
  };

  googleLoginBtn.addEventListener('click', openGoogleModal);
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
  await logoutUser();
  await refreshSessionUI();
  showAuthFeedback('Logged out of cloud session', 'var(--text-muted)');
}

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
  el.textContent = msg;
  el.style.color = color;
}
