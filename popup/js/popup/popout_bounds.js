/**
 * Where and how big the standalone ("popout") window should be.
 *
 * The width is fixed — the layout is capped at 580px in responsive.css, so a
 * wider window would only add empty gutters. The height is whatever the current
 * display can give, because the Stats and Vault views are long and every extra
 * row saves a scroll. That makes the window open at the same generous size on
 * every launch instead of the small default Chrome would otherwise pick.
 */

export const POPOUT_WIDTH = 580;

/** Breathing room left between the window and the edges of the work area. */
const EDGE_MARGIN = 20;

/** Below this the tab bar and cards start to crowd, so never go under it. */
const MIN_HEIGHT = 560;

const POSITION_KEY = 'spelt_popout_position';

/** The current display's usable area, excluding menu bars, docks and taskbars. */
function workArea() {
  return {
    left: Number.isFinite(screen.availLeft) ? screen.availLeft : 0,
    top: Number.isFinite(screen.availTop) ? screen.availTop : 0,
    width: screen.availWidth || 1280,
    height: screen.availHeight || 800
  };
}

/** Fixed width, as tall as the display comfortably allows. */
export function getPopoutSize() {
  const area = workArea();
  return {
    width: POPOUT_WIDTH,
    height: Math.max(MIN_HEIGHT, Math.round(area.height - EDGE_MARGIN * 2))
  };
}

/** Centred in the work area — where a window with no history belongs. */
export function getCenteredPosition(size) {
  const area = workArea();
  return {
    left: Math.round(area.left + Math.max(0, (area.width - size.width) / 2)),
    top: Math.round(area.top + Math.max(0, (area.height - size.height) / 2))
  };
}

/**
 * Pull a remembered position back onto the screen. Without this a window last
 * left on a second monitor, or on a display that has since changed resolution,
 * reopens somewhere the user cannot reach it.
 */
export function clampToWorkArea(position, size) {
  const area = workArea();
  const maxLeft = Math.max(area.left, area.left + area.width - size.width);
  const maxTop = Math.max(area.top, area.top + area.height - size.height);
  return {
    left: Math.round(Math.min(Math.max(position.left, area.left), maxLeft)),
    top: Math.round(Math.min(Math.max(position.top, area.top), maxTop))
  };
}

/** The remembered position, or null the first time the popout is ever opened. */
export function readSavedPosition() {
  return new Promise(resolve => {
    if (!chrome.storage?.local) return resolve(null);
    chrome.storage.local.get(POSITION_KEY, (res) => {
      const saved = res?.[POSITION_KEY];
      const usable = saved && Number.isFinite(saved.left) && Number.isFinite(saved.top);
      resolve(usable ? saved : null);
    });
  });
}

/** Remember where the user dragged the window to, for the next launch. */
export function savePosition(left, top) {
  if (!Number.isFinite(left) || !Number.isFinite(top)) return;
  chrome.storage?.local?.set({ [POSITION_KEY]: { left, top } });
}

/**
 * Full bounds for a fresh popout: always the same generous size, centred the
 * first time and back where the user last put it after that.
 */
export async function getLaunchBounds() {
  const size = getPopoutSize();
  const saved = await readSavedPosition();
  const position = saved ? clampToWorkArea(saved, size) : getCenteredPosition(size);
  return { ...size, ...position };
}
