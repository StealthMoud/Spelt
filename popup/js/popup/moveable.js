export function initMoveable() {
  const header = document.querySelector('.popup-header');
  const popoutBtn = document.getElementById('popup-popout-btn');
  if (!header) return;

  chrome.windows?.getCurrent((win) => {
    if (win && win.type === 'popup') {
      header.style.cursor = 'move';
    } else if (popoutBtn) {
      popoutBtn.style.display = 'flex';
      popoutBtn.addEventListener('click', () => {
        chrome.storage?.local.get(['spelt_popup_width', 'spelt_popup_height'], (res) => {
          const width = res.spelt_popup_width || 360;
          const height = res.spelt_popup_height || 530;
          chrome.windows.create({
            url: chrome.runtime.getURL('popup/popup.html'),
            type: 'popup',
            width: width,
            height: height
          });
          window.close();
        });
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

      function onMouseMove(moveEvent) {
        const dx = moveEvent.screenX - startScreenX;
        const dy = moveEvent.screenY - startScreenY;
        chrome.windows.update(win.id, {
          left: startLeft + dx,
          top: startTop + dy
        });
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}
