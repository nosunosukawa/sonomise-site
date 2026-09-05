// 「この店を教える」（2026-09-05）。Apple の地図の候補（spot-new.html?name&addr&lat&lon）から newSpot の申告を送る。
// アプリと同じレコードなので、アプリ側の人数・証拠のルール（CommunityPublishPolicy）でそのまま載る／待つ。
(function () {
  var CK = window.SonomiseCK; var root = document.getElementById('newspot'); if (!CK || !root) return;
  var q = new URLSearchParams(location.search);
  var lat = parseFloat(q.get('lat')), lon = parseFloat(q.get('lon'));
  var name = (q.get('name') || '').trim(), addr = (q.get('addr') || '').trim();
  var form = document.getElementById('nsform'), status = document.getElementById('nsstatus'), send = document.getElementById('nssend');
  var urlIn = document.getElementById('nsurl'), nameIn = document.getElementById('nsn');
  function say(t, ok) { status.textContent = t; status.className = ok ? 'note ok' : 'note'; }
  document.getElementById('nsname').textContent = name || '店';
  document.getElementById('nsaddr').textContent = addr;
  nameIn.value = name;
  if (!(isFinite(lat) && isFinite(lon))) { say('場所が分かりません。店をさがすページの地図で店を選んでから来てください。'); form.hidden = true; return; }
  function src() { var c = form.querySelector('input[name=src]:checked'); return c ? c.value : 'onSite'; }
  function valid() {
    var n = nameIn.value.trim(); if (n.length < 1 || n.length > 60) return false;
    if (src() === 'url' && !/^https?:\/\/\S+$/.test(urlIn.value.trim())) return false;
    return true;
  }
  var signedIn = false;
  function refresh() { urlIn.hidden = src() !== 'url'; send.disabled = !(signedIn && valid()); }
  ['input', 'change'].forEach(function (ev) { form.addEventListener(ev, refresh); });
  refresh();
  CK.whenLoaded(function () {
    CK.onAuth(function (u, err) {
      signedIn = !!u; document.getElementById('apple-sign-out-button').hidden = !u; refresh();
      if (err) say('いまはサインインできませんでした。アプリからも教えられます。');
      else if (u) say('サインインしました。内容を確かめて「教える」を押してください。');
    });
    CK.startAuth();
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var u = CK.user(), db = CK.db(); if (!u || !db || !valid()) return;
    send.disabled = true; say('送っています…');
    var cat = (form.querySelector('input[name=cat]:checked') || {}).value || 'smokingAllowedRoom';
    var fields = {
      kind: CK.str('newSpot'), newSpotName: CK.str(nameIn.value.trim()), newSpotAddress: CK.str(addr),
      newSpotLat: CK.dbl(lat), newSpotLon: CK.dbl(lon), newSpotCategory: CK.str(cat),
      sourceKind: CK.str(src()), authorRecordName: CK.str(u.userRecordName), createdAt: CK.now()
    };
    if (src() === 'url') fields.sourceURL = CK.str(urlIn.value.trim());
    db.saveRecords([{ recordType: 'Report', fields: fields }]).then(function (res) {
      if (res.hasErrors) throw res.errors[0];
      say('ありがとうございます。受け付けました。別の人の確認か出どころがそろうと載ります。', true);
    }).catch(function (err) {
      send.disabled = false;
      say('送れませんでした（' + ((err && (err.reason || err.message)) || '通信エラー') + '）。時間をおいてもう一度、またはアプリからお願いします。');
    });
  });
})();
