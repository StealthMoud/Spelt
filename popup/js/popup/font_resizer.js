export function initFontResizer() {
  const fontDecreaseBtn = document.getElementById('font-decrease-btn');
  const fontIncreaseBtn = document.getElementById('font-increase-btn');
  const fontScaleDisplay = document.getElementById('font-scale-display');

  if (fontDecreaseBtn && fontIncreaseBtn && fontScaleDisplay) {
    chrome.storage.local.get(['fontScale'], (result) => {
      applyFontScale(result.fontScale || 100);
    });

    fontDecreaseBtn.addEventListener('click', () => {
      chrome.storage.local.get(['fontScale'], (result) => {
        let scale = result.fontScale || 100;
        if (scale > 80) {
          scale -= 10;
          chrome.storage.local.set({ fontScale: scale }, () => applyFontScale(scale));
        }
      });
    });

    fontIncreaseBtn.addEventListener('click', () => {
      chrome.storage.local.get(['fontScale'], (result) => {
        let scale = result.fontScale || 100;
        if (scale < 150) {
          scale += 10;
          chrome.storage.local.set({ fontScale: scale }, () => applyFontScale(scale));
        }
      });
    });

    function applyFontScale(scale) {
      scale = Math.max(80, Math.min(150, Number(scale) || 100));
      document.documentElement.style.fontSize = (16 * (scale / 100)) + 'px';
      document.documentElement.toggleAttribute('data-large-text', scale >= 120);
      fontScaleDisplay.textContent = scale + '%';
    }
  }
}
