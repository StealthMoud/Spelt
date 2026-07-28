export function initResizer() {
  const handles = document.querySelectorAll('.resizer');

  // Clear any old saved overflow dimensions in storage that might corrupt popup sizing
  chrome.storage?.local.remove(['spelt_popup_width', 'spelt_popup_height']);

  // Detect standalone window / popout / tab mode via URL hash or window context
  const isStandalone = window.location.hash !== '' || window.location.search.includes('standalone');

  if (isStandalone) {
    document.documentElement.classList.add('standalone');
    document.body.classList.add('standalone');

    const enforceCompactWindow = () => {
      chrome.windows?.getCurrent((win) => {
        if (!win || win.type !== 'popup') return;
        if (win.state === 'fullscreen' || win.state === 'maximized') {
          chrome.windows.update(win.id, { state: 'normal', width: 580, height: 680 });
        } else if (win.width > 620 || win.height > 720) {
          chrome.windows.update(win.id, { width: 580, height: 680 });
        }
      });
    };

    enforceCompactWindow();

    if (chrome.windows?.onBoundsChanged) {
      chrome.windows.onBoundsChanged.addListener((win) => {
        if (win && win.type === 'popup') enforceCompactWindow();
      });
    }

    window.addEventListener('resize', enforceCompactWindow);
  }
  handles.forEach(h => h.classList.add('hidden'));
}
