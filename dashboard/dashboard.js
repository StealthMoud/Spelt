import { initNavigation, setDueReviewsBadge } from './js/navigation.js';
import { initPractice, loadDeck } from './js/practice.js';
import { initVault, reloadVault } from './js/vault.js';
import { reloadAnalytics } from './js/analytics.js';
import { initSettings } from './js/settings.js';
import { initAuthPanel, refreshSessionUI } from './js/authPanel.js';
import { initSandbox } from './js/sandbox.js';
import { getXp } from '../shared/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Bind views
  await initNavigation(handleViewChange);
  await initPractice(handleDeckUpdated, handleXpUpdated, triggerConfetti);
  await initVault(handleVaultUpdated);
  initSettings(handleDbRestored);
  initAuthPanel(handleAuthChanged);
  initSandbox(handleXpUpdated, triggerConfetti);

  // Load initial displays
  await handleDbRestored();
});

// Refresh all sections when db is wiped or JSON imported
async function handleDbRestored() {
  await loadDeck();
  await reloadVault();
  await reloadAnalytics();
  await refreshSessionUI();
  await refreshXpUI();
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

function handleDeckUpdated(dueCount) {
  setDueReviewsBadge(dueCount);
}

async function handleVaultUpdated() {
  await loadDeck();
  await reloadAnalytics();
}

async function handleXpUpdated() {
  await refreshXpUI();
  await reloadAnalytics(); // statistics could change
}

async function handleAuthChanged() {
  await reloadAnalytics();
}

// Update gamification progress bars
export async function refreshXpUI() {
  const xp = await getXp();
  const lvl = Math.floor(xp / 100) + 1;
  const pct = xp % 100;

  // Evocative titles
  let title = 'Word Novice';
  if (lvl === 2) title = 'Spelling Apprentice';
  else if (lvl === 3) title = 'Orthography Knight';
  else if (lvl === 4) title = 'Lexicon Champion';
  else if (lvl >= 5) title = 'Spelling Sage';

  const lvlBadge = document.getElementById('user-level-badge');
  const xpText = document.getElementById('user-xp-display');
  const barInner = document.getElementById('xp-bar-inner');

  if (lvlBadge) lvlBadge.textContent = `Lvl ${lvl} ${title}`;
  if (xpText) xpText.textContent = `${pct} / 100 XP`;
  if (barInner) barInner.style.width = `${pct}%`;
}

// Particle confetti burst celebration
export function triggerConfetti(targetElement) {
  if (!targetElement) return;
  const rect = targetElement.getBoundingClientRect();
  const colors = ['#6655e6', '#a399ff', '#ffffff', '#e0ddff'];

  for (let i = 0; i < 24; i++) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    
    // Position at target button center
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2 + window.scrollY;
    
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

    // Randomize trajectory translations
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 80;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 40; // upward bias

    particle.style.setProperty('--dx', `${dx}px`);
    particle.style.setProperty('--dy', `${dy}px`);

    document.body.appendChild(particle);

    // Garbage clean particles after animation finishes
    setTimeout(() => {
      particle.remove();
    }, 1000);
  }
}
