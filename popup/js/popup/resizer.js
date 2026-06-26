export function initResizer() {
  const handles = document.querySelectorAll('.resizer');
  let startX, startY, startWidth, startHeight;
  let activeHandle = null;

  chrome.storage?.local.get(['spelt_popup_width', 'spelt_popup_height'], (res) => {
    const width = res.spelt_popup_width || 360;
    const height = res.spelt_popup_height || 530;
    setDimensions(width, height);
  });

  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      activeHandle = handle;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(document.defaultView.getComputedStyle(document.body).width, 10);
      startHeight = parseInt(document.defaultView.getComputedStyle(document.body).height, 10);
      handle.classList.add('dragging');
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDrag);
    });
  });

  function setDimensions(w, h) {
    document.body.style.width = w + 'px';
    document.body.style.height = h + 'px';
    document.documentElement.style.width = w + 'px';
    document.documentElement.style.height = h + 'px';
  }

  function drag(e) {
    if (!activeHandle) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let w = startWidth;
    let h = startHeight;

    const isL = activeHandle.classList.contains('resizer-l') || activeHandle.classList.contains('resizer-bl') || activeHandle.classList.contains('resizer-tl');
    const isR = activeHandle.classList.contains('resizer-r') || activeHandle.classList.contains('resizer-br') || activeHandle.classList.contains('resizer-tr');
    const isB = activeHandle.classList.contains('resizer-b') || activeHandle.classList.contains('resizer-bl') || activeHandle.classList.contains('resizer-br');
    const isT = activeHandle.classList.contains('resizer-t') || activeHandle.classList.contains('resizer-tl') || activeHandle.classList.contains('resizer-tr');

    if (isR) w = startWidth + dx;
    else if (isL) w = startWidth - dx;

    if (isB) h = startHeight + dy;
    else if (isT) h = startHeight - dy;

    w = Math.max(320, Math.min(800, w));
    h = Math.max(400, Math.min(600, h));
    setDimensions(w, h);
  }

  function stopDrag() {
    if (activeHandle) {
      activeHandle.classList.remove('dragging');
      const w = parseInt(document.body.style.width, 10);
      const h = parseInt(document.body.style.height, 10);
      if (w && h) chrome.storage?.local.set({ spelt_popup_width: w, spelt_popup_height: h });
      activeHandle = null;
    }
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
  }
}
