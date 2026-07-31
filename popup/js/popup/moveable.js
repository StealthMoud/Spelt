import { getLaunchBounds, savePosition } from './popout_bounds.js';

export function initMoveable() {
  const header = document.querySelector('.popup-header');
  const popoutBtn = document.getElementById('popup-popout-btn');
  if (!header) return;

  chrome.windows?.getCurrent((win) => {
    if (win && win.type === 'popup') {
      header.style.cursor = 'move';
    } else if (popoutBtn) {
      popoutBtn.classList.remove('hidden');
      popoutBtn.addEventListener('click', async () => {
        // Sized and placed deliberately rather than left to Chrome, which opens
        // a small cascaded window offset from the last one.
        const bounds = await getLaunchBounds();
        chrome.windows?.create({
          url: chrome.runtime.getURL('dist/popup.html#popout'),
          type: 'popup',
          state: 'normal',
          ...bounds
        });
        window.close();
      });
    }
  });

  header.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('nav') || e.target.closest('input') || e.target.closest('a')) {
      return;
    }

    e.preventDefault();
    const startScreenX = e.screenX;
    const startScreenY = e.screenY;

    chrome.windows?.getCurrent((win) => {
      if (!win || win.type !== 'popup' || win.state === 'maximized' || win.state === 'fullscreen') return;
      const startLeft = win.left;
      const startTop = win.top;

      let rafId = null;
      let lastLeft = startLeft;
      let lastTop = startTop;

      function onMouseMove(moveEvent) {
        const dx = moveEvent.screenX - startScreenX;
        const dy = moveEvent.screenY - startScreenY;
        lastLeft = startLeft + dx;
        lastTop = startTop + dy;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          chrome.windows.update(win.id, { left: lastLeft, top: lastTop });
        });
      }

      function onMouseUp() {
        if (rafId) cancelAnimationFrame(rafId);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // Only centred until the user expresses a preference; from here on the
        // window reopens where they left it.
        savePosition(lastLeft, lastTop);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}
