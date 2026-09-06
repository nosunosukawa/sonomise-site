// 店ページ（shops/<店ID>.html）・一覧（shops/index.html）・sitemap.xml を data/spots.json から作る（2026-09-05）。
// 店IDはアプリと同じ（名前|住所 の SHA-256 先頭16バイトを UUID v5 風に整形）。投票・写真はこのIDで CloudKit から引く。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SITE = 'https://nosunosukawa.github.io/sonomise-site';
const spots = JSON.parse(readFileSync('data/spots.json', 'utf8'));
const CATEGORY = {
  smokingPurposeFacility: '店内で吸える（喫煙目的店）',
  smokingRoomOnly: '喫煙専用室だけ（席では吸えない）',
  smokingAllowedRoom: '席で飲みながら吸える（喫煙可能室）',
  heatedTobaccoRoom: '加熱式たばこの専用室',
  noSmoking: '禁煙',
  unknown: '未確認',
};
const MAPKIT = `<script src="${SITE}/mk-config.js"></script><script src="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js" crossorigin async data-callback="sonomiseMapKitLoaded" data-libraries="map,annotations,services"></script><script>window.sonomiseMapKitLoaded=function(){var s=document.createElement('script');s.src='${SITE}/assets/map.js';document.body.appendChild(s);};</script>`;
const BUSINESS = { coffee: 'コーヒーが主役の店', bar: 'お酒も出る店', other: '業態はまだ分からない店' };

