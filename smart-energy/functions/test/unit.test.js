const assert = require('assert');
const { normPhone, pushText } = require('../index.js')._test;
for (const p of ['0795550123', '795550123', '+962795550123', '00962795550123', '962795550123', '079 555 0123']) assert.strictEqual(normPhone(p), '0795550123', p);
assert.strictEqual(pushText({ type: 'near', params: { remaining: 75, pct: 21 } }, 'ar').body, 'باقي 75 ك.و للوصول إلى 21%');
console.log('unit ok'); process.exit(0);
