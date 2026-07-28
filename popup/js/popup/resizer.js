export function initResizer() {
  const handles = document.querySelectorAll('.resizer');

  // Helper to apply dimensions to body and html elements
  function setStyles(w, h, maxW, maxH) {
    [document.body, document.documentElement].forEach(el => {
      if (w) el.style.width = w;
      if (h) el.style.height = h;
      if (maxW) el.style.maxWidth = maxW;
      if (maxH) el.style.maxHeight = maxH;
    });
  }

  // Load saved size from storage if available
  chrome.storage?.local.get(['spelt_popup_width', 'spelt_popup_height'], (res) => {
    const savedW = res.spelt_popup_width;
    const savedH = res.spelt_popup_height;

    chrome.windows?.getCurrent((win) => {
      const isStandalone = (win && win.type === 'popup') || window.location.hash !== '' || window.innerWidth >= 560;

      if (isStandalone) {
        // Standalone popout window or expanded view — allow full fluid expansion
        setStyles('100%', '100%', 'none', 'none');
        handles.forEach(h => h.classList.add('hidden'));
      } else {
        // Standard extension toolbar dropdown popup
        handles.forEach(h => h.classList.add('hidden'));
        const initW = savedW ? Math.max(360, Math.min(800, savedW)) : 360;
        const initH = savedH ? Math.max(400, Math.min(600, savedH)) : 600;
        setStyles(`${initW}px`, `${initH}px`, '800px', '600px');
      }
    });
  });
}
