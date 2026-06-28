export function initResizer() {
  const handles = document.querySelectorAll('.resizer');
  let startX, startY, startW, startH, startL, startT, active = null;

  chrome.windows?.getCurrent((win) => {
    const isDetached = win && win.type === 'popup';
    handles.forEach(h => h.style.display = isDetached ? 'block' : 'none');

    if (!isDetached) {
      setStyles('360px', '530px', '360px', '530px');
    } else {
      setStyles('100%', '100%', 'none', 'none');
      handles.forEach(h => h.addEventListener('mousedown', (e) => {
        e.preventDefault(); active = h; startX = e.screenX; startY = e.screenY;
        chrome.windows.getCurrent((curr) => {
          startW = curr.width; startH = curr.height; startL = curr.left; startT = curr.top;
          document.addEventListener('mousemove', drag);
          document.addEventListener('mouseup', stop);
        });
      }));
    }
  });

  function setStyles(w, h, maxW, maxH) {
    [document.body, document.documentElement].forEach(el => {
      el.style.width = w; el.style.height = h; el.style.maxWidth = maxW; el.style.maxHeight = maxH;
    });
  }

  function drag(e) {
    if (!active) return;
    const dx = e.screenX - startX, dy = e.screenY - startY;
    let w = startW, h = startH, left = startL, top = startT;
    const isL = /l/.test(active.className), isR = /r/.test(active.className);
    const isB = /b/.test(active.className), isT = /t/.test(active.className);

    if (isR) w = startW + dx; else if (isL) { w = startW - dx; left = startL + dx; }
    if (isB) h = startH + dy; else if (isT) { h = startH - dy; top = startT + dy; }

    w = Math.max(320, Math.min(1600, w));
    h = Math.max(400, Math.min(1200, h));
    const params = { width: w, height: h };
    if (isL) params.left = left;
    if (isT) params.top = top;
    chrome.windows.getCurrent(c => chrome.windows.update(c.id, params));
  }

  function stop() {
    if (active) {
      chrome.windows.getCurrent(c => {
        if (c.width && c.height) chrome.storage?.local.set({ spelt_popup_width: c.width, spelt_popup_height: c.height });
      });
      active = null;
    }
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stop);
  }
}
