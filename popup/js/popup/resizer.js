import { POPOUT_WIDTH, getPopoutSize, getLaunchBounds } from './popout_bounds.js';

export function initResizer() {
  const handles = document.querySelectorAll('.resizer');

  // Clear any old saved overflow dimensions in storage that might corrupt popup sizing
  chrome.storage?.local.remove(['spelt_popup_width', 'spelt_popup_height']);

  const route = window.location.hash.slice(1).split('/')[0];
  const isStatsPage = route === 'stats';
  const isStandalone = route === 'popout' || window.location.search.includes('standalone');
  if (window.location.protocol === 'chrome-extension:' && !isStandalone && !isStatsPage) {
    document.documentElement.classList.add('extension-popup');
  }

  if (isStatsPage) {
    document.documentElement.classList.add('stats-page');
    document.body.classList.add('stats-page');
  }

  if (isStandalone) {
    document.documentElement.classList.add('standalone');
    document.body.classList.add('standalone');

    /**
     * Snap to the full launch size and position, once, on load.
     *
     * The create call asks for these bounds, but applying them here ensures the
     * window is centred (or restored) consistently on every route into the popout.
     */
    const applyLaunchSize = async () => {
      const bounds = await getLaunchBounds();
      chrome.windows?.getCurrent((win) => {
        if (!win || win.type !== 'popup') return;
        chrome.windows.update(win.id, { state: 'normal', ...bounds });
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
