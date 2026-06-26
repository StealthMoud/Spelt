export function initSelectionLookup() {
  const floatingBtn = document.createElement('button');
  floatingBtn.id = 'floating-lookup-btn';
  floatingBtn.className = 'floating-lookup-btn';
  floatingBtn.type = 'button';
  floatingBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span>Lookup</span>
  `;
  document.body.appendChild(floatingBtn);

  let isEnabled = true;
  chrome.storage?.local.get('spelt_selection_lookup', (res) => {
    isEnabled = res.spelt_selection_lookup !== false;
  });

  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.spelt_selection_lookup) {
      isEnabled = changes.spelt_selection_lookup.newValue !== false;
      if (!isEnabled) hideBtn();
    }
  });

  const hideBtn = () => floatingBtn.classList.remove('visible');

  document.addEventListener('selectionchange', () => {
    if (!isEnabled) return;
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    if (!txt || txt.length < 2 || txt.length > 40 || txt.includes('\n')) {
      hideBtn(); return;
    }
    if (sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const btnWidth = 72;
        let left = rect.left + rect.width / 2;
        let top = rect.top + window.scrollY;
        const viewportWidth = document.body.clientWidth || window.innerWidth;
        if (left < btnWidth / 2) left = btnWidth / 2;
        if (left > viewportWidth - btnWidth / 2) left = viewportWidth - btnWidth / 2;
        floatingBtn.style.left = `${left}px`;
        floatingBtn.style.top = `${top}px`;
        floatingBtn.classList.add('visible');
      } else { hideBtn(); }
    } else { hideBtn(); }
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#floating-lookup-btn')) return;
    setTimeout(() => {
      if (!window.getSelection().toString().trim()) hideBtn();
    }, 50);
  });

  floatingBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const sel = window.getSelection();
    const txt = sel.toString().trim();
    if (txt) {
      sel.removeAllRanges(); hideBtn();
      document.querySelector('.tab-btn[data-tab="sandbox-tab"]')?.click();
      const input = document.getElementById('word-input');
      if (input) {
        input.value = txt;
        document.getElementById('quick-add-form')?.dispatchEvent(new Event('submit'));
      }
    }
  });
}
