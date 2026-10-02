import React, { useState, useSyncExternalStore } from 'react';
import { visibleCents, subscribeAccount, formatZar, walletCost, canConfigureAccount, configureProtected, resetDemoAccount, signOut } from '../demoAccount';
import './demoBalance.css';

export function DemoBalance({ t, quote }) {
  const value = useSyncExternalStore(subscribeAccount, visibleCents);
  return <aside className="kp-account-balance"><span>{t('accountAvailable')}</span><strong data-testid="available-balance">{value === null ? '—' : formatZar(value)}</strong><small>{t('accountDemo')}</small>{quote?.send_currency === 'BWP' && <p>{t('accountWalletDebit', { amount: formatZar(walletCost(quote)) })}</p>}</aside>;
}
export function AccountControls({ t }) {
  const [amount, setAmount] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function run(action) { if (busy) return; setBusy(true); try { await action(); setMessage('accountSaved'); setAmount(''); } catch (err) { setMessage(err.message); } finally { setBusy(false); } }
  return <div className="kp-account-controls"><button onClick={signOut}>{t('accountSignOut')}</button>{canConfigureAccount() && <details><summary>{t('accountSettings')}</summary><p>{t('accountSafetyExplanation')}</p><label htmlFor="protected-amount">{t('accountProtected')}</label><input id="protected-amount" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /><button disabled={busy || !amount} onClick={() => run(() => configureProtected(amount))}>{t('accountSave')}</button><details><summary>{t('accountDemoControls')}</summary><p>{t('accountResetExplanation')}</p><button disabled={busy} onClick={() => run(resetDemoAccount)}>{t('accountReset')}</button></details><p role="status">{message && t(message)}</p></details>}</div>;
}
