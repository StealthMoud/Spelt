import { setTimeframe, setLeechesLimit, setLeechesCustomVal, currentStatsTimeframe, currentLeechesLimit, currentLeechesCustomVal } from './state.js';

export function bindUiEvents(renderStats) {
  document.querySelectorAll('.stats-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stats-subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.stats-subtab-content').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
      btn.classList.add('active');
      const target = document.getElementById(`stats-subtab-${btn.getAttribute('data-subtab')}`);
      if (target) { target.classList.add('active'); target.style.display = 'flex'; }
    });
  });

  const select = document.getElementById('stats-timeframe-select');
  const btn = document.getElementById('stats-timeframe-btn');
  const dropdown = document.getElementById('stats-timeframe-dropdown');
  const label = document.getElementById('stats-timeframe-label');

  const syncSelect = () => {
    if (!select || !label || !dropdown) return;
    const opt = dropdown.querySelector(`.custom-select-option[data-value="${select.value}"]`);
    if (opt) {
      label.textContent = opt.textContent;
      dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    }
  };

  if (select) {
    select.value = currentStatsTimeframe; syncSelect();
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const show = dropdown.style.display === 'none';
      dropdown.style.display = show ? 'block' : 'none';
      const row = btn.closest('.stats-header-row');
      if (row) { row.style.position = 'relative'; row.style.zIndex = show ? '60' : ''; }
    });
    dropdown?.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation(); select.value = opt.getAttribute('data-value'); syncSelect();
        dropdown.style.display = 'none';
        const row = btn.closest('.stats-header-row');
        if (row) row.style.zIndex = '';
        select.dispatchEvent(new Event('change'));
      });
    });
    select.addEventListener('change', async (e) => {
      setTimeframe(e.target.value);
      const cr = document.getElementById('stats-custom-range');
      if (cr) cr.style.display = e.target.value === 'custom' ? 'flex' : 'none';
      await renderStats();
    });
  }

  const limitSelect = document.getElementById('stats-leeches-limit');
  const customInput = document.getElementById('stats-leeches-custom-val');
  const customContainer = document.getElementById('stats-leeches-custom-container');

  limitSelect?.addEventListener('change', (e) => {
    setLeechesLimit(e.target.value);
    chrome.storage?.local.set({ spelt_leeches_limit: e.target.value });
    if (customContainer) customContainer.style.display = e.target.value === 'custom' ? 'flex' : 'none';
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

  window.addEventListener('click', (e) => {
    if (dropdown && dropdown.style.display !== 'none' && !btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
      const row = btn.closest('.stats-header-row'); if (row) row.style.zIndex = '';
    }
  });
}
