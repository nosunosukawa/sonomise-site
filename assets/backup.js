// 運営用の控え（2026-09-05）。Public DB の全レコード型を続きマーカーで最後まで読み、1つの JSON にする。
(function () {
  var CK = window.SonomiseCK, run = document.getElementById('run'), dl = document.getElementById('dl'), log = document.getElementById('log');
  if (!CK || !run) return;
  var TYPES = ['Report', 'ContentReport', 'OwnerClaim', 'AppConfig'];
  function say(t) { log.textContent += t + '\n'; }
  function readAll(db, type) {
    var out = [];
    function page(marker) {
      var opts = { recordType: type };
      if (marker) opts.continuationMarker = marker;
      return db.performQuery(opts, { resultsLimit: 200 }).then(function (res) {
        (res.records || []).forEach(function (r) {
          var f = {}; Object.keys(r.fields || {}).forEach(function (k) { var v = r.fields[k].value; f[k] = (r.fields[k].type === 'ASSETID' || (v && v.downloadURL)) ? { asset: true, size: v && v.size } : v; });
          out.push({ recordName: r.recordName, recordType: r.recordType, created: r.created, modified: r.modified, fields: f });
        });
        say(type + ': ' + out.length + '件');
        return res.moreComing && res.continuationMarker ? page(res.continuationMarker) : out;
      });
    }
    return page(null).catch(function (e) { say(type + ': 読めませんでした（' + ((e && (e.reason || e.message)) || '型が無い') + '）'); return out; });
  }
  run.addEventListener('click', function () {
    run.disabled = true; log.textContent = ''; dl.hidden = true;
    CK.whenLoaded(function () {
      var db = CK.db(); if (!db) { say('CloudKit を読み込めませんでした。'); run.disabled = false; return; }
      var result = { takenAt: new Date().toISOString(), container: window.SONOMISE_CK.container, environment: window.SONOMISE_CK.environment, records: {} };
      TYPES.reduce(function (p, t) { return p.then(function () { return readAll(db, t).then(function (rs) { result.records[t] = rs; }); }); }, Promise.resolve()).then(function () {
        var blob = new Blob([JSON.stringify(result, null, 1)], { type: 'application/json' });
        dl.href = URL.createObjectURL(blob); dl.download = 'sonomise-backup-' + new Date().toISOString().slice(0, 10) + '.json'; dl.hidden = false;
        say('できました。写真の中身は含みません（CloudKit に残ります）。'); run.disabled = false;
      });
    });
  });
})();
