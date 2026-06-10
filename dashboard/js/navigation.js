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

      // Trigger callback if provided
      if (typeof onViewChange === 'function') {
        onViewChange(targetId);
      }
    });
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

// Update authorization email tags in layouts
export function updateSidebarUserDisplay(session) {
  const userText = document.getElementById('sidebar-user-label');
  const userIndicator = document.querySelector('.user-indicator');
  const navAuthLabel = document.getElementById('nav-auth-label');

  if (session) {
    userText.textContent = session.email;
    userIndicator.classList.add('active');
    navAuthLabel.textContent = 'Backup Active';
  } else {
    userText.textContent = 'Guest Mode';
    userIndicator.classList.remove('active');
    navAuthLabel.textContent = 'Cloud Sync';
  }
}
