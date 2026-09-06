// 店ページの「この店に行った？」投票フォーム（2026-09-05）。Apple ID でサインインして Report を送る。
// アプリと同じレコード（kind / spotID / text / sourceKind / authorRecordName / createdAt）なので、アプリにもそのまま出る。
(function () {
  var root = document.getElementById('post');
  var CK = window.SonomiseCK;
  if (!root || !CK) return;
  var spotID = root.getAttribute('data-spot-id');
  var SITE = root.getAttribute('data-site') || '';
  var VOTES = [['stillOK', 'いまも吸える'], ['roomOnly', '席では吸えなかった（喫煙室だけ）'], ['heatedOnly', '加熱式だけだった'], ['noLongerOK', '吸えなくなった'], ['closed', '閉店していた']];
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  root.innerHTML = '';
  root.appendChild(el('h2', null, 'この店に行った？ いまの様子を教える'));
  root.appendChild(el('p', 'note', '行って確かめたことだけを送ってください。アプリの利用者にもそのまま届きます。'));
  var form = el('form'); form.noValidate = true;
  var fs = el('div', 'radios');
  VOTES.forEach(function (v) {
    var lab = el('label', 'radio'); var inp = el('input'); inp.type = 'radio'; inp.name = 'kind'; inp.value = v[0];
    lab.appendChild(inp); lab.appendChild(document.createTextNode(' ' + v[1])); fs.appendChild(lab);
  });
  form.appendChild(fs);
  var ta = el('textarea'); ta.maxLength = 140; ta.placeholder = 'ひとこと（任意・140字。URLは書けません）'; ta.rows = 3; ta.className = 'ta';
  form.appendChild(ta);
  var signin = el('div'); signin.id = 'apple-sign-in-button'; form.appendChild(signin);
  var signout = el('div'); signout.id = 'apple-sign-out-button'; signout.hidden = true; form.appendChild(signout);
  var btn = el('button', 'btn btn-main', '送る'); btn.type = 'submit'; btn.disabled = true; form.appendChild(btn);
  var status = el('p', 'note'); status.setAttribute('role', 'status'); form.appendChild(status);
  var terms = el('p', 'note'); terms.appendChild(document.createTextNode('送ると')); var tl = el('a', null, '利用規約'); tl.href = SITE + '/terms.html'; terms.appendChild(tl); terms.appendChild(document.createTextNode('に同意したことになります。個人情報や人を傷つける内容は書かないでください。'));
  form.appendChild(terms);
  root.appendChild(form);

  var signedIn = false;
  function say(t, ok) { status.textContent = t; status.className = ok ? 'note ok' : 'note'; }
  function chosen() { var c = form.querySelector('input[name=kind]:checked'); return c ? c.value : null; }
  function refresh() { btn.disabled = !(signedIn && chosen()); }
  form.addEventListener('change', refresh);

  CK.whenLoaded(function () {
    CK.onAuth(function (u, err) {
      signedIn = !!u; signout.hidden = !u; refresh();
      if (err) say('いまはサインインできませんでした。アプリからも投票できます。');
      else if (u) say('サインインしました。当てはまるものを選んで「送る」を押してください。');
      else say('');
    });
    CK.startAuth();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var kind = chosen(); var u = CK.user(); var db = CK.db();
    if (!kind || !u || !db) return;
    var text = ta.value.replace(/\s+/g, ' ').trim();
    if (/https?:\/\/|www\./i.test(text)) { say('ひとことに URL は書けません。'); return; }
    var key = 'voted:' + spotID + ':' + new Date().toDateString();
    try { if (localStorage.getItem(key)) { say('この店には今日すでに送っています。'); return; } } catch (x) {}
    btn.disabled = true; say('送っています…');
    var author = u.userRecordName;
    var records = [{ recordType: 'Report', fields: { kind: CK.str(kind), spotID: CK.str(spotID), sourceKind: CK.str('onSite'), authorRecordName: CK.str(author), createdAt: CK.now() } }];
    if (text) records.push({ recordType: 'Report', fields: { kind: CK.str('comment'), spotID: CK.str(spotID), text: CK.str(text.slice(0, 140)), authorRecordName: CK.str(author), createdAt: CK.now() } });
    db.saveRecords(records).then(function (res) {
      if (res.hasErrors) throw res.errors[0];
      try { localStorage.setItem(key, '1'); } catch (x) {}
      say('ありがとうございます。受け付けました。', true);
      setTimeout(function () { location.reload(); }, 1500);
    }).catch(function (err) {
      btn.disabled = false;
      // サインインの記憶が古くて Apple に断られた（AUTHENTICATION_REQUIRED）ときは、記憶を捨ててサインインし直してもらう（2026-09-07）。
      // 9/7 に社長の Chrome で発生: 画面は「サインイン済み」なのに送ると「request needs authorization」。
      if (err && err.ckErrorCode === 'AUTHENTICATION_REQUIRED') { CK.signOut(); say('サインインの期限が切れていました。もう一度「Sign in with Apple ID」を押してから送ってください。'); return; }
      say('送れませんでした（' + ((err && (err.reason || err.message)) || '通信エラー') + '）。時間をおいてもう一度、またはアプリからお願いします。');
    });
  });
})();
