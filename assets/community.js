// 店ページに、アプリの投稿（投票のまとめ・ひとこと・写真）を CloudKit から読んで出す。
// 読むだけ（サインイン不要）。運営者の「消す」「止める」の印もここで効かせる。
(function () {
  var cfg = window.SONOMISE_CK;
  var root = document.getElementById('community');
  if (!cfg || !root) return;
  var spotID = root.getAttribute('data-spot-id');
  var VOTE_LABEL = { stillOK: 'いまも吸える', roomOnly: '席では吸えなかった（喫煙室だけ）', heatedOnly: '加熱式だけだった', noLongerOK: '吸えなくなった', closed: '閉店していた' };
  var VOTE_KINDS = Object.keys(VOTE_LABEL);

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtDate(ms) { var d = new Date(ms); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); }

  var owners = {};
  function render(records, hidden, blocked) {
    var votes = {}, comments = [], photos = [], official = null, closedAt = null;
    records.forEach(function (r) {
      var f = r.fields || {};
      var author = (r.created && r.created.userRecordName) || (f.authorRecordName && f.authorRecordName.value) || '';
      if (hidden[r.recordName] || blocked[author]) return;
      var kind = f.kind && f.kind.value;
      var at = r.created && r.created.timestamp;
      // [2026-09-06] 運営の閉店扱い（ownerClose / ownerReopen）。運営の記録だけ、新しい方が勝つ。
      if (kind === 'ownerClose' || kind === 'ownerReopen') {
        if (!owners[author]) return;
        if (closedAt === null || at > closedAt.at) closedAt = { at: at, closed: kind === 'ownerClose' };
        return;
      }
      // 公式情報（運営が店に確かめて載せた分）。運営者以外が送った同じ kind は無視する。一番新しい1件だけ。
      if (kind === 'officialInfo') {
        if (!owners[author] || official) return;
        official = { hours: f.officialHours && f.officialHours.value, comment: f.text && f.text.value, url: f.sourceURL && f.sourceURL.value, at: at };
        var oa = (f.photos && f.photos.value) || [];
        oa.forEach(function (a) { if (a && a.downloadURL) photos.unshift({ url: a.downloadURL, at: at, official: true }); });
        return;
      }
      if (VOTE_KINDS.indexOf(kind) >= 0) votes[kind] = (votes[kind] || 0) + 1;
      if (kind === 'comment' && f.text && f.text.value) comments.push({ text: f.text.value, at: at });
      var assets = (f.photos && f.photos.value) || [];
      assets.forEach(function (a) { if (a && a.downloadURL) photos.push({ url: a.downloadURL, at: at }); });
    });
    root.innerHTML = '';
    if (closedAt && closedAt.closed) {
      var cb = el('div', 'closed'); cb.appendChild(el('strong', null, '閉店（運営確認）')); cb.appendChild(el('span', null, ' この店は閉店、または吸えなくなったことを運営が確かめました（' + fmtDate(closedAt.at) + '）。アプリの地図からは外れています。')); root.appendChild(cb);
    }
    if (official && (official.hours || official.comment || official.url)) {
      var box = el('div', 'official');
      box.appendChild(el('h2', null, '店からのお知らせ'));
      if (official.hours) { var hp = el('p'); hp.appendChild(el('strong', null, '営業時間: ')); hp.appendChild(document.createTextNode(official.hours)); box.appendChild(hp); }
      if (official.comment) box.appendChild(el('p', null, '「' + official.comment + '」'));
      if (official.url && /^https?:\/\//.test(official.url)) { var a = el('a', null, '店の公式ページを開く ›'); a.href = official.url; a.rel = 'nofollow noopener'; box.appendChild(a); }
      box.appendChild(el('p', 'note', '運営が店の代表電話に確認して載せています（' + fmtDate(official.at) + ' 更新）。'));
      root.appendChild(box);
    }
    var h = el('h2', null, '行った人の声'); root.appendChild(h);
    var voteLine = VOTE_KINDS.filter(function (k) { return votes[k]; }).map(function (k) { return VOTE_LABEL[k] + ' ' + votes[k]; }).join('・');
    root.appendChild(el('p', 'votes', voteLine ? '投票: ' + voteLine : 'まだ投票はありません。'));
    if (photos.length) {
      var grid = el('div', 'photos');
      photos.slice(0, 12).forEach(function (p) {
        var img = el('img'); img.src = p.url; img.loading = 'lazy'; img.alt = p.official ? '店から預かった写真' : '利用者が投稿した店の写真'; img.tabIndex = 0; img.setAttribute('role', 'button');
        // [2026-09-06] 押すと拡大（ライトボックス）。Esc か背景で閉じる。
        var open = function () { var box = el('div', 'lightbox'); var big = el('img'); big.src = p.url; big.alt = img.alt; box.appendChild(big); var close = function () { box.remove(); document.removeEventListener('keydown', onKey); }; var onKey = function (ev) { if (ev.key === 'Escape') close(); }; box.addEventListener('click', close); document.addEventListener('keydown', onKey); document.body.appendChild(box); };
        img.addEventListener('click', open); img.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
        grid.appendChild(img);
      });
      root.appendChild(grid);
    }
    if (comments.length) {
      var ul = el('ul', 'comments');
      comments.slice(0, 20).forEach(function (c) { var li = el('li'); li.appendChild(el('span', 'ctext', '「' + c.text + '」')); li.appendChild(el('span', 'cdate', ' ' + fmtDate(c.at))); ul.appendChild(li); });
      root.appendChild(ul);
    }
    root.appendChild(el('p', 'note', '投票・写真はアプリ「その店、吸える？」の利用者が送ったものです。この店に行ったら、アプリから「いまの様子」を教えてください。'));
    var own = el('p', 'note'); var ol = el('a', null, 'この店の店主の方へ: 公式情報の掲載（無料）'); ol.href = (root.getAttribute('data-site') || '') + '/owner.html?spot=' + encodeURIComponent(spotID) + '&name=' + encodeURIComponent(root.getAttribute('data-spot-name') || ''); own.appendChild(ol); root.appendChild(own);
  }

  function query(db, opts) {
    return db.performQuery(opts, { resultsLimit: 200 }).then(function (res) { return res.records || []; });
  }

  // CloudKit が読めない（許可ドメイン外・通信断・スクリプト遮断）ときは、待たせずに案内だけ出す。
  var settled = false;
  setTimeout(function () {
    if (settled) return;
    root.innerHTML = '';
    root.appendChild(el('h2', null, '行った人の声'));
    root.appendChild(el('p', 'note', 'いまは読み込めませんでした。投票と写真はアプリ「その店、吸える？」で見られます。'));
  }, 8000);

  // cloudkit.js は async で、こちらの defer より先に読み終わって 'cloudkitloaded' を出すことがある
  // （店ページに地図を足したあと、8秒の案内に落ちる形で発覚・2026-09-05）。もう居るなら即、まだなら合図を待つ。
  if (window.CloudKit) { start(); } else { window.addEventListener('cloudkitloaded', start); }

  function start() {
    try {
      var db;
      if (window.SonomiseCK) { db = window.SonomiseCK.db(); }
      else { CloudKit.configure({ containers: [{ containerIdentifier: cfg.container, apiTokenAuth: { apiToken: cfg.apiToken, persist: false }, environment: cfg.environment }] }); db = CloudKit.getDefaultContainer().publicCloudDatabase; }
      if (!db) throw new Error('no db');
      owners = {};
      db.fetchRecords('app-config').then(function (res) {
        var rec = res.records && res.records[0];
        var raw = rec && rec.fields && rec.fields.ownerRecordNames && rec.fields.ownerRecordNames.value;
        (typeof raw === 'string' ? raw.split(/[,\s]+/) : (raw || [])).forEach(function (o) { if (o) owners[o] = true; });
      }).catch(function () {}).then(function () {
        return query(db, { recordType: 'Report', filterBy: [{ fieldName: 'kind', comparator: 'IN', fieldValue: { value: ['ownerHide', 'ownerBlock'] } }] });
      }).then(function (marks) {
        var hidden = {}, blocked = {};
        marks.forEach(function (m) {
          var who = m.created && m.created.userRecordName; if (!owners[who]) return;
          var t = m.fields && m.fields.text && m.fields.text.value; if (!t) return;
          if (m.fields.kind.value === 'ownerHide') hidden[t] = true; else blocked[t] = true;
        });
        return query(db, { recordType: 'Report', filterBy: [
          { fieldName: 'spotID', comparator: 'EQUALS', fieldValue: { value: spotID } },
          { fieldName: 'kind', comparator: 'IN', fieldValue: { value: VOTE_KINDS.concat(['comment', 'officialInfo', 'ownerClose', 'ownerReopen']) } }
        ], sortBy: [{ fieldName: 'createdAt', ascending: false }] }).then(function (records) { settled = true; render(records, hidden, blocked); });
      }).catch(function () { settled = true; root.innerHTML = ''; });
    } catch (e) { root.innerHTML = ''; }
  }
})();
