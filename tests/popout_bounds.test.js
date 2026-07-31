import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Geometry for the standalone popout window.
 *
 * `screen` and `chrome.storage` are stubbed so the placement maths can be
 * asserted directly: what size a display yields, where a first launch lands,
 * and whether a remembered position survives a change of monitor.
 */

const store = {};

globalThis.chrome = {
  storage: {
    local: {
      get(key, cb) { cb?.(key in store ? { [key]: store[key] } : {}); },
      set(values, cb) { Object.assign(store, values); cb?.(); },
      remove() {}
    }
  }
};

/** A 1710x1068 display with a 25px menu bar and a 70px dock, like a MacBook. */
function setScreen({ width = 1710, height = 1068, left = 0, top = 25, dock = 70 } = {}) {
  globalThis.screen = {
    availWidth: width,
    availHeight: height - top - dock,
    availLeft: left,
    availTop: top
  };
}

const bounds = await import(new URL('../popup/js/popup/popout_bounds.js', import.meta.url).href);

test('the popout fills the usable height at the fixed layout width', () => {
  setScreen();
  const size = bounds.getPopoutSize();

  assert.equal(size.width, bounds.POPOUT_WIDTH, 'width is capped by the 580px layout');
  // 1068 - 25 menu bar - 70 dock = 973 usable, less a 20px margin each side.
  assert.equal(size.height, 933);
});

test('a short display still gets a usable window', () => {
  setScreen({ height: 600 });
  assert.equal(bounds.getPopoutSize().height, 560, 'fell below the minimum height');
});

test('a first launch is centred in the work area', () => {
  setScreen();
  const size = bounds.getPopoutSize();
  const { left, top } = bounds.getCenteredPosition(size);

  assert.equal(left, Math.round((1710 - 580) / 2));
  // Centred vertically within the work area, below the menu bar.
  assert.equal(top, 25 + Math.round((973 - 933) / 2));
});

test('a remembered position is pulled back onto a smaller screen', () => {
  setScreen({ width: 1280, height: 800, dock: 0 });
  const size = bounds.getPopoutSize();
  // Left on a second monitor that is no longer attached.
  const restored = bounds.clampToWorkArea({ left: 3200, top: 1400 }, size);

  assert.equal(restored.left, 1280 - size.width);
  assert.ok(restored.top >= 25 && restored.top + size.height <= 25 + 775);
});

test('a position already on screen is left where it is', () => {
  setScreen();
  const size = bounds.getPopoutSize();
  assert.deepEqual(bounds.clampToWorkArea({ left: 300, top: 40 }, size), { left: 300, top: 40 });
});

test('the first launch centres, later launches reuse the saved position', async () => {
  setScreen();
  delete store.spelt_popout_position;

  const first = await bounds.getLaunchBounds();
  assert.deepEqual(
    { left: first.left, top: first.top },
    bounds.getCenteredPosition(bounds.getPopoutSize()),
    'a window with no history should open centred'
  );

  bounds.savePosition(120, 60);
  const second = await bounds.getLaunchBounds();
  assert.deepEqual({ left: second.left, top: second.top }, { left: 120, top: 60 });
  assert.equal(second.height, first.height, 'the size must not drift between launches');
});
