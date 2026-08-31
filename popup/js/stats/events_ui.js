import { setTimeframe, setLeechesLimit, setLeechesCustomVal, currentStatsTimeframe } from './state.js';

export function bindUiEvents(renderStats) {
  const subtabButtons = Array.from(document.querySelectorAll('.stats-subtab-btn'));
  const activateSubtab = (btn, focus = false) => {
    document.querySelectorAll('.stats-subtab-content').forEach(panel => {
      const active = panel.id === `stats-subtab-${btn.dataset.subtab}`;
      panel.classList.toggle('active', active);
      panel.classList.toggle('hidden', !active);
      panel.hidden = !active;
    });
    subtabButtons.forEach(button => {
      const active = button === btn;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    if (focus) btn.focus();
  };

  subtabButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => activateSubtab(btn));
    btn.addEventListener('keydown', event => {
      let nextIndex = null;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + subtabButtons.length) % subtabButtons.length;
      else if (event.key === 'ArrowRight') nextIndex = (index + 1) % subtabButtons.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = subtabButtons.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      activateSubtab(subtabButtons[nextIndex], true);
    });
  });

  const select = document.getElementById('stats-timeframe-select');

  if (select) {
    select.value = currentStatsTimeframe;
    select.addEventListener('change', async (e) => {
      setTimeframe(e.target.value);
      const cr = document.getElementById('stats-custom-range');
      if (cr) cr.classList.toggle('hidden', e.target.value !== 'custom');
      await renderStats();
    });
  }

  const limitSelect = document.getElementById('stats-leeches-limit');
  const customInput = document.getElementById('stats-leeches-custom-val');
  const customContainer = document.getElementById('stats-leeches-custom-container');

  limitSelect?.addEventListener('change', (e) => {
    setLeechesLimit(e.target.value);
    chrome.storage?.local.set({ spelt_leeches_limit: e.target.value });
    if (customContainer) customContainer.classList.toggle('hidden', e.target.value !== 'custom');
    renderStats();
  });

  customInput?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10) || 15;
    setLeechesCustomVal(val);
    chrome.storage?.local.set({ spelt_leeches_custom_val: val });
    renderStats();
  });

  document.getElementById('stats-leeches-dec-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (customInput) { customInput.value = Math.max(1, (parseInt(customInput.value, 10) || 15) - 1); customInput.dispatchEvent(new Event('input')); }
  });
  document.getElementById('stats-leeches-inc-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (customInput) { customInput.value = Math.min(500, (parseInt(customInput.value, 10) || 15) + 1); customInput.dispatchEvent(new Event('input')); }
  });

}
