import { demoSecurity } from './demoSecurity.js';

// One local demo account, NOT a banking ledger or a security boundary.
// Only this module reads the underlying balances. UI reads visibleCents().
const ACCOUNT = 'kingapesa.demoAccount';
const SESSION = 'kingapesa.demoSession';
const EVENT = 'kingapesa-account-change';
const fail = key => { throw new Error(key); };
const mode = () => { try { return sessionStorage.getItem(SESSION); } catch { return null; } };
export const hasDemoSession = () => ['primary', 'protected'].includes(mode());
export const canConfigureAccount = () => mode() === 'primary';

function readAccount() {
  try {
    const raw = localStorage.getItem(ACCOUNT);
    if (!raw) return { balance: demoSecurity.startingCents, protected: demoSecurity.protectedCents, debits: {} };
    const state = JSON.parse(raw);
    if (!Number.isSafeInteger(state.balance) || state.balance < 0 || !Number.isSafeInteger(state.protected) || state.protected < 0 || state.protected > state.balance || !state.debits || typeof state.debits !== 'object') fail('accountUnavailable');
    return state;
  } catch { return fail('accountUnavailable'); }
}
function writeAccount(state) {
  try { localStorage.setItem(ACCOUNT, JSON.stringify(state)); }
  catch { return fail('accountUnavailable'); }
  window.dispatchEvent(new Event(EVENT));
}
export function openDemoSession(pin) {
  const next = pin === demoSecurity.primaryPin ? 'primary' : pin === demoSecurity.safeAccessPin ? 'protected' : null;
  if (!next) return false;
  writeAccount(readAccount());
  sessionStorage.setItem(SESSION, next);
  window.dispatchEvent(new Event(EVENT));
  return true;
}
export function signOut() {
  sessionStorage.removeItem(SESSION);
  window.dispatchEvent(new Event(EVENT));
  window.location.replace('/login');
}
export function visibleCents() {
  if (!hasDemoSession()) return null;
  try { const state = readAccount(); return mode() === 'protected' ? Math.min(state.balance, state.protected) : state.balance; }
  catch { return null; }
}
export function subscribeAccount(callback) {
  window.addEventListener(EVENT, callback); window.addEventListener('storage', callback); window.addEventListener('focus', callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', callback); window.removeEventListener('focus', callback); };
}
export function cents(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return fail('invalidAmount');
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result <= 0) return fail('invalidAmount');
  return result;
}
export const formatZar = value => `R${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ',')}`;
export function walletCost(quote) {
  const amount = cents(quote.total_cost);
  if (quote.send_currency === 'ZAR') return amount;
  // Existing demo rate: 1 ZAR = 0.75 BWP. Wallet only; backend quote is untouched.
  if (quote.send_currency === 'BWP') return Math.floor((amount * 4 + 1) / 3);
  return fail('invalidData');
}
let queue = Promise.resolve();
function exclusive(action) {
  // Serialize tabs where Web Locks is available; fallback serializes this page.
  if (navigator.locks) return navigator.locks.request('kingapesa-demo-account', action);
  const task = queue.then(action); queue = task.catch(() => {}); return task;
}
function checkedAccount(cost) {
  if (!hasDemoSession()) return fail('accountSignIn');
  if (localStorage.getItem('kingapesa.pendingSend')) return fail('sendUncertain');
  if (localStorage.getItem('kingapesa.pendingServicePurchase')) return fail('fsUncertain');
  const state = readAccount();
  const available = mode() === 'protected' ? Math.min(state.balance, state.protected) : state.balance;
  if (cost > available) return fail('accountInsufficient');
  writeAccount(state); // Verify persistence works BEFORE any API mutation.
  return state;
}
function debit(state, key, cost, session, receipt = true) {
  if (state.debits[key]) return state.debits[key];
  state.balance -= cost;
  state.protected = Math.min(state.balance, session === 'protected' ? state.protected - cost : state.protected);
  state.debits[key] = receipt;
  writeAccount(state);
  return receipt;
}
function payForBackend(quote, createTransfer, kind) {
  return exclusive(async () => {
    const cost = walletCost(quote);
    const state = checkedAccount(cost);
    const session = mode();
    const transfer = await createTransfer(); // No deduction until POST succeeded.
    debit(state, `${kind}:${transfer.id}:${transfer.created_at}`, cost, session);
    return transfer;
  });
}
export const payForTransfer = (quote, create) => payForBackend(quote, create, 'transfer');
export const payForServicePurchase = (quote, create) => payForBackend(quote, create, 'service');

export function buyDemoUtility({ id, type, target, amount }) {
  return exclusive(() => {
    if (!navigator.onLine) return fail('deviceOffline');
    if (!['airtime', 'electricity', 'voucher'].includes(type) || !target.trim() || target.length > 80) return fail('invalidData');
    const existing = readAccount().debits[`utility:${id}`];
    if (existing) return existing;
    const cost = cents(amount);
    const state = checkedAccount(cost);
    const random = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
    const receipt = { id, type, target, amount: cost, reference: type === 'electricity' ? Array.from({ length: 5 }, random).join(' ') : `DEMO-${random()}-${random()}` };
    return debit(state, `utility:${id}`, cost, mode(), receipt);
  });
}
export function configureProtected(value) {
  return exclusive(() => {
    if (!canConfigureAccount()) return fail('accountUnavailable');
    const state = checkedAccount(0); const amount = cents(value);
    if (amount >= state.balance) return fail('accountProtectedInvalid');
    state.protected = amount; writeAccount(state);
  });
}
export function resetDemoAccount() {
  return exclusive(() => {
    if (!canConfigureAccount()) return fail('accountUnavailable');
    const state = checkedAccount(0);
    state.balance = demoSecurity.startingCents; state.protected = demoSecurity.protectedCents;
    writeAccount(state); // Keep completed IDs so refresh cannot debit them twice.
  });
}
