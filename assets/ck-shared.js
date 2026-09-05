// CloudKit JS を1ページで1回だけ configure し、サインインの状態をページ内で共有する（2026-09-05）。
// 読むだけの部品（community.js）も、書く部品（post.js / spot-new.js / owner.js）も、ここを通る。
window.SonomiseCK = (function () {
  var cfg = window.SONOMISE_CK;
  var configured = false, container = null, user = null, listeners = [], authStarted = false;
  function ensure() {
    if (configured) return container;
    if (!window.CloudKit || !cfg) return null;
    var auth = { apiToken: cfg.apiToken, persist: true };
    if (document.getElementById('apple-sign-in-button')) auth.signInButton = { id: 'apple-sign-in-button', theme: 'black' };
    if (document.getElementById('apple-sign-out-button')) auth.signOutButton = { id: 'apple-sign-out-button', theme: 'black' };
    CloudKit.configure({ containers: [{ containerIdentifier: cfg.container, apiTokenAuth: auth, environment: cfg.environment }] });
    container = CloudKit.getDefaultContainer();
    configured = true;
    return container;
  }
  function whenLoaded(cb) { if (window.CloudKit) cb(); else window.addEventListener('cloudkitloaded', cb); }
  function set(u) { user = u || null; listeners.forEach(function (l) { try { l(user); } catch (e) {} }); }
  function startAuth() {
    var c = ensure();
    if (!c || authStarted) return;
    authStarted = true;
    function loop(p) {
      return p.then(function (u) { set(u); return u ? c.whenUserSignsOut() : c.whenUserSignsIn(); }).then(loop)
        .catch(function () { set(null); listeners.forEach(function (l) { try { l(null, 'error'); } catch (e) {} }); });
    }
    loop(c.setUpAuth());
  }
  return {
    db: function () { var c = ensure(); return c ? c.publicCloudDatabase : null; },
    whenLoaded: whenLoaded,
    startAuth: startAuth,
    onAuth: function (cb) { listeners.push(cb); if (configured) cb(user); },
    user: function () { return user; },
    // 送る前の共通の型付け（CloudKit JS は型を明示しないと数字が INT64 になることがある）
    str: function (v) { return { value: String(v), type: 'STRING' }; },
    dbl: function (v) { return { value: Number(v), type: 'DOUBLE' }; },
    now: function () { return { value: Date.now(), type: 'TIMESTAMP' }; }
  };
})();
