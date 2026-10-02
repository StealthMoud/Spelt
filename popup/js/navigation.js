import { stopAiStatusMonitor } from './settings.js';

const TAB_IDS = ['today-tab', 'sandbox-tab', 'practice-tab', 'vault-tab', 'stats-tab', 'settings-tab'];

function getInitialTab() {
  const route = window.location.hash.slice(1).split('/')[0];
  if (route === 'stats') return 'stats-tab';
  if (TAB_IDS.includes(`${route}-tab`)) return `${route}-tab`;
  return 'today-tab';
}

export function initNavigation(onTabChanged) {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const panes = Array.from(document.querySelectorAll('.tab-pane'));

  const activateTab = (target, { focusTab = false } = {}) => {
    const nextTab = tabs.find(tab => tab.dataset.tab === target);
    const nextPane = document.getElementById(target);
    if (!nextTab || !nextPane) return;

    if (target !== 'settings-tab') stopAiStatusMonitor();

    tabs.forEach(tab => {
      const active = tab === nextTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panes.forEach(pane => {
      const active = pane === nextPane;
      pane.classList.toggle('active', active);
      pane.hidden = !active;
    });

    document.documentElement.dataset.activeTab = target;
    const main = document.querySelector('.popup-main');
    if (main) main.scrollTop = 0;
    if (focusTab) nextTab.focus();

    if (!focusTab) {
      if (target === 'sandbox-tab') document.getElementById('word-input')?.focus();
      else if (target === 'vault-tab') document.getElementById('vault-search')?.focus();
    }

    Promise.resolve(onTabChanged?.(target)).catch(error => {
      console.error('Tab refresh failed:', error);
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      let nextIndex = null;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;

      event.preventDefault();
      activateTab(tabs[nextIndex].dataset.tab, { focusTab: true });
    });
  });

  window.addEventListener('keydown', event => {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
    if (activeIndex < 0) return;
    const step = event.key === 'ArrowLeft' ? -1 : 1;
    const nextIndex = (activeIndex + step + tabs.length) % tabs.length;
    event.preventDefault();
    activateTab(tabs[nextIndex].dataset.tab, { focusTab: true });
  });

  activateTab(getInitialTab());
}
