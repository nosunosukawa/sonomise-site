// CloudKit JS の接続先。API トークンは環境ごと（Production 用 'sonomise-site production'・2026-09-06）。Web 用に公開してよい種類で、
// 許可ドメインを nosunosukawa.github.io に限定してある（CloudKit Console → Tokens & Keys）。
// 2026-09-06 Production に切替（TestFlight 以降のアプリは Production を見る。Xcode から入れた開発ビルドだけが Development）。
window.SONOMISE_CK = {
  container: 'iCloud.com.nosunosukawa.sonomise',
  apiToken: '11b7853ff3d3151caefa43a6c3b8746d7a3320b0cc43b50366c1f90fb9977d34',
  environment: 'production'
};
