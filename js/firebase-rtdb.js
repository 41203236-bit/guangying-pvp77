(function () {
  const cfg = window.LightShadowFirebaseConfig;

  function createMissingResult(reason) {
    return { ok: false, reason };
  }

  if (!cfg || !cfg.apiKey || !cfg.databaseURL) {
    window.LightShadowFirebase = {
      isReady: false,
      db: null,
      error: 'missing-config',
      getStatus() { return createMissingResult('missing-config'); }
    };
    return;
  }

  if (!window.firebase || !window.firebase.initializeApp) {
    window.LightShadowFirebase = {
      isReady: false,
      db: null,
      error: 'missing-sdk',
      getStatus() { return createMissingResult('missing-sdk'); }
    };
    return;
  }

  let app;
  if (window.firebase.apps && window.firebase.apps.length > 0) {
    app = window.firebase.app();
  } else {
    app = window.firebase.initializeApp(cfg);
  }

  const db = window.firebase.database(app);
  const databaseURL = String(cfg.databaseURL || '').replace(/\/$/, '');

  function buildRestUrl(path) {
    return `${databaseURL}/${String(path || '').replace(/^\//, '')}.json`;
  }

  function restRequest(path, method, value, options) {
    const init = {
      method,
      keepalive: !!(options && options.keepalive),
      headers: { 'Content-Type': 'application/json' }
    };
    if (value !== undefined) init.body = JSON.stringify(value);
    return window.fetch(buildRestUrl(path), init);
  }

  function restPut(path, value, options) {
    return restRequest(path, 'PUT', value, options);
  }

  function restDelete(path, options) {
    return restRequest(path, 'DELETE', undefined, options);
  }

  window.LightShadowFirebase = {
    isReady: true,
    app,
    db,
    error: '',
    getStatus() { return { ok: true }; },
    restPut,
    restDelete,
    buildRestUrl
  };
})();
