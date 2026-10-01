import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';

// Mounted only while the recipient view is open. No recipient state is persisted.
export default function RecipientAccess({ transferId, currency, t, live, reportFailure, onExit }) {
  const [configured, setConfigured] = useState(null);
  const [primary, setPrimary] = useState('');
  const [safety, setSafety] = useState('');
  const [protectedAmount, setProtectedAmount] = useState('');
  const [pin, setPin] = useState('');
  const [sessionPin, setSessionPin] = useState('');
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);

  function lock() {
    generation.current += 1;
    setPrimary(''); setSafety(''); setProtectedAmount('');
    setPin(''); setSessionPin(''); setBalance(null); setAmount(''); setError('');
    setUncertain(false);
  }

  useEffect(() => {
    if (!live) lock();
  }, [live]);

  useEffect(() => () => { generation.current += 1; }, []);

  async function run(action) {
    if (!live || !navigator.onLine || locked.current) return;
    locked.current = true;
    setBusy(true); setError('');
    const current = generation.current;
    const accept = () => current === generation.current && navigator.onLine;
    try { await action(accept); }
    catch (err) {
      reportFailure(err);
      if (accept()) setError(err.message || 'requestFailed');
    } finally { locked.current = false; setBusy(false); }
  }

  async function load(accept) {
    const result = await api(`/transfers/${transferId}/safe-access`);
    if (accept()) setConfigured(result.configured);
  }

  useEffect(() => { if (live) run(load); }, [live, transferId]);

  function setup(event) {
    event.preventDefault();
    if (!/^[0-9]{4}$/.test(primary) || !/^[0-9]{4}$/.test(safety)) { setError('saInvalidPin'); return; }
    if (primary === safety) { setError('saPinsDiffer'); return; }
    if (!event.currentTarget.querySelector('#protected-amount').validity.valid) { setError('saInvalidProtected'); return; }
    run(async accept => {
      try {
        await api(`/transfers/${transferId}/safe-access`, 'POST', {
          primary_pin: primary, safety_pin: safety, protected_amount: protectedAmount,
        });
        if (accept()) { setConfigured(true); setPrimary(''); setSafety(''); setProtectedAmount(''); }
      } catch (err) {
        if (accept()) {
          setPrimary(''); setSafety('');
          if (err.message === 'saAlreadyConfigured') setConfigured(true);
          else if (err.kind !== 'application' || err.status >= 500) setConfigured(null);
        }
        throw err;
      }
    });
  }

  function access(event) {
    event.preventDefault();
    if (!/^[0-9]{4}$/.test(pin)) { setError('saInvalidPin'); return; }
    run(async accept => {
      const entered = pin;
      setPin('');
      const result = await api(`/transfers/${transferId}/recipient-access`, 'POST', { pin: entered });
      if (accept()) { setBalance(result); setSessionPin(entered); setUncertain(false); }
    });
  }

  function withdraw(event) {
    event.preventDefault();
    if (!event.currentTarget.querySelector('#withdrawal-amount').validity.valid) { setError('saInvalidWithdrawal'); return; }
    if (uncertain) return;
    run(async accept => {
      try {
        const result = await api(`/transfers/${transferId}/withdrawals`, 'POST', { pin: sessionPin, amount });
        if (accept()) { setBalance(result); setAmount(''); }
      } catch (err) {
        if (accept() && (err.kind !== 'application' || err.status >= 500)) {
          setUncertain(true); setAmount(''); setError('saWithdrawalUncertain');
          reportFailure(err);
          return;
        }
        throw err;
      }
    });
  }

  const pinProps = { type: 'password', inputMode: 'numeric', pattern: '[0-9]{4}', minLength: 4, maxLength: 4, required: true, autoComplete: 'off' };
  return <section aria-label={t('saRecipientAccess')}>
    {!live && <p role="status">{t('saReconnect')}</p>}
    {error && <p role="alert">{t(error)}</p>}
    {balance ? <>
      <h2>{t('saAvailable')}</h2>
      <p className="recipient-balance">{balance.currency} {balance.available_to_collect}</p>
      <form onSubmit={withdraw} noValidate>
        <fieldset disabled={!live || busy || uncertain || balance.available_to_collect === '0.00'}>
          <label htmlFor="withdrawal-amount">{t('saWithdrawalAmount')}</label>
          <input id="withdrawal-amount" type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} />
          <button type="submit">{t('saWithdraw')}</button>
        </fieldset>
      </form>
      <button onClick={lock}>{t('saLock')}</button>
    </> : configured === false ? <>
      <h2>{t('saSetup')}</h2>
      <p>{t('saExplanation')}</p>
      <p>{t('saDisclaimer')}</p>
      <form onSubmit={setup} autoComplete="off" noValidate>
        <fieldset disabled={!live || busy}>
          <label htmlFor="primary-pin">{t('saPrimaryPin')}</label>
          <input id="primary-pin" {...pinProps} value={primary} onChange={event => setPrimary(event.target.value)} />
          <label htmlFor="safety-pin">{t('saSafetyPin')}</label>
          <input id="safety-pin" {...pinProps} value={safety} onChange={event => setSafety(event.target.value)} />
          <label htmlFor="protected-amount">{t('saProtectedAmount')} ({currency})</label>
          <input id="protected-amount" type="number" inputMode="decimal" min="0.01" step="0.01" required value={protectedAmount} onChange={event => setProtectedAmount(event.target.value)} />
          <button type="submit">{t('saConfigure')}</button>
        </fieldset>
      </form>
    </> : configured === true ? <form onSubmit={access} autoComplete="off" noValidate>
      <fieldset disabled={!live || busy}>
        <label htmlFor="recipient-pin">{t('saEnterPin')}</label>
        <input id="recipient-pin" {...pinProps} value={pin} onChange={event => setPin(event.target.value)} />
        <button type="submit">{t('saOpen')}</button>
      </fieldset>
    </form> : <button disabled={!live || busy} onClick={() => run(load)}>{t('saCheckAccess')}</button>}
    {!balance && <button disabled={busy} onClick={() => { lock(); onExit(); }}>{t('saBackToSender')}</button>}
    {busy && <p role="status">{t('pleaseWait')}</p>}
  </section>;
}
