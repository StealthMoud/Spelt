import { POPOUT_WIDTH, getPopoutSize, clampToWorkArea } from './popout_bounds.js';

export function initResizer() {
  const handles = document.querySelectorAll('.resizer');

  // Clear any old saved overflow dimensions in storage that might corrupt popup sizing
  chrome.storage?.local.remove(['spelt_popup_width', 'spelt_popup_height']);

  // Detect standalone window / popout / tab mode via URL hash or window context
  const isStandalone = window.location.hash !== '' || window.location.search.includes('standalone');

  if (isStandalone) {
    document.documentElement.classList.add('standalone');
    document.body.classList.add('standalone');

    /**
     * Snap to the full launch size, once, on load.
     *
     * The create call already asks for these bounds, but this window also comes
     * back on its own — Chrome restores it after a restart at whatever size it
     * last had, and a reload keeps the old frame. Applying the size here is what
     * makes "always this big" true on every route into the popout, not just the
     * button.
     */
    const applyLaunchSize = () => {
      chrome.windows?.getCurrent((win) => {
        if (!win || win.type !== 'popup') return;
        const size = getPopoutSize();
        if (win.width === size.width && win.height === size.height) return;
        const position = clampToWorkArea({ left: win.left, top: win.top }, size);
        chrome.windows.update(win.id, { state: 'normal', ...size, ...position });
      });
    };

    /**
     * Keep the width in line afterwards, but leave the height alone — the user
     * is free to shorten the window, and only a width beyond the 580px layout
     * cap produces dead space worth correcting.
     */
    const enforceCompactWidth = () => {
      chrome.windows?.getCurrent((win) => {
        if (!win || win.type !== 'popup') return;
        if (win.state === 'fullscreen' || win.state === 'maximized') {
          chrome.windows.update(win.id, { state: 'normal', ...getPopoutSize() });
        } else if (win.width > POPOUT_WIDTH + 40) {
          chrome.windows.update(win.id, { width: POPOUT_WIDTH, height: win.height });
        }
      });
    };

    applyLaunchSize();

    if (chrome.windows?.onBoundsChanged) {
      chrome.windows.onBoundsChanged.addListener((win) => {
        if (win && win.type === 'popup') enforceCompactWidth();
      });
    }

    window.addEventListener('resize', enforceCompactWidth);
  }
  handles.forEach(h => h.classList.add('hidden'));
}
