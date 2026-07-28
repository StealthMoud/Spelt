export function initNetworkStatus() {
  const statusDot = document.querySelector('.user-status-dot');
  const sessionInfo = document.querySelector('.session-info');
  const offlineBanner = document.getElementById('offline-banner');
  const offlineBannerText = offlineBanner ? offlineBanner.querySelector('span') : null;

  let hasConnectionError = false;

  function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    if (statusDot && sessionInfo) {
      statusDot.classList.remove('active', 'offline', 'connection-error');
      sessionInfo.classList.remove('offline', 'connection-error');
      if (offlineBanner) offlineBanner.classList.remove('connection-error', 'visible');

      if (!isOnline) {
        statusDot.classList.add('offline');
        statusDot.title = 'Offline';
        statusDot.setAttribute('aria-label', 'Offline');
        sessionInfo.classList.add('offline');
        if (offlineBanner && offlineBannerText) {
          offlineBannerText.textContent = 'Offline mode. Dict lookup and translation unavailable.';
          offlineBanner.classList.add('visible');
        }
      } else if (hasConnectionError) {
        statusDot.classList.add('connection-error');
        statusDot.title = 'Connection Error';
        statusDot.setAttribute('aria-label', 'Connection Error');
        sessionInfo.classList.add('connection-error');
        if (offlineBanner && offlineBannerText) {
          offlineBannerText.textContent = 'API fetch failed. Check your internet connection.';
          offlineBanner.classList.add('connection-error', 'visible');
        }
      } else {
        statusDot.classList.add('active');
        statusDot.title = 'Online';
        statusDot.setAttribute('aria-label', 'Online');
      }
    }
  }

  window.addEventListener('online', () => { hasConnectionError = false; updateNetworkStatus(); });
  window.addEventListener('offline', () => updateNetworkStatus());
  window.addEventListener('network-error', () => { hasConnectionError = true; updateNetworkStatus(); });
  window.addEventListener('network-success', () => {
    if (hasConnectionError) { hasConnectionError = false; updateNetworkStatus(); }
  });

  updateNetworkStatus();
}
