# sonomise-site

iPhoneアプリ「その店、吸える？」（`mobile/sonomise`）のサポートサイト。
App Store提出の必須URL（サポートURL・プライバシーポリシーURL）用の静的HTML。

- `index.html` — アプリ紹介
- `privacy.html` — プライバシーポリシー
- `support.html` — よくあるご質問・店舗運営者様の窓口・情報の出どころ

公開先（予定）: `https://nosunosukawa.github.io/sonomise-site/`
（公開・push は承認境界。ローカルで作るだけで、まだ公開していない）

## 特定商取引法のページ（tokushoho.html）を作っていない理由

このアプリの販売物はApp Store内の買い切りIAP（広告を消す）のみで、
販売者（通信販売の事業者）はAppleであり、特定商取引法に基づく表記は
Appleが自社のサイトで行っている。開発者が独自に決済を持たないため、
このサイトに特定商取引法のページは置いていない。
独自決済やグッズ販売などを始める場合は、その時点で作成すること。

## 店ページ（2026-09-05）

- `make-shops.mjs` が `data/spots.json`（アプリの同梱名簿のコピー）から `shops/<店ID>.html` 907件・`shops/index.html`・`sitemap.xml` を作る。
  店IDはアプリと同じ（名前|住所 の SHA-256）。名簿を更新したら JSON をコピーして `node make-shops.mjs`。
- 店ページの「行った人の声」は `assets/community.js` が CloudKit JS でアプリの投稿（投票・ひとこと・写真）を読んで出す。
  接続先は `ck-config.js`（API トークンは Web 用・許可ドメインは nosunosukawa.github.io のみ）。アプリが Production に移ったら
  `environment` を `production` に変える。
- 目的は Google からの入口（App Store 検索は無風）と、店ページの共有 URL。
