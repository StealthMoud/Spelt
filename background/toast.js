// Reusable helper to display a premium, non-intrusive Glassmorphic toast in the tab, falling back to chrome.notifications if injection is blocked.
export async function showToastInTab(tabId, message, isSuccess = true) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg, success) => {
        let container = document.getElementById('spelt-toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'spelt-toast-container';
          container.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          `;
          document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.cssText = `
          background: rgba(16, 20, 24, 0.94);
          border: 1px solid ${success ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'};
          color: #ffffff;
          padding: 12px 18px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px ${success ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'};
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          gap: 8px;
          transform: translateY(-20px);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: auto;
        `;

        const iconSvg = success 
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

        toast.innerHTML = `
          ${iconSvg}
          <span style="font-family: inherit;">${msg}</span>
        `;

        container.appendChild(toast);
        toast.offsetHeight;

        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';

        setTimeout(() => {
          toast.style.transform = 'translateY(-20px)';
          toast.style.opacity = '0';
          setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) {
              container.remove();
            }
          }, 300);
        }, 3000);
      },
      args: [message, isSuccess]
    });
  } catch (err) {
    console.warn('Could not inject toast, falling back to chrome.notifications:', err);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: isSuccess ? 'Added to Spelt Vault' : 'Spelt Vault Error',
      message: message
    });
  }
}
