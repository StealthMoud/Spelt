// User authentication and simulated cloud sync manager
// Stores credentials locally in chrome.storage and mimics server delays

const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
let mockAuthDb = {}; // Node test memory mock

async function getAuthStored(key) {
  if (isExt) {
    const res = await chrome.storage.local.get(key);
    return res[key];
  }
  return mockAuthDb[key];
}

async function setAuthStored(key, val) {
  if (isExt) {
    await chrome.storage.local.set({ [key]: val });
  } else {
    mockAuthDb[key] = val;
  }
}

// Get active session
export async function getSession() {
  return await getAuthStored('spelt_session') || null;
}

// Mock delay function to simulate API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Register a new user
export async function registerUser(email, password) {
  await delay(800); // simulate network latency
  if (!email || !password) throw new Error('Email and password required');
  
  const accounts = await getAuthStored('spelt_accounts') || {};
  if (accounts[email.toLowerCase()]) {
    throw new Error('Account already exists');
  }

  accounts[email.toLowerCase()] = {
    email: email.toLowerCase(),
    password: password, // in production this is hashed server-side
    createdAt: Date.now(),
    syncDate: 0
  };

  await setAuthStored('spelt_accounts', accounts);
  
  const session = { email: email.toLowerCase(), loggedInAt: Date.now() };
  await setAuthStored('spelt_session', session);
  return session;
}

// Log in existing user
export async function loginUser(email, password) {
  await delay(800);
  if (!email || !password) throw new Error('Email and password required');

  const accounts = await getAuthStored('spelt_accounts') || {};
  const user = accounts[email.toLowerCase()];

  if (!user || user.password !== password) {
    throw new Error('Invalid email or password');
  }

  const session = { email: email.toLowerCase(), loggedInAt: Date.now() };
  await setAuthStored('spelt_session', session);
  return session;
}

// Log in/Register using Google account simulation
export async function loginWithGoogle(email) {
  await delay(900); // mock OAuth validation lag
  if (!email) throw new Error('Google email is required');

  const accounts = await getAuthStored('spelt_accounts') || {};
  let user = accounts[email.toLowerCase()];

  if (!user) {
    // Auto-create cloud sync storage for new Gmail logs
    user = {
      email: email.toLowerCase(),
      isGoogle: true,
      createdAt: Date.now(),
      syncDate: 0
    };
    accounts[email.toLowerCase()] = user;
    await setAuthStored('spelt_accounts', accounts);
  }

  const session = { email: email.toLowerCase(), loggedInAt: Date.now(), isGoogle: true };
  await setAuthStored('spelt_session', session);
  return session;
}

// Logout
export async function logoutUser() {
  await setAuthStored('spelt_session', null);
}

// Simulate data synchronization to cloud
export async function syncUserData(wordsData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized: login required');

  await delay(1200); // sync takes slightly longer

  const accounts = await getAuthStored('spelt_accounts') || {};
  const user = accounts[session.email];
  
  if (!user) throw new Error('User account not found');

  // Sync details saved to user profile
  user.syncDate = Date.now();
  user.backupData = wordsData;

  accounts[session.email] = user;
  await setAuthStored('spelt_accounts', accounts);
  
  return {
    success: true,
    syncDate: user.syncDate,
    itemCount: wordsData.length
  };
}

// Retrieve sync details
export async function getSyncStats() {
  const session = await getSession();
  if (!session) return null;

  const accounts = await getAuthStored('spelt_accounts') || {};
  const user = accounts[session.email];
  return {
    email: session.email,
    syncDate: user?.syncDate || 0,
    itemCount: user?.backupData?.length || 0
  };
}

// Check if email account exists in the client-side mock db
export async function checkEmailExists(email) {
  if (!email) return false;
  const accounts = await getAuthStored('spelt_accounts') || {};
  return !!accounts[email.toLowerCase()];
}

// Official Google OAuth 2.0 retrieval flow using chrome.identity
export async function authenticateWithGoogle() {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.identity || !chrome.identity.getAuthToken) {
      reject(new Error('Chrome Identity API is not available'));
      return;
    }
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Google OAuth failed'));
        return;
      }
      try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
        if (!response.ok) throw new Error('Failed to retrieve Google profile info');
        const info = await response.json();
        if (!info.email) throw new Error('Google email address not found in profile');
        const session = await loginWithGoogle(info.email);
        resolve(session);
      } catch (err) {
        reject(err);
      }
    });
  });
}
