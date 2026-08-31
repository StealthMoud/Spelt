export function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response?.success) {
        reject(new Error(response?.error || 'The background task could not be completed.'));
      } else {
        resolve(response);
      }
    });
  });
}

export async function startAiJob(payload) {
  const response = await sendRuntimeMessage({ action: 'startAiJob', payload });
  return response.job;
}

export async function cancelAiJob(jobId) {
  const response = await sendRuntimeMessage({ action: 'cancelAiJob', jobId });
  return response.job;
}

export async function getAiJobStatus() {
  const response = await sendRuntimeMessage({ action: 'getAiJobStatus' });
  return response.job;
}

export function subscribeToAiJob(callback) {
  const listener = message => {
    if (message?.action === 'aiJobProgress') callback(message.job);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
