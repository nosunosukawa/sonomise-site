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

  function render(records, hidden, blocked) {
    var votes = {}, comments = [], photos = [];
    records.forEach(function (r) {
      var f = r.fields || {};
      var author = (r.created && r.created.userRecordName) || (f.authorRecordName && f.authorRecordName.value) || '';
      if (hidden[r.recordName] || blocked[author]) return;
      var kind = f.kind && f.kind.value;
      var at = r.created && r.created.timestamp;
      if (VOTE_KINDS.indexOf(kind) >= 0) votes[kind] = (votes[kind] || 0) + 1;
      if (kind === 'comment' && f.text && f.text.value) comments.push({ text: f.text.value, at: at });
      var assets = (f.photos && f.photos.value) || [];
      assets.forEach(function (a) { if (a && a.downloadURL) photos.push({ url: a.downloadURL, at: at }); });
    });
    root.innerHTML = '';
    var h = el('h2', null, '行った人の声'); root.appendChild(h);
    var voteLine = VOTE_KINDS.filter(function (k) { return votes[k]; }).map(function (k) { return VOTE_LABEL[k] + ' ' + votes[k]; }).join('・');
    root.appendChild(el('p', 'votes', voteLine ? '投票: ' + voteLine : 'まだ投票はありません。'));
    if (photos.length) {
      var grid = el('div', 'photos');
      photos.slice(0, 12).forEach(function (p) { var img = el('img'); img.src = p.url; img.loading = 'lazy'; img.alt = '利用者が投稿した店の写真'; grid.appendChild(img); });
      root.appendChild(grid);
    }
    if (comments.length) {
      var ul = el('ul', 'comments');
      comments.slice(0, 20).forEach(function (c) { var li = el('li'); li.appendChild(el('span', 'ctext', '「' + c.text + '」')); li.appendChild(el('span', 'cdate', ' ' + fmtDate(c.at))); ul.appendChild(li); });
      root.appendChild(ul);
    }
    root.appendChild(el('p', 'note', '投票・写真はアプリ「その店、吸える？」の利用者が送ったものです。この店に行ったら、アプリから「いまの様子」を教えてください。'));
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
      CloudKit.configure({ containers: [{ containerIdentifier: cfg.container, apiTokenAuth: { apiToken: cfg.apiToken, persist: false }, environment: cfg.environment }] });
      var db = CloudKit.getDefaultContainer().publicCloudDatabase;
      var owners = {};
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
          { fieldName: 'kind', comparator: 'IN', fieldValue: { value: VOTE_KINDS.concat(['comment']) } }
        ], sortBy: [{ fieldName: 'createdAt', ascending: false }] }).then(function (records) { settled = true; render(records, hidden, blocked); });
      }).catch(function () { settled = true; root.innerHTML = ''; });
    } catch (e) { root.innerHTML = ''; }
  }
})();
