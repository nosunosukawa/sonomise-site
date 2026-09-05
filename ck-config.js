// CloudKit JS の接続先（2026-09-05）。API トークンは Web 用に公開してよい種類で、
// 許可ドメインを nosunosukawa.github.io に限定してある（CloudKit Console → Tokens & Keys）。
// アプリが Production へ移ったら environment を 'production' にする。
window.SONOMISE_CK = {
  container: 'iCloud.com.nosunosukawa.sonomise',
  apiToken: 'f1a6a72fb335b6250989fa399726e9db7b91f25c2b5a2adceb4e95120d579fd0',
  environment: 'development'
};
