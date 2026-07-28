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

  // Detect standalone window / popout / tab mode via URL hash or window context
  const isStandalone = window.location.hash !== '' || window.location.search.includes('standalone');

  if (isStandalone) {
    document.documentElement.classList.add('standalone');
    document.body.classList.add('standalone');
    setStyles('100%', '100%', 'none', 'none');
    handles.forEach(h => h.classList.add('hidden'));
    return;
  }

  // Standard extension toolbar dropdown popup
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['spelt_popup_width', 'spelt_popup_height'], (res) => {
      const savedW = res?.spelt_popup_width;
      const savedH = res?.spelt_popup_height;

      handles.forEach(h => h.classList.add('hidden'));
      const initW = savedW ? Math.max(360, Math.min(800, savedW)) : 360;
      const initH = savedH ? Math.max(400, Math.min(600, savedH)) : 530;
      setStyles(`${initW}px`, `${initH}px`, '800px', '600px');
    });
  } else {
    handles.forEach(h => h.classList.add('hidden'));
    setStyles('360px', '530px', '800px', '600px');
  }
}
