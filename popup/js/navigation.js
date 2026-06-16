// Tab switching navigation controller for Spelt extension popup
export function initNavigation(onTabChanged) {
  const tabs = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const targetPane = document.getElementById(target);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      // Auto-focus primary input of the active tab for seamless keyboard entry
      if (target === 'sandbox-tab') {
        document.getElementById('word-input')?.focus();
      } else if (target === 'practice-tab') {
        document.getElementById('spelling-input')?.focus();
      } else if (target === 'vault-tab') {
        document.getElementById('vault-search')?.focus();
      } else if (target === 'stats-tab') {
        document.activeElement?.blur();
      }

      if (onTabChanged) onTabChanged(target);
    });
  });

  // Listen to window ArrowLeft / ArrowRight to switch pages
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    // Ensure we do not block typing navigation unless input is empty
    const active = document.activeElement;
    const isTextInput = active && (
      active.tagName === 'TEXTAREA' ||
      (active.tagName === 'INPUT' && ['text', 'search', 'password', 'email', 'number', 'url'].includes(active.type))
    );

    if (isTextInput && active.value !== '' && !e.altKey) {
      return;
    }

    const tabsList = Array.from(tabs);
    const activeIndex = tabsList.findIndex(t => t.classList.contains('active'));
    if (activeIndex === -1) return;

    let nextIndex;
    if (e.key === 'ArrowLeft') {
      nextIndex = (activeIndex - 1 + tabsList.length) % tabsList.length;
    } else {
      nextIndex = (activeIndex + 1) % tabsList.length;
    }

    e.preventDefault();
    tabsList[nextIndex].click();
  });
}
