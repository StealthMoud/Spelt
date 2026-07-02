export function initResizer() {
  const handles = document.querySelectorAll('.resizer');
  let startX, startY, startW, startH, active = null;

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
      const isDetached = win && win.type === 'popup';

      if (!isDetached) {
        // Standard dropdown popup
        // Show all 8 resizer handles (edges and corners)
        handles.forEach(h => {
          h.style.display = 'block';
        });

        // Apply saved or default dimensions
        const initW = savedW ? Math.max(360, Math.min(800, savedW)) : 360;
        const initH = savedH ? Math.max(400, Math.min(600, savedH)) : 530;
        setStyles(`${initW}px`, `${initH}px`, '800px', '600px');

        // Setup drag-to-resize handlers for standard popup
        handles.forEach(h => {
          h.addEventListener('mousedown', (e) => {
            e.preventDefault();
            active = h;
            startX = e.clientX;
            startY = e.clientY;
            startW = document.documentElement.offsetWidth || 360;
            startH = document.documentElement.offsetHeight || 530;
            h.classList.add('dragging');
            document.addEventListener('mousemove', dragDropdown);
            document.addEventListener('mouseup', stopDropdown);
          });
        });
      } else {
        // Detached standalone window
        // OS handles native window resizing, so we hide our custom resizer handles
        handles.forEach(h => h.style.display = 'none');
        setStyles('100%', '100%', 'none', 'none');
      }
    });
  });

  function dragDropdown(e) {
    if (!active) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Check directions from classes
    const isL = active.classList.contains('resizer-l') || active.classList.contains('resizer-bl') || active.classList.contains('resizer-tl');
    const isR = active.classList.contains('resizer-r') || active.classList.contains('resizer-br') || active.classList.contains('resizer-tr');
    const isT = active.classList.contains('resizer-t') || active.classList.contains('resizer-tl') || active.classList.contains('resizer-tr');
    const isB = active.classList.contains('resizer-b') || active.classList.contains('resizer-bl') || active.classList.contains('resizer-br');

    if (isR) {
      const w = Math.max(360, Math.min(800, startW + dx));
      [document.body, document.documentElement].forEach(el => {
        el.style.width = `${w}px`;
      });
    } else if (isL) {
      const w = Math.max(360, Math.min(800, startW - dx));
      [document.body, document.documentElement].forEach(el => {
        el.style.width = `${w}px`;
      });
    }

    if (isB) {
      const h = Math.max(400, Math.min(600, startH + dy));
      [document.body, document.documentElement].forEach(el => {
        el.style.height = `${h}px`;
      });
    } else if (isT) {
      const h = Math.max(400, Math.min(600, startH - dy));
      [document.body, document.documentElement].forEach(el => {
        el.style.height = `${h}px`;
      });
    }
  }

  function stopDropdown() {
    if (active) {
      active.classList.remove('dragging');
      const w = document.documentElement.offsetWidth;
      const h = document.documentElement.offsetHeight;
      chrome.storage?.local.set({ spelt_popup_width: w, spelt_popup_height: h });
      active = null;
    }
    document.removeEventListener('mousemove', dragDropdown);
    document.removeEventListener('mouseup', stopDropdown);
  }
}
