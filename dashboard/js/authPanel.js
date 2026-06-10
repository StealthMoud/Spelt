import { getSession, loginUser, registerUser, logoutUser, syncUserData, getSyncStats, loginWithGoogle } from '../../shared/auth.js';
import { getWords } from '../../shared/storage.js';
import { updateSidebarUserDisplay } from './navigation.js';

let onAuthChangedCallback = null;
let authMode = 'login'; // 'login' or 'register'

export function initAuthPanel(onAuthChanged) {
  onAuthChangedCallback = onAuthChanged;

  const authForm = document.getElementById('unified-auth-form');
  const logoutBtn = document.getElementById('logout-btn');
  const syncBtn = document.getElementById('sync-now-btn');
  const modeToggleBtn = document.getElementById('auth-toggle-mode-btn');

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value;

    if (authMode === 'login') {
      handleAuthAction(() => loginUser(email, pass), 'Logging in...', 'Login successful!');
    } else {
      handleAuthAction(() => registerUser(email, pass), 'Creating cloud profile...', 'Profile created & backup synced!');
    }
  });

  modeToggleBtn.addEventListener('click', toggleAuthMode);
  logoutBtn.addEventListener('click', handleLogout);
  syncBtn.addEventListener('click', handleCloudSync);

  initGoogleAuthElements();
}

function toggleAuthMode() {
  const title = document.getElementById('auth-card-title');
  const btnText = document.getElementById('auth-btn-text');
  const modeLabel = document.getElementById('auth-mode-label');
  const toggleBtn = document.getElementById('auth-toggle-mode-btn');

  if (authMode === 'login') {
    authMode = 'register';
    title.textContent = 'Create Cloud Profile';
    btnText.textContent = 'Register & Sync';
    modeLabel.textContent = 'Already have an account?';
    toggleBtn.textContent = 'Sign In';
  } else {
    authMode = 'login';
    title.textContent = 'Sync & Secure Progress';
    btnText.textContent = 'Sign In';
    modeLabel.textContent = "Don't have an account?";
    toggleBtn.textContent = 'Register';
  }
}

function initGoogleAuthElements() {
  const googleLoginBtn = document.getElementById('google-login-btn');
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
  googleClose.addEventListener('click', () => googleModal.classList.remove('active'));

  googleAccs.forEach(row => {
    row.addEventListener('click', async () => {
      const email = row.getAttribute('data-email');
      googleModal.classList.remove('active');
      await handleAuthAction(() => loginWithGoogle(email), 'Connecting Google OAuth...', 'Authenticated successfully!');
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
  }

  if (onAuthChangedCallback) onAuthChangedCallback();
}

function showAuthFeedback(msg, color) {
  const el = document.getElementById('auth-feedback-msg');
  el.textContent = msg;
  el.style.color = color;
}
