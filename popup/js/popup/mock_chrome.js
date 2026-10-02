if (typeof chrome === 'undefined' || !chrome.runtime) {
  const runtimeListeners = new Set();
  const storageListeners = new Set();

  const readValue = key => {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const readStorage = keys => {
    const result = {};
    if (keys == null) {
      Object.keys(localStorage).forEach(key => { result[key] = readValue(key); });
      return result;
    }

    if (typeof keys === 'string') {
      result[keys] = readValue(keys);
      return result;
    }

    if (Array.isArray(keys)) {
      keys.forEach(key => { result[key] = readValue(key); });
      return result;
    }

    Object.entries(keys).forEach(([key, fallback]) => {
      const value = readValue(key);
      result[key] = value === undefined ? fallback : value;
    });
    return result;
  };

  const respond = (callback, value) => {
    queueMicrotask(() => callback?.(value));
    return Promise.resolve(value);
  };

  const runtime = {
    lastError: null,
    onMessage: {
      addListener: listener => runtimeListeners.add(listener),
      removeListener: listener => runtimeListeners.delete(listener)
    },
    sendMessage(message, callback) {
      if (message?.action === 'reviewWord') {
        return import('../../../shared/storage/reviews.js').then(async ({ reviewWord }) => {
          const card = await reviewWord(message.wordId, message.q, message.typedWrongWord, message.responseTimeMs, message.mode);
          return respond(callback, { success: true, card });
        }).catch(error => respond(callback, { success: false, error: error.message }));
      }
      if (message?.action === 'getAiJobStatus') {
        return respond(callback, { success: true, job: readValue('spelt_ai_job') || null });
      }
      if (message?.action === 'cancelAiJob') {
        const job = readValue('spelt_ai_job');
        if (job?.id === message.jobId) {
          const cancelled = { ...job, status: 'cancelled', cancelRequested: true, finishedAt: Date.now() };
          localStorage.setItem('spelt_ai_job', JSON.stringify(cancelled));
          return respond(callback, { success: true, job: cancelled });
        }
        return respond(callback, { success: false, error: 'AI job not found.' });
      }
      if (message?.action === 'startAiJob') {
        return respond(callback, { success: false, error: 'Background AI is available when Spelt runs as an extension.' });
      }

      for (const listener of runtimeListeners) {
        let asyncResponse = false;
        const result = listener(message, {}, response => respond(callback, response));
        if (result === true) asyncResponse = true;
        else if (result !== undefined) return respond(callback, result);
        if (asyncResponse) return Promise.resolve();
      }
      return respond(callback, { success: false, error: 'This action needs the extension service worker.' });
    },
    getURL: path => new URL(`/${String(path).replace(/^\/+/, '')}`, window.location.origin).href
  };

  const storage = {
    local: {
      get(keys, callback) {
        return respond(callback, readStorage(keys));
      },
      set(values, callback) {
        const changes = {};
        Object.entries(values).forEach(([key, value]) => {
          const oldValue = readValue(key);
          localStorage.setItem(key, JSON.stringify(value));
          changes[key] = { oldValue, newValue: value };
        });
        queueMicrotask(() => storageListeners.forEach(listener => listener(changes, 'local')));
        return respond(callback);
      },
      remove(keys, callback) {
        const changes = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(key => {
          const oldValue = readValue(key);
          localStorage.removeItem(key);
          changes[key] = { oldValue, newValue: undefined };
        });
        queueMicrotask(() => storageListeners.forEach(listener => listener(changes, 'local')));
        return respond(callback);
      }
    },
    onChanged: {
      addListener: listener => storageListeners.add(listener),
      removeListener: listener => storageListeners.delete(listener)
    }
  };

  window.chrome = {
    runtime,
    storage,
    tabs: {
      create: ({ url }) => window.open(url, '_blank', 'noopener')
    },
    windows: {
      getCurrent: callback => respond(callback, {}),
      update: () => Promise.resolve(),
      create: () => Promise.resolve()
    }
  };
}
