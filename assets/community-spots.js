// 利用者が教えた店（2026-09-05）。アプリの CommunityPublishPolicy と同じルールで CloudKit の newSpot/ownerApprove を読み、
// 一覧ページでは「利用者が教えた店」の一覧＋地図の緑ピン、spot.html では1店のページを組む。
// ルール: 40m でまとめる／運営の申告か承認があれば即／それ以外は別々の人 ≥ publishMinAuthors かつ（URL あり or 店頭確認 ≥ publishMinOnSiteWitnesses）
//        ／吸える区分が多数／名簿の店の 30m 以内は出さない。店ID = sha256("ugc|lat,lon"(最初の報告・小数5桁)) を UUID v5 風に。
(function () {
  var CK = window.SonomiseCK; if (!CK) return;
  var listRoot = document.getElementById('community-spots');
  var isSpotPage = !!document.getElementById('notfound');
  var SITE = (listRoot || document.getElementById('community') || document.body).getAttribute('data-site') || '';
  var CAT = { smokingPurposeFacility: 'たばこの販売が主な店', smokingRoomOnly: '喫煙専用室あり（飲食は持ち込めない）', smokingAllowedRoom: '席で飲みながら吸える', heatedTobaccoRoom: '加熱式のみ・飲みながら吸える', noSmoking: '禁煙', unknown: '喫煙可否 未確認' };
  var SMOKABLE = { smokingPurposeFacility: 1, smokingRoomOnly: 1, smokingAllowedRoom: 1, heatedTobaccoRoom: 1 };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function dist(a, b) { var R = 6371000, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180, s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2); return 2 * R * Math.asin(Math.sqrt(s)); }
  function centroid(c) { var la = 0, lo = 0; c.forEach(function (r) { la += r.lat; lo += r.lon; }); return { lat: la / c.length, lon: lo / c.length }; }
  function mostCommon(vals) { var n = {}, order = []; vals.forEach(function (v) { if (n[v] == null) { n[v] = 0; order.push(v); } n[v]++; }); var best = order[0]; order.forEach(function (v) { if (n[v] > n[best]) best = v; }); return best; }
  function anchorID(lat, lon) {
    var s = 'ugc|' + lat.toFixed(5) + ',' + lon.toFixed(5);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (buf) {
      var b = Array.from(new Uint8Array(buf)).slice(0, 16); b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80;
      var h = b.map(function (x) { return x.toString(16).padStart(2, '0'); }).join('').toUpperCase();
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    });
  }
  function query(db, opts, limit) { return db.performQuery(opts, { resultsLimit: limit || 200 }).then(function (r) { return r.records || []; }); }
  function seeds() {
    var inline = document.getElementById('spots-data');
    if (inline) { try { return Promise.resolve(JSON.parse(inline.textContent)); } catch (e) {} }
    return fetch(SITE + '/data/spots.json').then(function (r) { return r.json(); }).then(function (arr) { return (arr.spots || arr).map(function (s) { return { lat: s.lat, lon: s.lon }; }); }).catch(function () { return []; });
  }

  function load(db) {
    var owners = {}, minAuthors = 2, minOnSite = 2, hidden = {}, blocked = {};
    return db.fetchRecords('app-config').then(function (res) {
      var f = res.records && res.records[0] && res.records[0].fields || {};
      var raw = f.ownerRecordNames && f.ownerRecordNames.value;
      (typeof raw === 'string' ? raw.split(/[,\s]+/) : (raw || [])).forEach(function (o) { if (o) owners[o] = true; });
      if (f.publishMinAuthors && f.publishMinAuthors.value >= 1) minAuthors = f.publishMinAuthors.value;
      if (f.publishMinOnSiteWitnesses && f.publishMinOnSiteWitnesses.value >= 1) minOnSite = f.publishMinOnSiteWitnesses.value;
    }).catch(function () {}).then(function () {
      return query(db, { recordType: 'Report', filterBy: [{ fieldName: 'kind', comparator: 'IN', fieldValue: { value: ['ownerHide', 'ownerBlock'] } }] }, 500);
    }).then(function (marks) {
      marks.forEach(function (m) { var a = m.created && m.created.userRecordName; if (!owners[a]) return; var t = m.fields && m.fields.text && m.fields.text.value; if (!t) return; if (m.fields.kind.value === 'ownerHide') hidden[t] = true; else blocked[t] = true; });
      return Promise.all([seeds(), query(db, { recordType: 'Report', filterBy: [{ fieldName: 'kind', comparator: 'IN', fieldValue: { value: ['newSpot', 'ownerApprove'] } }], sortBy: [{ fieldName: 'createdAt', ascending: true }] }, 300)]);
    }).then(function (pair) {
      var seedList = pair[0], records = pair[1];
      var reports = records.map(function (r) {
        var f = r.fields || {}; var v = function (k) { return f[k] && f[k].value; };
        return { id: r.recordName, approve: v('kind') === 'ownerApprove', author: (r.created && r.created.userRecordName) || v('authorRecordName') || '',
          name: v('newSpotName') || '', address: v('newSpotAddress') || '', lat: +v('newSpotLat'), lon: +v('newSpotLon'), category: v('newSpotCategory') || 'unknown',
          url: v('sourceURL') || null, at: v('createdAt') || (r.created && r.created.timestamp) || 0 };
      }).filter(function (r) { return isFinite(r.lat) && isFinite(r.lon) && !hidden[r.id] && !blocked[r.author]; }).sort(function (a, b) { return a.at - b.at; });
      var clusters = [];
      reports.forEach(function (r) { for (var i = 0; i < clusters.length; i++) { if (dist(centroid(clusters[i]), r) <= 40) { clusters[i].push(r); return; } } clusters.push([r]); });
      var published = [];
      clusters.forEach(function (c) {
        var reps = c.filter(function (r) { return !r.approve; });
        var ownerBacked = c.some(function (r) { return owners[r.author]; });
        if (!reps.length && !ownerBacked) return;
        var center = centroid(c);
        if (seedList.some(function (s) { return dist(s, center) <= 30; })) return;
        var smokable = reps.filter(function (r) { return SMOKABLE[r.category]; });
        var pool = smokable.length ? smokable : c.filter(function (r) { return r.approve && SMOKABLE[r.category]; });
        if (!pool.length || smokable.length < reps.length - smokable.length) return;
        var authors = {}; reps.forEach(function (r) { authors[r.author] = 1; }); var nAuthors = Object.keys(authors).length;
        var hasURL = reps.some(function (r) { return r.url; });
        var onsite = {}; reps.forEach(function (r) { if (!r.url) onsite[r.author] = 1; });
        if (!(ownerBacked || (nAuthors >= minAuthors && (hasURL || Object.keys(onsite).length >= minOnSite)))) return;
        published.push({ name: mostCommon(c.map(function (r) { return r.name.trim(); })), address: (c.map(function (r) { return r.address.trim(); }).filter(Boolean)[0]) || '',
          lat: center.lat, lon: center.lon, category: mostCommon(pool.map(function (r) { return r.category; })), authorCount: Math.max(nAuthors, 1),
          url: (reps.filter(function (r) { return r.url; })[0] || {}).url || null, latest: Math.max.apply(null, c.map(function (r) { return r.at; })), ownerApproved: ownerBacked,
          anchorLat: c[0].lat, anchorLon: c[0].lon });
      });
      return Promise.all(published.map(function (p) { return anchorID(p.anchorLat, p.anchorLon).then(function (id) { p.id = id; return p; }); }));
    }).then(function (list) {
      // 「最近の投票」（recent.js）が店名を引けるように、店ID→店名を公開する（2026-09-06）。
      // 投票の spotID は anchorID と同じ鍵なので、名簿に無い店でも名前が付く。
      var names = {}; list.forEach(function (p) { if (p.id) names[p.id] = p.name || ''; });
      window.__sonomiseCommunityNames = names;
      if (window.__sonomiseCommunityNamesReady) window.__sonomiseCommunityNamesReady(names);
      return list;
    });
  }

  function renderList(list) {
    if (!listRoot) return;
    listRoot.innerHTML = '';
    listRoot.appendChild(el('h2', null, '利用者が教えた店 ' + list.length + '件'));
    if (!list.length) { listRoot.appendChild(el('p', 'note', 'まだありません。名簿に無い店を見つけたら、上の検索で Apple の地図から候補を出して「この店を教える」を押してください。')); return; }
    listRoot.appendChild(el('p', 'note', '名簿に無い店で、別々の人の確認と出どころがそろったもの（または運営が確認したもの）。緑のピンで地図にも出ています。'));
    var box = el('div', 'list');
    list.sort(function (a, b) { return b.latest - a.latest; }).forEach(function (p) {
      var a = el('a', 'row'); a.href = SITE + '/spot.html?id=' + p.id; a.dataset.n = p.name || ''; a.dataset.a = p.address || '';
      a.appendChild(el('b', null, p.name || '（店名なし）'));
      a.appendChild(el('span', null, (p.address ? p.address + ' ・ ' : '') + (CAT[p.category] || '') + ' ・ ' + (p.ownerApproved ? '運営が確認' : p.authorCount + '人が確認')));
      box.appendChild(a);
    });
    listRoot.appendChild(box);
    if (window.sonomiseApplyFilter) window.sonomiseApplyFilter();
    if (window.sonomiseAddCommunity) window.sonomiseAddCommunity(list); else window.__sonomiseCommunityQueue = list;
  }

  function renderSpot(list) {
    var id = new URLSearchParams(location.search).get('id') || '';
    var p = list.filter(function (x) { return x.id === id; })[0];
    if (!p) { document.getElementById('notfound').hidden = false; document.getElementById('addr').textContent = ''; ['community', 'post'].forEach(function (i) { var e = document.getElementById(i); if (e) e.hidden = true; }); document.getElementById('map').hidden = true; return; }
    document.title = p.name + ' — 利用者が教えた店 | その店、吸える？';
    document.getElementById('title').textContent = p.name;
    var badges = document.getElementById('badges'); badges.appendChild(el('span', 'badge', CAT[p.category] || '未確認')); badges.appendChild(el('span', 'badge muted', p.ownerApproved ? '運営が確認して共有' : '利用者 ' + p.authorCount + '人が確認'));
    document.getElementById('addr').textContent = p.address || '住所は未登録';
    document.getElementById('meta').textContent = '最後の報告: ' + new Date(p.latest).toLocaleDateString('ja-JP');
    var links = document.getElementById('links');
    var m = el('a', 'btn btn-main', 'Apple の地図で開く'); m.href = 'https://maps.apple.com/?q=' + encodeURIComponent(p.name) + '&ll=' + p.lat + ',' + p.lon; links.appendChild(m);
    if (p.url && /^https?:\/\//.test(p.url)) { var u = el('a', 'btn btn-sub', '出どころのページを開く'); u.href = p.url; u.rel = 'nofollow noopener'; links.appendChild(u); }
    var g = el('a', 'btn btn-sub', 'Google で調べる'); g.href = 'https://www.google.com/search?q=' + encodeURIComponent(p.name + ' ' + (p.address || '新潟市')); g.rel = 'nofollow'; links.appendChild(g);
    // 地図（MapKit）: 店1本のピン。community.js / post.js: この店IDで動かす。
    var map = document.getElementById('map'); map.setAttribute('data-lat', p.lat); map.setAttribute('data-lon', p.lon); map.setAttribute('data-name', p.name);
    window.__sonomiseSpotReady = function () { if (window.__mapkitReady && !window.__mapLoaded) { window.__mapLoaded = true; var s = document.createElement('script'); s.src = SITE + '/assets/map.js'; document.body.appendChild(s); } };
    window.__sonomiseSpotReady();
    var c = document.getElementById('community'); c.setAttribute('data-spot-id', p.id); c.setAttribute('data-spot-name', p.name);
    document.getElementById('post').setAttribute('data-spot-id', p.id);
    ['community.js', 'post.js'].forEach(function (f) { var s = document.createElement('script'); s.src = SITE + '/assets/' + f; document.body.appendChild(s); });
  }

  var settled = false;
  setTimeout(function () { if (settled) return; if (listRoot) { listRoot.innerHTML = ''; listRoot.appendChild(el('h2', null, '利用者が教えた店')); listRoot.appendChild(el('p', 'note', 'いまは読み込めませんでした。')); } if (isSpotPage) { document.getElementById('addr').textContent = 'いまは読み込めませんでした。'; } }, 10000);
  CK.whenLoaded(function () {
    var db = CK.db(); if (!db) return;
    load(db).then(function (list) { settled = true; if (isSpotPage) renderSpot(list); else renderList(list); }).catch(function (e) { settled = true; console.warn('community-spots', e); if (listRoot) { listRoot.innerHTML = ''; listRoot.appendChild(el('h2', null, '利用者が教えた店')); listRoot.appendChild(el('p', 'note', 'いまは読み込めませんでした。')); } });
  });
})();
