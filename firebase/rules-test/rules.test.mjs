// اختبار قواعد Firebase للفريق وسجل التعديلات على المحاكي:
//   npm install && npm test
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { ref, get, set, update, remove, serverTimestamp, push } from 'firebase/database';
const env = await initializeTestEnvironment({ projectId: 'demo-acc', database: { rules: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9000 } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.database();
  await set(ref(db), {
    users: { O: { accounts: { a: { name: 'x' } } } },
    sales: { O: { products: { p: { name: 'y' } } } },
    employeeOwnerMap: { ACC: 'O', VIEW: 'O', CASH: 'O', OFF: 'O', LEGACY: 'O' },
    teams: { O: {
      ACC: { role: 'accountant', active: true, canWrite: true, perms: { audit: 'view' } },
      VIEW: { role: 'viewer', active: true, canWrite: false, perms: { audit: 'view' } },
      CASH: { role: 'cashier', active: true, canWrite: true, perms: { audit: 'none' } },
      OFF: { role: 'accountant', active: false, canWrite: true, perms: { audit: 'view' } },
    } },
    audit: { O: { e1: { uid: 'O', at: 1, action: 'x', area: 'accounts' } } },
  });
});
const db = (uid) => env.authenticatedContext(uid).database();
const results = [];
const t = async (name, p) => { try { await p; results.push('ok   ' + name); } catch (e) { results.push('FAIL ' + name + ' ' + e.message); } };
await t('owner reads users', assertSucceeds(get(ref(db('O'), 'users/O'))));
await t('accountant reads users', assertSucceeds(get(ref(db('ACC'), 'users/O'))));
await t('accountant writes users', assertSucceeds(set(ref(db('ACC'), 'users/O/accounts/b'), { name: 'z' })));
await t('viewer reads users', assertSucceeds(get(ref(db('VIEW'), 'users/O'))));
await t('viewer cannot write users', assertFails(set(ref(db('VIEW'), 'users/O/accounts/c'), { name: 'z' })));
await t('cashier cannot read users', assertFails(get(ref(db('CASH'), 'users/O'))));
await t('suspended cannot read users', assertFails(get(ref(db('OFF'), 'users/O'))));
await t('suspended cannot read sales', assertFails(get(ref(db('OFF'), 'sales/O'))));
await t('legacy cashier (no team) reads sales', assertSucceeds(get(ref(db('LEGACY'), 'sales/O'))));
await t('legacy cashier writes sales', assertSucceeds(set(ref(db('LEGACY'), 'sales/O/invoices/i'), { t: 1 })));
await t('legacy cannot read users', assertFails(get(ref(db('LEGACY'), 'users/O'))));
await t('member reads own team entry', assertSucceeds(get(ref(db('ACC'), 'teams/O/ACC'))));
await t('member cannot read whole team', assertFails(get(ref(db('ACC'), 'teams/O'))));
await t('member cannot edit own team entry', assertFails(set(ref(db('ACC'), 'teams/O/ACC/role'), 'owner')));
await t('owner writes team', assertSucceeds(set(ref(db('O'), 'teams/O/NEW'), { role: 'viewer', active: true })));
await t('stranger cannot read team', assertFails(get(ref(db('X'), 'teams/O'))));
await t('owner appends audit', assertSucceeds(set(push(ref(db('O'), 'audit/O')), { uid: 'O', at: serverTimestamp(), action: 'a', area: 'accounts' })));
await t('cashier appends audit', assertSucceeds(set(push(ref(db('CASH'), 'audit/O')), { uid: 'CASH', at: serverTimestamp(), action: 'a', area: 'pos' })));
await t('cannot forge uid', assertFails(set(push(ref(db('ACC'), 'audit/O')), { uid: 'O', at: serverTimestamp(), action: 'a', area: 'accounts' })));
await t('owner cannot edit audit', assertFails(set(ref(db('O'), 'audit/O/e1/action'), 'y')));
await t('owner cannot delete audit', assertFails(remove(ref(db('O'), 'audit/O/e1'))));
await t('stranger cannot append audit', assertFails(set(push(ref(db('X'), 'audit/O')), { uid: 'X', at: serverTimestamp(), action: 'a', area: 'x' })));
await t('accountant reads audit', assertSucceeds(get(ref(db('ACC'), 'audit/O'))));
await t('cashier cannot read audit', assertFails(get(ref(db('CASH'), 'audit/O'))));
await t('future timestamp rejected', assertFails(set(push(ref(db('O'), 'audit/O')), { uid: 'O', at: 9e15, action: 'a', area: 'x' })));
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
await env.cleanup();
process.exit(failed ? 1 : 0);
