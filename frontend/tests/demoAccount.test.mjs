import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
// Browser primitives only; no test dependencies.
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,String(value)), removeItem: key => data.delete(key), clear: () => data.clear() }; };
globalThis.localStorage = storage(); globalThis.sessionStorage = storage(); globalThis.window = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const a = await import('../src/demoAccount.js');
const { demoSecurity: config } = await import('../src/demoSecurity.js');
function fresh(pin = config.primaryPin) { localStorage.clear(); sessionStorage.clear(); assert.equal(a.openDemoSession(pin), true); }
const utility = (id, amount) => a.buyDemoUtility({ id, amount, target: 'Mama', type: 'airtime' });

test('normal transfer charges total only after successful creation; no repeat debit', async () => {
  fresh(); assert.equal(a.visibleCents(),2500000);
  const quote={ total_cost:'520.00',send_currency:'ZAR' };
  await assert.rejects(a.payForTransfer(quote,async()=>{throw Error('network')}));
  assert.equal(a.visibleCents(),2500000);
  const created={id:1,created_at:'demo'};
  await a.payForTransfer(quote,async()=>created);assert.equal(a.visibleCents(),2448000);
  await a.payForTransfer(quote,async()=>created);assert.equal(a.visibleCents(),2448000);
});
test('Safe Access spending persists and deducts both balances without exposing mode', async () => {
  fresh(config.safeAccessPin); assert.equal(a.visibleCents(),100000); assert.equal(a.canConfigureAccount(),false);
  await utility('one','200');assert.equal(a.visibleCents(),80000);
  await utility('one','200');assert.equal(a.visibleCents(),80000);
  a.openDemoSession(config.primaryPin);assert.equal(a.visibleCents(),2480000);
  a.openDemoSession(config.safeAccessPin);assert.equal(a.visibleCents(),80000);
  await assert.rejects(utility('large','801'),/accountInsufficient/);assert.equal(a.visibleCents(),80000);
  await utility('empty','800');assert.equal(a.visibleCents(),0);
  a.openDemoSession(config.primaryPin);assert.equal(a.visibleCents(),2400000);
});
test('primary spend clamps protected balance and depleted account rejects spending', async()=>{
 fresh();await utility('large','24500');a.openDemoSession(config.safeAccessPin);assert.equal(a.visibleCents(),50000);
 await utility('rest','500');assert.equal(a.visibleCents(),0);await assert.rejects(utility('over','1'),/accountInsufficient/);
 a.openDemoSession(config.primaryPin);assert.equal(a.visibleCents(),0);
});
test('concurrent utility clicks and withdrawals cannot overspend',async()=>{
 fresh(config.safeAccessPin);const results=await Promise.allSettled([utility('a','700'),utility('b','700')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(a.visibleCents(),30000);
});
test('configuration/reset are primary-only; pending send blocks all new spending/reset',async()=>{
 fresh();await a.configureProtected('500');a.openDemoSession(config.safeAccessPin);assert.equal(a.visibleCents(),50000);
 await assert.rejects(a.configureProtected('900'),/accountUnavailable/);await assert.rejects(a.resetDemoAccount(),/accountUnavailable/);
 a.openDemoSession(config.primaryPin);localStorage.setItem('kingapesa.pendingSend','{}');await assert.rejects(utility('a','20'),/sendUncertain/);await assert.rejects(a.resetDemoAccount(),/sendUncertain/);
 localStorage.removeItem('kingapesa.pendingSend');await a.resetDemoAccount();assert.equal(a.visibleCents(),2500000);a.openDemoSession(config.safeAccessPin);assert.equal(a.visibleCents(),100000);
});
test('BWP wallet conversion uses integer rounding, not modified quote math',()=>{
 assert.equal(a.walletCost({total_cost:'527.50',send_currency:'BWP'}),70333);
 assert.equal(a.walletCost({total_cost:'0.01',send_currency:'BWP'}),1);
 assert.equal(a.walletCost({total_cost:'0.02',send_currency:'BWP'}),3);
});
test('storage failure, signed-out access and offline utilities fail closed',async()=>{
 fresh();sessionStorage.clear();assert.equal(a.visibleCents(),null);await assert.rejects(utility('a','20'),/accountSignIn/);
 a.openDemoSession(config.primaryPin);navigator.onLine=false;await assert.rejects(utility('b','20'),/deviceOffline/);navigator.onLine=true;
 const original=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota')};let called=false;
 await assert.rejects(a.payForTransfer({total_cost:'20.00',send_currency:'ZAR'},async()=>{called=true}),/accountUnavailable/);assert.equal(called,false);localStorage.setItem=original;
});
test('legacy service purchases share limits and use separate deduplication IDs',async()=>{
 fresh(config.safeAccessPin);
 const quote={total_cost:'200.00',send_currency:'ZAR'};
 const result={id:1,created_at:'demo'};
 await a.payForServicePurchase(quote,async()=>result);assert.equal(a.visibleCents(),80000);
 await a.payForServicePurchase(quote,async()=>result);assert.equal(a.visibleCents(),80000);
 await a.payForTransfer(quote,async()=>result);assert.equal(a.visibleCents(),60000);
 await assert.rejects(a.payForServicePurchase({total_cost:'601.00',send_currency:'ZAR'},async()=>result),/accountInsufficient/);
 localStorage.setItem('kingapesa.pendingServicePurchase','{}');await assert.rejects(utility('new','20'),/fsUncertain/);
});
test('legacy purchase rejection/failure never debits or bypasses the session limit', async () => {
  fresh(config.safeAccessPin);
  let calls = 0;
  await assert.rejects(a.payForServicePurchase({ total_cost: '1001.00', send_currency: 'ZAR' }, async () => { calls++; }), /accountInsufficient/);
  assert.equal(calls, 0);
  await assert.rejects(a.payForServicePurchase({ total_cost: '50.00', send_currency: 'ZAR' }, async () => { calls++; throw new Error('provider unavailable'); }), /provider unavailable/);
  assert.equal(calls, 1);
  assert.equal(a.visibleCents(), 100000);
  a.openDemoSession(config.primaryPin);
  assert.equal(a.visibleCents(), 2500000);
});
