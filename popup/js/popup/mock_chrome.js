if (typeof chrome === 'undefined' || !chrome.runtime) {
  window.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: () => {},
      getURL: (path) => path
    },
    storage: {
      local: {
        get: (keys, cb) => {
          const res = {};
          const keysArr = Array.isArray(keys) ? keys : [keys];
          keysArr.forEach(k => {
            try {
              res[k] = JSON.parse(localStorage.getItem(k));
            } catch (_) {
              res[k] = localStorage.getItem(k);
            }
          });
          if (cb) cb(res);
        },
        set: (obj, cb) => {
          Object.keys(obj).forEach(k => {
            localStorage.setItem(k, JSON.stringify(obj[k]));
          });
          if (cb) cb();
        }
      },
      onChanged: { addListener: () => {} }
    },
    windows: {
      getCurrent: (cb) => { if (cb) cb({}); },
      update: () => {},
      create: () => {}
    }
  };
}
