export function initResizer() {
  const handles = document.querySelectorAll('.resizer');

  // Helper to apply dimensions to body and html elements
  function setStyles(w, h, maxW, maxH) {
    [document.body, document.documentElement].forEach(el => {
      if (w !== undefined) el.style.width = w;
      if (h !== undefined) el.style.height = h;
      if (maxW !== undefined) el.style.maxWidth = maxW;
      if (maxH !== undefined) el.style.maxHeight = maxH;
    });
  }

  // Clear any old saved overflow dimensions in storage that might corrupt floating popup
  chrome.storage?.local.remove(['spelt_popup_width', 'spelt_popup_height']);

  // Detect standalone window / popout / tab mode via URL hash or window context
  const isStandalone = window.location.hash !== '' || window.location.search.includes('standalone');

  if (isStandalone) {
    document.documentElement.classList.add('standalone');
    document.body.classList.add('standalone');
    setStyles('100%', '100%', 'none', 'none');
  } else {
    setStyles('100%', '100%', '100%', '100%');
  }
  handles.forEach(h => h.classList.add('hidden'));
}
