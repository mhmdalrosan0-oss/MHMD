const assert = require('assert');
const { pushText } = require('../index.js')._test || require('../index.js');
let t = pushText({ type: 'near', params: { remaining: 75, pct: 21 } }, 'ar'); assert.strictEqual(t.body, 'باقي 75 ك.و للوصول إلى 21%');
t = pushText({ type: 'near', params: { remaining: 75, pct: 21 } }, 'en'); assert.strictEqual(t.body, '75 kWh left to reach 21%');
t = pushText({ type: 'payout', params: { month: '2026-09', amount: 63, currency: 'JD', note: 'Click' } }, 'en'); assert.ok(t.body.includes('63 JD') && t.body.includes('Note: Click'));
assert.strictEqual(pushText({ type: 'nope' }, 'ar'), null);
console.log('push text ok'); process.exit(0);
