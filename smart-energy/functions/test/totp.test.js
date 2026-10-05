// RFC 6238 test vector (SHA-1, secret "12345678901234567890", T=59s -> 94287082 -> last 6 digits 287082)
const assert = require('assert');
const totp = require('../totp');
const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
assert.strictEqual(totp.hotp(secret, Math.floor(59 / 30)), '287082');
assert.strictEqual(totp.verify(secret, '287082', 0, 59000), 1);
assert.strictEqual(totp.verify(secret, '287082', 1, 59000), null, 'replay of same step rejected');
assert.strictEqual(totp.verify(secret, '000000', 0, 59000), null);
console.log('totp ok');
