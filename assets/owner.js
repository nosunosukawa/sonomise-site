// 店主の申請フォーム（2026-09-05）。CloudKit JS で Apple ID サインインのうえ OwnerClaim を Public DB に保存する。
// サインインできない環境では、メールの下書きに同じ内容を入れる。
(function () {
  var cfg = window.SONOMISE_CK;
  var form = document.getElementById('claim');
  var status = document.getElementById('status');
  var send = document.getElementById('send');
  var agree = document.getElementById('agree');
  var params = new URLSearchParams(location.search);
  var spotID = params.get('spot') || '';
  var spotName = params.get('name') || '';
  var pick = document.getElementById('spotpick');
  if (spotID && spotName) {
    pick.innerHTML = '店: <strong></strong>（店ページから）';
    pick.querySelector('strong').textContent = spotName;
    if (!form.shopName.value) form.shopName.value = spotName;
  }

  function say(text, ok) { status.textContent = text; status.className = ok ? 'hint ok' : 'hint'; }
  function valid() {
    return form.shopName.value.trim().length >= 1 && form.phone.value.replace(/[^0-9+]/g, '').length >= 10 && agree.checked;
  }
  function refreshMail() {
    var body = '店名: ' + form.shopName.value.trim() + '\n店の代表電話: ' + form.phone.value.trim() +
      '\n載せたい内容: ' + form.message.value.trim() + (spotID ? '\n店ID: ' + spotID : '') +
      '\n\n私はこの店の運営者（または店から任された方）で、代表電話への確認に応じます。';
    document.getElementById('mailto').href = 'mailto:nosunosukawa@gmail.com?subject=' +
      encodeURIComponent('【店主申請】' + form.shopName.value.trim()) + '&body=' + encodeURIComponent(body);
  }
  ['input', 'change'].forEach(function (ev) { form.addEventListener(ev, function () { refreshMail(); if (signedIn) send.disabled = !valid(); }); });
  refreshMail();

  var signedIn = false;
  var db = null;
  function start() {
    if (!window.CloudKit || !cfg) return;
    document.getElementById('ck-area').hidden = false;
    CloudKit.configure({ containers: [{
      containerIdentifier: cfg.container,
      apiTokenAuth: { apiToken: cfg.apiToken, persist: true,
        signInButton: { id: 'apple-sign-in-button', theme: 'black' },
        signOutButton: { id: 'apple-sign-out-button', theme: 'black' } },
      environment: cfg.environment
    }] });
    var container = CloudKit.getDefaultContainer();
    db = container.publicCloudDatabase;
    function onIn() { signedIn = true; send.disabled = !valid(); document.getElementById('apple-sign-out-button').hidden = false; say('サインインしました。内容を確かめて「申請を送る」を押してください。'); return container.whenUserSignsOut(); }
    function onOut() { signedIn = false; send.disabled = true; document.getElementById('apple-sign-out-button').hidden = true; say(''); return container.whenUserSignsIn(); }
    function loop(p) { return p.then(function (u) { return u ? onIn() : onOut(); }).then(loop).catch(function () { say('いまはサインインできませんでした。メールでの申請をご利用ください。'); }); }
    loop(container.setUpAuth());
  }
  if (window.CloudKit) start(); else window.addEventListener('cloudkitloaded', start);
  setTimeout(function () { if (!window.CloudKit) say('送信フォームを読み込めませんでした。メールでの申請をご利用ください。'); }, 8000);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!signedIn || !db) { say('Apple ID でサインインしてください。'); return; }
    if (!valid()) { say('店名・店の代表電話（10桁以上）・確認のチェックが必要です。'); return; }
    send.disabled = true;
    say('送っています…');
    var fields = {
      spotID: { value: spotID },
      shopName: { value: form.shopName.value.trim() },
      phone: { value: form.phone.value.trim() },
      message: { value: form.message.value.trim() },
      createdAt: { value: Date.now() }
    };
    db.saveRecords({ recordType: 'OwnerClaim', fields: fields }).then(function (res) {
      if (res.hasErrors) throw res.errors[0];
      say('申請を受け付けました。数日以内に店の代表電話へお電話します。', true);
      form.reset(); if (spotName) form.shopName.value = spotName; refreshMail();
    }).catch(function (err) {
      send.disabled = false;
      say('送れませんでした（' + ((err && (err.reason || err.message)) || '通信エラー') + '）。メールでの申請をご利用ください。');
    });
  });
})();
