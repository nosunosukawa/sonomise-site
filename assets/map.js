// Apple の地図（MapKit JS）。一覧ページ: 907件のピン＋検索＋絞り込み＋Apple の地図からの候補。店ページ: 位置の地図。
(function () {
  var token = window.SONOMISE_MAPKIT_TOKEN;
  var mapEl = document.getElementById('map');
  if (!token || !mapEl || !window.mapkit) return;
  var SITE = mapEl.getAttribute('data-site') || '';
  var BROWN = '#5C3B26', GRAY = '#A28B76';
  var NIIGATA = new mapkit.Coordinate(37.9161, 139.0364);

  mapkit.init({ authorizationCallback: function (done) { done(token); }, language: 'ja' });
  var map = new mapkit.Map(mapEl, {
    center: NIIGATA, showsCompass: mapkit.FeatureVisibility.Hidden, showsScale: mapkit.FeatureVisibility.Adaptive,
    isRotationEnabled: false, colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light
  });

  // ---- 店ページ: 1本のピン ----
  var one = mapEl.getAttribute('data-lat');
  if (one) {
    var c = new mapkit.Coordinate(parseFloat(one), parseFloat(mapEl.getAttribute('data-lon')));
    var m = new mapkit.MarkerAnnotation(c, { color: BROWN, glyphText: '☕', title: mapEl.getAttribute('data-name') });
    map.addAnnotation(m);
    map.region = new mapkit.CoordinateRegion(c, new mapkit.CoordinateSpan(0.008, 0.008));
    return;
  }

  // ---- 一覧ページ: 全件 ----
  var spots = [];
  try { spots = JSON.parse(document.getElementById('spots-data').textContent); } catch (e) { return; }
  var BIZ = { coffee: 'コーヒーが主役の店', bar: 'お酒も出る店', other: '業態はまだ分からない店' };
  var annotations = spots.map(function (s) {
    var a = new mapkit.MarkerAnnotation(new mapkit.Coordinate(s.lat, s.lon), {
      color: s.b === 'coffee' ? BROWN : GRAY, glyphText: s.b === 'coffee' ? '☕' : '', title: s.n, subtitle: BIZ[s.b] || '',
      clusteringIdentifier: 'spots', data: s
    });
    a.callout = calloutFor(function (d) { return SITE + '/shops/' + d.id + '.html'; }, '店のページを見る');
    return a;
  });
  map.addAnnotations(annotations);
  map.region = new mapkit.CoordinateRegion(NIIGATA, new mapkit.CoordinateSpan(0.12, 0.12));

  function calloutFor(hrefOf, label) {
    return {
      calloutElementForAnnotation: function (annotation) {
        var d = annotation.data || {};
        var box = document.createElement('div'); box.className = 'callout';
        var h = document.createElement('div'); h.className = 'callout-title'; h.textContent = annotation.title || ''; box.appendChild(h);
        if (annotation.subtitle) { var s = document.createElement('div'); s.className = 'callout-sub'; s.textContent = annotation.subtitle; box.appendChild(s); }
        if (d.a) { var ad = document.createElement('div'); ad.className = 'callout-sub'; ad.textContent = d.a; box.appendChild(ad); }
        var link = document.createElement('a'); link.href = hrefOf(d); link.textContent = label; link.className = 'callout-link'; box.appendChild(link);
        return box;
      }
    };
  }

  // 一覧の絞り込みと同期（shops/index.html の apply() から呼ばれる）
  var candidates = [];
  window.sonomiseMapFilter = function (visibleIDs, query) {
    var set = {}; visibleIDs.forEach(function (id) { set[id] = true; });
    var shown = [];
    annotations.forEach(function (a) { var ok = !!set[a.data.id]; a.visible = ok; if (ok) shown.push(a); });
    map.removeAnnotations(candidates); candidates = [];
    if (shown.length && shown.length <= 60) { map.showItems(shown, { animate: true, padding: new mapkit.Padding(60, 20, 20, 20) }); }
    if (!shown.length && query && query.length >= 2) searchApple(query);
  };

  // 名簿に無いとき、Apple の地図から候補を出す（アプリと同じ。表示だけで保存しない）
  var searchTimer = null;
  function searchApple(query) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var search = new mapkit.Search({ region: new mapkit.CoordinateRegion(NIIGATA, new mapkit.CoordinateSpan(0.5, 0.5)), language: 'ja', includePointsOfInterest: true, includeAddresses: false });
      search.search(query, function (err, data) {
        if (err || !data || !data.places) return;
        var near = data.places.filter(function (p) { return Math.abs(p.coordinate.latitude - NIIGATA.latitude) < 0.35 && Math.abs(p.coordinate.longitude - NIIGATA.longitude) < 0.45; }).slice(0, 5);
        candidates = near.map(function (p) {
          var a = new mapkit.MarkerAnnotation(p.coordinate, { color: '#B49E85', glyphText: '?', title: p.name, subtitle: 'まだ載っていません', data: { a: p.formattedAddress || '' } });
          a.callout = calloutFor(function () { return SITE + '/#app'; }, 'アプリで、この店を教える');
          return a;
        });
        if (candidates.length) { map.addAnnotations(candidates); map.showItems(candidates, { animate: true, padding: new mapkit.Padding(60, 20, 20, 20) }); }
        var note = document.getElementById('count');
        if (note) note.textContent = candidates.length ? '名簿には無い店です。Apple の地図で見つけた ' + candidates.length + ' 件を地図に出しました（吸えるかは未確認）。' : '見つかりませんでした。';
      });
    }, 350);
  }
})();
