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
    // 置き場は services の下に渡す（configure 直下では無視される。cloudkit.js 実読: `u=config.services; l=u.authTokenStore`・2026-09-07）
    CloudKit.configure({ containers: [{ containerIdentifier: cfg.container, apiTokenAuth: auth, environment: cfg.environment }], services: { authTokenStore: tokenStore() } });
    container = CloudKit.getDefaultContainer();
    configured = true;
    return container;
  }
  // サインインの記憶（ckSession）は localStorage に1つだけ置く（2026-09-06）。
  //
  // ■ なぜ: CloudKit JS の既定は Cookie で、path を付けずに書くので「そのページのフォルダ」に付く。
  //   spot-new.html（/sonomise-site/）と shops/…（/sonomise-site/shops/）で別々にサインインすると
  //   同じ名前の Cookie が2つ並び、CloudKit JS が書いた値と読んだ値の食い違いで AUTH_PERSIST_ERROR
  //   （「Could not read or write ckSession」）になって、読むだけの一覧・最近の投票まで全部消える。
  //   本番1日目に社長の Chrome で実際に起きた。localStorage は origin に1つなので path の問題が無い。
  // ■ 移行: 古い Cookie が1つだけなら値を写してから消す（サインインは保たれる）。2つ以上なら壊れているので全部消す（読むだけなら動く。書くときはサインインし直し）。
  function tokenStore() {
    var key = 'ck.session.' + cfg.container;
    try {
      var found = document.cookie.split('; ').filter(function (c) { return c.indexOf(cfg.container + '=') === 0; }).map(function (c) { return c.slice(cfg.container.length + 1); });
      if (found.length === 1 && !localStorage.getItem(key)) localStorage.setItem(key, found[0]);
      if (found.length) {
        var base = location.pathname.replace(/\/[^\/]*$/, '');
        var paths = ['/', base, base + '/', base.replace(/\/shops$/, ''), base.replace(/\/shops$/, '') + '/'];
        paths.forEach(function (p) { document.cookie = cfg.container + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + p; });
      }
    } catch (e) {}
    return {
      putToken: function (id, token) { try { if (token == null) localStorage.removeItem(key); else localStorage.setItem(key, token); } catch (e) {} },
      getToken: function (id) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    };
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
