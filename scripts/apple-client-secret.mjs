#!/usr/bin/env node
// Apple Sign in → Supabase "Secret Key" (JWT) üretir. .p8 asla commit edilmez.
// Kullanım:
//   node scripts/apple-client-secret.mjs \
//     --team YOUR_TEAM_ID \
//     --services com.turquz.app.auth \
//     --key YOUR_KEY_ID \
//     --p8 /path/to/AuthKey_XXXX.p8

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] || fallback;
}

const teamId = arg('team');
const servicesId = arg('services');
const keyId = arg('key');
const p8Path = arg('p8');

if (!teamId || !servicesId || !keyId || !p8Path) {
  console.error(`Eksik argüman.

Örnek:
  node scripts/apple-client-secret.mjs \\
    --team 7UFJVN4NGZ \\
    --services com.turquz.app.auth \\
    --key ABCDE12345 \\
    --p8 ~/Downloads/AuthKey_ABCDE12345.p8
`);
  process.exit(1);
}

const abs = path.resolve(p8Path.replace(/^~/, process.env.HOME || ''));
if (!fs.existsSync(abs)) {
  console.error('p8 bulunamadı:', abs);
  process.exit(1);
}

const privateKey = fs.readFileSync(abs, 'utf8');
const now = Math.floor(Date.now() / 1000);
const exp = now + 180 * 24 * 60 * 60; // ~6 ay (Apple üst sınır)

const b64url = (obj) =>
  Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj))
    .toString('base64url');

const header = b64url({ alg: 'ES256', kid: keyId });
const payload = b64url({
  iss: teamId,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
});
const data = `${header}.${payload}`;
const sig = crypto.sign('SHA256', Buffer.from(data), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
});
const jwt = `${data}.${Buffer.from(sig).toString('base64url')}`;

console.log('\n=== Supabase Apple → Secret Key (JWT) ===\n');
console.log(jwt);
console.log(`\nGeçerlilik ~ ${new Date(exp * 1000).toISOString()} (6 ay içinde yenile)\n`);
