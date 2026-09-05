// CloudKit JS の接続先（2026-09-05）。API トークンは Web 用に公開してよい種類で、
// 許可ドメインを nosunosukawa.github.io に限定してある（CloudKit Console → Tokens & Keys）。
// 2026-09-06 Production に切替（TestFlight 以降のアプリは Production を見る。Xcode から入れた開発ビルドだけが Development）。
window.SONOMISE_CK = {
  container: 'iCloud.com.nosunosukawa.sonomise',
  apiToken: 'f1a6a72fb335b6250989fa399726e9db7b91f25c2b5a2adceb4e95120d579fd0',
  environment: 'production'
};