function stableID(name, address) {
  const b = Array.from(createHash('sha256').update(`${name}|${address}`, 'utf8').digest().subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const style = readFileSync('privacy.html', 'utf8').split('<style>')[1].split('</style>')[0];
const extra = `
  .badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:15px;font-weight:700;background:var(--brown-soft);color:var(--brown);border:1px solid var(--brown)}
  .badge.muted{background:transparent;color:var(--ink-mut);border-color:var(--rule)}
  .btns{display:grid;gap:10px;margin-top:14px}
  .btn{display:flex;align-items:center;justify-content:center;min-height:56px;padding:10px 14px;border-radius:12px;font-size:18px;font-weight:800;text-decoration:none;border:2px solid var(--brown)}
  .btn-main{background:var(--brown);color:#fff}.btn-sub{background:var(--brown-soft);color:var(--brown)}
  .kv{margin-top:12px;color:var(--ink-mut);font-size:16px}
  .official{background:#EEF4EE;border:1px solid #C5D9C5;border-radius:12px;padding:14px 16px;margin-bottom:16px}
  .official h2{font-size:18px}
  .closed{background:#F3E9DA;border:1px solid #E2C9A2;color:#7A4A12;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:15px}
  @media (prefers-color-scheme: dark){ .closed{background:#3A2A1C;border-color:#6B4E3D;color:#F3D9B0} }
  @media (prefers-color-scheme: dark){ .official{background:#22301F;border-color:#3C5A3C} }
  .photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:12px}
  .photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;cursor:zoom-in}
  .lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:50;cursor:zoom-out;padding:16px}
  .lightbox img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
  .comments{list-style:none;padding:0;margin-top:12px}.comments li{padding:8px 0;border-top:1px solid var(--rule)}
  .cdate{color:var(--ink-mut);font-size:14px}
  .note{margin-top:12px;font-size:15px;color:var(--ink-mut)}
  .note.ok{color:#2F5A2F;font-weight:700}
  @media (prefers-color-scheme: dark){ .note.ok{color:#CFE6CF} .community .row b::before{color:#7FB37F} }
  .radios{display:grid;gap:6px;margin-top:12px}
  .radio{display:flex;align-items:center;gap:10px;min-height:48px;padding:6px 12px;border:1px solid var(--rule);border-radius:12px;font-weight:700}
  .radio input{width:22px;height:22px;margin:0;flex:none}
  .ta,.tx{width:100%;margin-top:10px;padding:12px 14px;font:inherit;font-size:17px;color:var(--ink);background:var(--paper);border:2px solid var(--line-strong);border-radius:12px}
  .ta{min-height:88px;resize:vertical}
  #post form .btn{margin-top:12px;width:100%;cursor:pointer;font-family:inherit}
  #post form .btn:disabled{opacity:.45;cursor:not-allowed}
  #apple-sign-in-button,#apple-sign-out-button{margin-top:12px}
  .community .row b::before{content:'✓ ';color:#4E7A4E}
  .list .row{display:block;padding:12px 0;border-top:1px solid var(--rule);text-decoration:none;color:var(--ink)}
  .list .row b{font-size:18px}.list .row span{display:block;color:var(--ink-mut);font-size:15px;font-weight:400}
  .search{width:100%;min-height:52px;font-size:18px;padding:10px 14px;border:2px solid var(--line-strong);border-radius:12px;background:var(--sheet);color:var(--ink)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
  .chip{border:2px solid var(--brown);border-radius:999px;padding:6px 12px;background:var(--sheet);color:var(--brown);font-weight:700;font-size:15px;cursor:pointer}
  .chip.on{background:var(--brown);color:#fff}
  #map{width:100%;height:58vh;min-height:320px;border-radius:14px;border:1px solid var(--line-strong);margin:12px 0;overflow:hidden}
  #map.small{height:260px;min-height:200px}
  .callout{padding:8px 10px;max-width:240px;font-size:14px;line-height:1.5}
  .callout-title{font-weight:800;font-size:15px}.callout-sub{color:#6B584A;font-size:13px}
  .callout-link{display:inline-block;margin-top:6px;font-weight:700}
`;

function shell({ title, description, canonical, body, jsonld, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#FFFDF8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1B140F" media="(prefers-color-scheme: dark)">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
${extraHead}
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "da30c37073e746159a379341e417854d"}'></script>
<style>${style}${extra}</style>
</head>
<body>
<div class="head"><div class="head-in">
  <span class="head-name"><a href="${SITE}/">その店、吸える？</a></span>
  <nav class="head-links" aria-label="ページ"><a href="${SITE}/shops/">店をさがす</a><a href="${SITE}/owner.html">店主の方へ</a><a href="${SITE}/support.html">サポート</a></nav>
</div></div>
<div class="wrap">
${body}
  <footer>
    <a href="${SITE}/">アプリについて</a>・<a href="${SITE}/shops/">店をさがす</a>・<a href="${SITE}/support.html">サポート</a>・<a href="${SITE}/privacy.html">プライバシー</a>・<a href="${SITE}/terms.html">利用規約</a><br>
    <small>出どころ: 新潟市「喫煙可能室設置施設届出書 提出店舗一覧」（市の許諾を得て利用）。分煙区分は届出種別からの推定です。営業状況は店に直接ご確認ください。20歳未満の喫煙は法律で禁止されています。</small>
  </footer>
</div>
</body>
</html>`;
}

mkdirSync('shops', { recursive: true });
const rows = [];
for (const s of spots) {
  const id = stableID(s.name, s.address);
  rows.push({ id, ...s });
  const title = `${s.name}（${s.ward}）— 席で飲みながら吸える店 | その店、吸える？`;
  const description = `${s.name}（${s.address}）は、新潟市に届出のある喫煙可能室のある店です。区分: ${CATEGORY[s.smokingCategory] || '未確認'}。${BUSINESS[s.businessType] || ''}。行った人の投票と写真をアプリで集めています。`;
  const canonical = `${SITE}/shops/${id}.html`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': s.businessType === 'coffee' ? 'CafeOrCoffeeShop' : (s.businessType === 'bar' ? 'BarOrPub' : 'FoodEstablishment'),
    name: s.name, address: { '@type': 'PostalAddress', addressLocality: '新潟市', addressRegion: '新潟県', streetAddress: s.address.replace(/^新潟市/, '') },
    geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lon }, smokingAllowed: true, url: canonical,
  };
  const mapURL = `https://maps.apple.com/?q=${encodeURIComponent(s.name)}&ll=${s.lat},${s.lon}`;
  const googleURL = `https://www.google.com/search?q=${encodeURIComponent(s.name + ' ' + s.address)}`;
  const body = `
  <header>
    <h1>${esc(s.name)}</h1>
    <div class="badges"><span class="badge">${esc(CATEGORY[s.smokingCategory] || '未確認')}</span><span class="badge muted">${esc(BUSINESS[s.businessType] || '')}</span></div>
    <p class="lead">${esc(s.address)}</p>
    <p class="kv">最終確認日: ${esc(s.verifiedAt)}（届出名簿の基準日）・現地確認: アプリの投票で更新中</p>
  </header>
  <div class="card">
    <h2>この店で吸えるか</h2>
    <p>新潟市に「喫煙可能室」の届出がある店です。届出の種別から、<strong>席で飲みながら吸える</strong>と推定しています。全席か一部かは名簿から分かりません。行く前に店へご確認ください。</p>
    <div id="map" class="small" data-site="${SITE}" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${esc(s.name)}" aria-label="${esc(s.name)}の地図"></div>
    <div class="btns">
      <a class="btn btn-main" href="${mapURL}">Apple の地図で開く</a>
      <a class="btn btn-sub" href="${googleURL}" rel="nofollow">Google で調べる</a>
      <button class="btn btn-sub" type="button" data-share="${canonical}" data-title="${esc(s.name)}">この店のページを共有</button>
    </div>
  </div>
  <div class="card" id="community" data-spot-id="${id}" data-site="${SITE}" data-spot-name="${esc(s.name)}"><h2>行った人の声</h2><p class="note">読み込んでいます…</p></div>
  <div class="card" id="post" data-spot-id="${id}" data-site="${SITE}"><h2>この店に行った？</h2><p class="note">投票フォームを読み込んでいます…</p></div>
  <div class="card" id="owner">
    <h2>この店の店主の方へ</h2>
    <p>営業時間・店からのひとこと・公式ページを、アプリとこのページに<strong>無料</strong>で載せられます。運営が店の代表電話に確認してから載せます。</p>
    <div class="btns"><a class="btn btn-sub" href="${SITE}/owner.html?spot=${id}&amp;name=${encodeURIComponent(s.name)}">公式情報の掲載を申し込む</a></div>
  </div>
  <div class="card">
    <h2>アプリで、近くの吸える店を探す</h2>
    <p>「その店、吸える？」は、新潟市の届出名簿907件を地図に載せ、行った人の投票と写真で育てる iPhone アプリです。20歳以上の方向け。App Store で近日公開。</p>
    <div class="btns"><a class="btn btn-sub" href="${SITE}/">アプリについて</a></div>
  </div>
  <p class="note">出どころ: ${esc(s.attribution)}（<a href="${esc(s.sourceURL)}">市の公表ページ</a>）</p>`;
  writeFileSync(`shops/${id}.html`, shell({ title, description, canonical, body, jsonld,
    extraHead: `<script src="${SITE}/assets/share.js" defer></script><script src="${SITE}/ck-config.js?v=20260906b"></script><script src="${SITE}/assets/ck-shared.js"></script><script src="https://cdn.apple-cloudkit.com/ck/2/cloudkit.js" async></script><script src="${SITE}/assets/community.js" defer></script><script src="${SITE}/assets/post.js" defer></script>${MAPKIT}` }));
}

// 一覧
const wards = [...new Set(rows.map(r => r.ward))];
const listBody = `
  <header>
    <h1>新潟市で、席で飲みながら吸える店 ${rows.length}件</h1>
    <p class="lead">新潟市に喫煙可能室の届出がある飲食店の一覧です。店名で探すか、区と業態で絞ってください。</p>
  </header>
  <input class="search" id="q" type="search" placeholder="店名・住所で探す（名簿に無い店は Apple の地図から）" aria-label="店名・住所で探す">
  <div id="map" data-site="${SITE}" aria-label="新潟市の吸える店の地図"></div>
  <script type="application/json" id="spots-data">${JSON.stringify(rows.map(r => ({ id: r.id, n: r.name, a: r.address, b: r.businessType, lat: r.lat, lon: r.lon })))}</script>
  <div class="chips" id="biz"><button class="chip on" data-v="">すべて</button><button class="chip" data-v="coffee">コーヒーが主役の店</button><button class="chip" data-v="bar">お酒も出る店</button><button class="chip" data-v="other">まだ分からない店</button></div>
  <div class="chips" id="ward"><button class="chip on" data-v="">全区</button>${wards.map(w => `<button class="chip" data-v="${esc(w)}">${esc(w)}</button>`).join('')}</div>
  <div class="list" id="list">${rows.map(r => `<a class="row" href="${SITE}/shops/${r.id}.html" data-n="${esc(r.name)}" data-a="${esc(r.address)}" data-b="${r.businessType}" data-w="${esc(r.ward)}"><b>${esc(r.name)}</b><span>${esc(r.address)} ・ ${esc(BUSINESS[r.businessType] || '')}</span></a>`).join('\n')}</div>
  <p class="note" id="count"></p>
  <div class="card community" id="community-spots" data-site="${SITE}"><h2>利用者が教えた店</h2><p class="note">読み込んでいます…</p></div>
  <div class="card" id="recent" data-site="${SITE}"><h2>最近の投票</h2><p class="note">読み込んでいます…</p></div>
  <script>
  (function(){var q=document.getElementById('q'),rows=[].slice.call(document.querySelectorAll('#list .row')),biz='',ward='';
  function norm(s){return (s||'').normalize('NFKC').toLowerCase();}
  function apply(){var t=norm(q.value),n=0,ids=[];var crows=[].slice.call(document.querySelectorAll('#community-spots .row'));crows.forEach(function(r){var ok=(!t||norm(r.dataset.n).indexOf(t)>=0||norm(r.dataset.a).indexOf(t)>=0)&&(!biz||biz==='other');r.style.display=ok?'':'none';});rows.forEach(function(r){var ok=(!t||norm(r.dataset.n).indexOf(t)>=0||norm(r.dataset.a).indexOf(t)>=0)&&(!biz||r.dataset.b===biz)&&(!ward||r.dataset.w===ward);r.style.display=ok?'':'none';if(ok){n++;ids.push(r.getAttribute('href').split('/shops/')[1].replace('.html',''));}});document.getElementById('count').textContent=n+'件';if(window.sonomiseMapFilter)window.sonomiseMapFilter(ids,q.value.trim());}
  window.sonomiseApplyFilter=apply;
  q.addEventListener('input',apply);
  ['biz','ward'].forEach(function(id){document.getElementById(id).addEventListener('click',function(e){var b=e.target.closest('.chip');if(!b)return;[].forEach.call(this.querySelectorAll('.chip'),function(c){c.classList.remove('on')});b.classList.add('on');if(id==='biz')biz=b.dataset.v;else ward=b.dataset.v;apply();});});
  apply();})();
  </script>`;
writeFileSync('shops/index.html', shell({ title: '新潟市で席で飲みながら吸える店 907件 — 地図と一覧 | その店、吸える？', description: '新潟市に喫煙可能室の届出がある飲食店を地図と一覧で。店名・区・業態で探せます。名簿に無い店は Apple の地図から候補を出します。', canonical: `${SITE}/shops/`, body: listBody,
  extraHead: `<script src="${SITE}/ck-config.js?v=20260906b"></script><script src="${SITE}/assets/ck-shared.js"></script><script src="https://cdn.apple-cloudkit.com/ck/2/cloudkit.js" async></script><script src="${SITE}/assets/community-spots.js" defer></script><script src="${SITE}/assets/recent.js" defer></script>${MAPKIT}` }));

// 動的ページ（利用者が教えた店・新しい店を教える）。中身は JS が CloudKit から組む。
const spotBody = `
  <header>
    <h1 id="title">利用者が教えた店</h1>
    <div class="badges" id="badges"></div>
    <p class="lead" id="addr">読み込んでいます…</p>
    <p class="kv" id="meta"></p>
  </header>
  <div class="card">
    <h2>この店で吸えるか</h2>
    <p id="how">アプリの利用者が「新しい店」として教え、人数と証拠がそろって載った店です（名簿の店ではありません）。行く前に店へご確認ください。</p>
    <div id="map" class="small" data-site="${SITE}" aria-label="店の地図"></div>
    <div class="btns" id="links"></div>
  </div>
  <div class="card" id="community" data-site="${SITE}"><h2>行った人の声</h2><p class="note">読み込んでいます…</p></div>
  <div class="card" id="post" data-site="${SITE}"><h2>この店に行った？</h2><p class="note">投票フォームを読み込んでいます…</p></div>
  <p class="note" id="notfound" hidden>この店はまだ載っていません（人数か証拠が足りないか、取り下げられました）。<a href="${SITE}/shops/">店をさがす</a>へ戻る。</p>`;
writeFileSync('spot.html', shell({ title: '利用者が教えた店 | その店、吸える？', description: 'アプリの利用者が教え、人数と証拠がそろって載った店のページ。', canonical: `${SITE}/spot.html`, body: spotBody,
  extraHead: `<meta name="robots" content="noindex"><script src="${SITE}/ck-config.js?v=20260906b"></script><script src="${SITE}/assets/ck-shared.js"></script><script src="https://cdn.apple-cloudkit.com/ck/2/cloudkit.js" async></script><script src="${SITE}/assets/community-spots.js" defer></script><script src="${SITE}/mk-config.js"></script><script src="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js" crossorigin async data-callback="sonomiseMapKitLoaded" data-libraries="map,annotations,services"></script><script>window.sonomiseMapKitLoaded=function(){window.__mapkitReady=true;if(window.__sonomiseSpotReady)window.__sonomiseSpotReady();};</script>` }));

const newBody = `
  <header>
    <h1>この店を教える</h1>
    <p class="lead">名簿に無い「席で飲みながら吸える店」を見つけたら、教えてください。ほかの人の確認か出どころがそろうと、アプリとこのサイトに載ります。</p>
  </header>
  <div class="card" id="newspot" data-site="${SITE}">
    <h2 id="nsname">店</h2>
    <p class="kv" id="nsaddr"></p>
    <form id="nsform" novalidate>
      <label for="nsn" style="display:block;font-weight:800;margin-top:12px">店名</label>
      <input class="tx" id="nsn" maxlength="60" required>
      <p style="font-weight:800;margin-top:14px">吸い方</p>
      <div class="radios" id="nscat">
        <label class="radio"><input type="radio" name="cat" value="smokingAllowedRoom" checked> 席で飲みながら吸える</label>
        <label class="radio"><input type="radio" name="cat" value="heatedTobaccoRoom"> 加熱式のみ・飲みながら吸える</label>
        <label class="radio"><input type="radio" name="cat" value="smokingRoomOnly"> 喫煙専用室だけ（席では吸えない）</label>
      </div>
      <p style="font-weight:800;margin-top:14px">出どころ（どちらか必須）</p>
      <div class="radios">
        <label class="radio"><input type="radio" name="src" value="onSite" checked> 店頭で見た（自分の目で確かめた）</label>
        <label class="radio"><input type="radio" name="src" value="url"> 公式ページ・SNS の URL がある</label>
      </div>
      <input class="tx" id="nsurl" inputmode="url" placeholder="https://…（URL を選んだとき）" hidden>
      <div id="apple-sign-in-button"></div>
      <div id="apple-sign-out-button" hidden></div>
      <button type="submit" class="btn btn-main" id="nssend" disabled style="margin-top:12px;width:100%;font-family:inherit">教える</button>
      <p class="note" id="nsstatus" role="status"></p>
      <p class="note">送ると<a href="${SITE}/terms.html">利用規約</a>に同意したことになります。載るのは、別の人の確認か出どころがそろってからです（運営が確認した店はすぐ載ります）。</p>
    </form>
  </div>`;
writeFileSync('spot-new.html', shell({ title: 'この店を教える | その店、吸える？', description: '名簿に無い吸える店を教えるフォーム。人数と証拠がそろうとアプリとサイトに載ります。', canonical: `${SITE}/spot-new.html`, body: newBody,
  extraHead: `<meta name="robots" content="noindex"><script src="${SITE}/ck-config.js?v=20260906b"></script><script src="${SITE}/assets/ck-shared.js"></script><script src="https://cdn.apple-cloudkit.com/ck/2/cloudkit.js" async></script><script src="${SITE}/assets/spot-new.js" defer></script>` }));

// sitemap
const urls = [`${SITE}/`, `${SITE}/shops/`, `${SITE}/beta.html`, `${SITE}/owner.html`, `${SITE}/support.html`, `${SITE}/privacy.html`, `${SITE}/terms.html`, ...rows.map(r => `${SITE}/shops/${r.id}.html`)];
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
if (!existsSync('robots.txt')) writeFileSync('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('pages:', rows.length, 'wards:', wards.join(','));
