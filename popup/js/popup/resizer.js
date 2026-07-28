export function initResizer() {
  const handles = document.querySelectorAll('.resizer');

  // Clear any old saved overflow dimensions in storage that might corrupt popup sizing
  chrome.storage?.local.remove(['spelt_popup_width', 'spelt_popup_height']);

  // Detect standalone window / popout / tab mode via URL hash or window context
  const isStandalone = window.location.hash !== '' || window.location.search.includes('standalone');

  if (isStandalone) {
    document.documentElement.classList.add('standalone');
    document.body.classList.add('standalone');

    const enforceCompactWidth = () => {
      chrome.windows?.getCurrent((win) => {
        if (!win || win.type !== 'popup') return;
        if (win.state === 'fullscreen') {
          chrome.windows.update(win.id, { state: 'normal', width: 580, height: win.height || 680 });
        } else if (win.width > 620) {
          chrome.windows.update(win.id, { width: 580, height: win.height });
        }
      });
    };

    enforceCompactWidth();

    if (chrome.windows?.onBoundsChanged) {
      chrome.windows.onBoundsChanged.addListener((win) => {
        if (win && win.type === 'popup') enforceCompactWidth();
      });
    }

    window.addEventListener('resize', enforceCompactWidth);
  }
  handles.forEach(h => h.classList.add('hidden'));
}
