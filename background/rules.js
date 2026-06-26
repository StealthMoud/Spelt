export async function setupRules() {
  if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(r => r.id);
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
        addRules: [
          {
            id: 1,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                { header: "Origin", operation: "remove" },
                { header: "Referer", operation: "set", value: "https://dictionary.cambridge.org/" },
                { header: "Sec-Fetch-Mode", operation: "remove" },
                { header: "Sec-Fetch-Site", operation: "remove" }
              ]
            },
            condition: {
              urlFilter: "||dictionary.cambridge.org"
            }
          }
        ]
      });
      console.log("Spelt: Registered declarativeNetRequest header rules for Cambridge Dictionary.");
    } catch (err) {
      console.error("Spelt: Failed to register declarativeNetRequest rules:", err);
    }
  }
}

export function registerContextMenu() {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'add-to-spelt',
      title: 'Add "%s" to Spelt Vault',
      contexts: ['selection']
    });
  });
}
