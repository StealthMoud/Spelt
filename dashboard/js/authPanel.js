import { getSession, loginUser, registerUser, logoutUser, syncUserData, getSyncStats, loginWithGoogle } from '../../shared/auth.js';
import { getWords } from '../../shared/storage.js';
import { updateSidebarUserDisplay } from './navigation.js';

let onAuthChangedCallback = null;

export function initAuthPanel(onAuthChanged) {
  onAuthChangedCallback = onAuthChanged;

  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const logoutBtn = document.getElementById('logout-btn');
  const syncBtn = document.getElementById('sync-now-btn');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAuthAction(() => {
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      return loginUser(email, pass);
    }, 'Logging in...', 'Login successful!');
  });

  regForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAuthAction(() => {
      const email = document.getElementById('register-email').value;
      const pass = document.getElementById('register-password').value;
      return registerUser(email, pass);
    }, 'Creating account...', 'Account registered & backup configured!');
  });

  logoutBtn.addEventListener('click', async () => {
    await logoutUser();
    await refreshSessionUI();
    showAuthFeedback('Logged out of cloud session', 'var(--text-muted)');
  });

  syncBtn.addEventListener('click', handleCloudSync);

  // Google OAuth selection triggers
  initGoogleAuthElements();
}

function initGoogleAuthElements() {
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

  googleAccs.forEach(row => {
    row.addEventListener('click', async () => {
      const email = row.getAttribute('data-email');
      googleModal.classList.remove('active');
      await handleAuthAction(() => loginWithGoogle(email), 'Redirecting to Google...', 'Authenticated with Google!');
    });
  });

  customAccTrigger.addEventListener('click', () => {
    customInputContainer.style.display = 'block';
    customEmailField.focus();
  });

  customEmailSubmit.addEventListener('click', async () => {
    const email = customEmailField.value.trim();
    if (!email.toLowerCase().endsWith('@gmail.com') && !email.toLowerCase().endsWith('@googlemail.com')) {
      alert('Please enter a valid Gmail address');
      return;
    }
    googleModal.classList.remove('active');
    await handleAuthAction(() => loginWithGoogle(email), 'Authorizing Google...', 'Authenticated with Google!');
  });
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
  }

  if (onAuthChangedCallback) onAuthChangedCallback();
}

function showAuthFeedback(msg, color) {
  const el = document.getElementById('auth-feedback-msg');
  el.textContent = msg;
  el.style.color = color;
}
