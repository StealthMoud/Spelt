import { initNavigation, setDueReviewsBadge } from './js/navigation.js';
import { initPractice, loadDeck, syncDeck } from './js/practice.js';
import { initVault, reloadVault } from './js/vault.js';
import { reloadAnalytics } from './js/analytics.js';
import { initSettings } from './js/settings.js';
import { initSandbox } from './js/sandbox.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Bind views
  await initNavigation(handleViewChange);
  await initPractice(handleDeckUpdated, triggerConfetti);
  await initVault(handleVaultUpdated);
  initSettings(handleDbRestored);
  initSandbox(triggerConfetti);

  // Load initial displays
  await handleDbRestored();
});

// Refresh all sections when db is wiped or JSON imported
async function handleDbRestored() {
  await loadDeck();
  await reloadVault();
  await reloadAnalytics();
}

// Reload tab contents when user clicks sidebar nav
async function handleViewChange(viewId) {
  if (viewId === 'practice-section') {
    await syncDeck();
  } else if (viewId === 'vault-section') {
    await reloadVault();
  } else if (viewId === 'analytics-section') {
    await reloadAnalytics();
  }
}

function handleDeckUpdated(dueCount) {
  setDueReviewsBadge(dueCount);
}

async function handleVaultUpdated() {
  await syncDeck();
  await reloadAnalytics();
}



// Particle confetti burst celebration
export function triggerConfetti(targetElement) {
  if (!targetElement) return;
  const rect = targetElement.getBoundingClientRect();
  const colors = ['#3acb81', '#85e6b5', '#ffffff', '#d0f5e4'];

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
