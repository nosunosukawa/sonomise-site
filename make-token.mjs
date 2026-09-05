// MapKit JS のトークン（JWT・ES256）を作って mk-config.js に書く（2026-09-05）。
// 秘密鍵は ~/.appstoreconnect/mapkit/ にだけ置く（リポジトリに入れない）。トークンは origin を
// nosunosukawa.github.io に限定した1年もの。期限が来たら `node make-token.mjs` で作り直して push する。
import { readFileSync, writeFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { homedir } from 'node:os';
const cfg = JSON.parse(readFileSync(`${homedir()}/.appstoreconnect/mapkit/mapkit.json`, 'utf8'));
const key = readFileSync(cfg.key_filepath.replace(/^~/, homedir()), 'utf8');
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = { alg: 'ES256', kid: cfg.key_id, typ: 'JWT' };
const payload = { iss: cfg.team_id, iat: now, exp: now + 365 * 24 * 3600, origin: cfg.origin };
const input = `${b64(header)}.${b64(payload)}`;
const sig = createSign('SHA256').update(input).sign({ key, dsaEncoding: 'ieee-p1363' });
const token = `${input}.${sig.toString('base64url')}`;
writeFileSync('mk-config.js', `// MapKit JS のトークン（origin 限定・${new Date((now + 365 * 24 * 3600) * 1000).toISOString().slice(0, 10)} まで）。make-token.mjs で作る。\nwindow.SONOMISE_MAPKIT_TOKEN = '${token}';\n`);
console.log('token written, expires', new Date((now + 365 * 24 * 3600) * 1000).toISOString().slice(0, 10));
