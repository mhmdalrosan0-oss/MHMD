/* Firestore rules test (needs the firestore emulator). Checks role scoping and the 7-day session limit. */
const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-smart-energy', firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync(__dirname + '/../../firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (c) => { const d = c.firestore(); await d.doc('groups/g1').set({ name: 'x' }); await d.doc('stats/g1_2026-10').set({ groupId: 'g1', kwh: 1 }); await d.doc('settings/main').set({ currency: 'JD' }); await d.doc('audit/a').set({ x: 1 }); });
  const now = Math.floor(Date.now() / 1000), day = 86400;
  const as = (claims) => env.authenticatedContext('u1', claims).firestore();
  const staffFresh = as({ role: 'staff', auth_time: now - 3600 }), staffOld = as({ role: 'staff', auth_time: now - 8 * day }), staffEdge = as({ role: 'staff', auth_time: now - 6 * day });
  await assertSucceeds(staffFresh.doc('groups/g1').get()); console.log('  ✔ fresh staff session can read');
  await assertSucceeds(staffEdge.doc('groups/g1').get()); console.log('  ✔ 6-day-old session still works');
  await assertFails(staffOld.doc('groups/g1').get()); console.log('  ✔ 8-day-old session is denied (groups)');
  await assertFails(staffOld.doc('settings/main').get()); console.log('  ✔ 8-day-old session is denied (settings)');
  await assertFails(as({ role: 'admin' }).doc('audit/a').get()); console.log('  ✔ token without auth_time is denied');
  await assertSucceeds(as({ role: 'admin', auth_time: now - 60 }).doc('audit/a').get()); console.log('  ✔ fresh admin can read audit');
  await assertFails(staffFresh.doc('audit/a').get()); console.log('  ✔ staff cannot read audit');
  const cap = as({ role: 'captain', groupId: 'g1', captainId: '07', auth_time: now - 60 });
  await assertSucceeds(cap.doc('stats/g1_2026-10').get()); await assertSucceeds(cap.doc('stats/g1_2026-11').get()); console.log('  ✔ captain reads own group stats (even months without data)');
  await assertFails(cap.doc('stats/g2_2026-10').get()); console.log('  ✔ captain cannot read another group');
  await assertFails(staffFresh.doc('groups/g1').set({ name: 'hack' })); console.log('  ✔ no client writes');
  await env.cleanup(); console.log('rules ok'); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
