// Minimal RFC 6238 TOTP (SHA-1, 6 digits, 30s) compatible with Google Authenticator.
const crypto = require('crypto');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32decode(s) {
  let bits = 0, val = 0; const out = [];
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(c); if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
const newSecret = () => b32encode(crypto.randomBytes(20));

function hotp(secret, counter) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(c).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
const stepNow = (now = Date.now()) => Math.floor(now / 30000);

/** Returns the matched time step (for replay protection) or null. */
function verify(secret, code, lastStep = 0, now = Date.now()) {
  code = String(code || '');
  if (!/^\d{6}$/.test(code)) return null;
  const cur = stepNow(now);
  for (const d of [0, -1, 1]) {
    const s = cur + d;
    if (s <= lastStep) continue;
    const a = Buffer.from(hotp(secret, s)), b = Buffer.from(code);
    if (crypto.timingSafeEqual(a, b)) return s;
  }
  return null;
}
const otpauth = (label, secret, issuer = 'Smart Energy') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

module.exports = { newSecret, hotp, verify, otpauth, stepNow, b32decode };
