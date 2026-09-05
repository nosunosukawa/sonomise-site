// 一覧ページの「最近の投票」（2026-09-05）。アプリと Web から届いた投票・ひとことの新しい順 15 件。運営の印で隠す。
(function () {
  var CK = window.SonomiseCK, root = document.getElementById('recent'); if (!CK || !root) return;
  var SITE = root.getAttribute('data-site') || '';
  var LABEL = { stillOK: 'いまも吸える', roomOnly: '席では吸えなかった', heatedOnly: '加熱式だけだった', noLongerOK: '吸えなくなった', closed: '閉店していた', comment: 'ひとこと' };
  var names = {};
  try { JSON.parse(document.getElementById('spots-data').textContent).forEach(function (s) { names[s.id] = s.n; }); } catch (e) {}
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(ms) { var d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate(); }
  function q(db, opts, n) { return db.performQuery(opts, { resultsLimit: n }).then(function (r) { return r.records || []; }); }
  CK.whenLoaded(function () {
    var db = CK.db(); if (!db) return;
    var owners = {}, hidden = {}, blocked = {};
    db.fetchRecords('app-config').then(function (res) {
      var raw = res.records && res.records[0] && res.records[0].fields.ownerRecordNames && res.records[0].fields.ownerRecordNames.value;
      (typeof raw === 'string' ? raw.split(/[,\s]+/) : (raw || [])).forEach(function (o) { if (o) owners[o] = true; });
    }).catch(function () {}).then(function () {
      return q(db, { recordType: 'Report', filterBy: [{ fieldName: 'kind', comparator: 'IN', fieldValue: { value: ['ownerHide', 'ownerBlock'] } }] }, 300);
    }).then(function (marks) {
      marks.forEach(function (m) { if (!owners[m.created && m.created.userRecordName]) return; var t = m.fields.text && m.fields.text.value; if (!t) return; if (m.fields.kind.value === 'ownerHide') hidden[t] = true; else blocked[t] = true; });
      return q(db, { recordType: 'Report', filterBy: [{ fieldName: 'kind', comparator: 'IN', fieldValue: { value: Object.keys(LABEL) } }], sortBy: [{ fieldName: 'createdAt', ascending: false }] }, 40);
    }).then(function (recs) {
      var rows = recs.filter(function (r) { return !hidden[r.recordName] && !blocked[r.created && r.created.userRecordName]; }).slice(0, 15);
      root.innerHTML = '';
      root.appendChild(el('h2', null, '最近の投票'));
      if (!rows.length) { root.appendChild(el('p', 'note', 'まだ投票はありません。行った店のページから送れます。')); return; }
      var ul = el('ul', 'comments');
      rows.forEach(function (r) {
        var f = r.fields, kind = f.kind.value, sid = f.spotID && f.spotID.value, name = names[sid];
        var li = el('li');
        var a = el('a', null, name || '利用者が教えた店'); a.href = name ? SITE + '/shops/' + sid + '.html' : SITE + '/spot.html?id=' + encodeURIComponent(sid || '');
        li.appendChild(a); li.appendChild(document.createTextNode(' — ' + (LABEL[kind] || kind)));
        if (kind === 'comment' && f.text && f.text.value) li.appendChild(el('span', 'ctext', '「' + f.text.value + '」'));
        li.appendChild(el('span', 'cdate', ' ' + fmt((f.createdAt && f.createdAt.value) || (r.created && r.created.timestamp))));
        ul.appendChild(li);
      });
      root.appendChild(ul);
    }).catch(function () { root.innerHTML = ''; });
  });
})();
