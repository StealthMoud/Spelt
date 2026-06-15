// Handles view navigation transitions and updates view visibility

export function initNavigation(onViewChange) {
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanes = document.querySelectorAll('.view-pane');

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (!targetId) return;

      // Deactivate all nav buttons and sections
      navItems.forEach(item => item.classList.remove('active'));
      viewPanes.forEach(pane => pane.classList.remove('active'));

      // Activate selected
      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      // Auto-focus primary input of the active tab for seamless keyboard entry
      if (targetId === 'sandbox-section') {
        document.getElementById('sandbox-spell-input')?.focus();
      } else if (targetId === 'practice-section') {
        document.getElementById('spelling-input')?.focus();
      } else if (targetId === 'vault-section') {
        document.getElementById('vault-search')?.focus();
      }

      // Trigger callback if provided
      if (typeof onViewChange === 'function') {
        onViewChange(targetId);
      }
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

    const navList = Array.from(navItems);
    const activeIndex = navList.findIndex(item => item.classList.contains('active'));
    if (activeIndex === -1) return;

    let nextIndex;
    if (e.key === 'ArrowLeft') {
      nextIndex = (activeIndex - 1 + navList.length) % navList.length;
    } else {
      nextIndex = (activeIndex + 1) % navList.length;
    }

    e.preventDefault();
    navList[nextIndex].click();
  });
}

// Update badges/UI counters across views
export function setDueReviewsBadge(count) {
  const badge = document.getElementById('nav-due-badge');
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

