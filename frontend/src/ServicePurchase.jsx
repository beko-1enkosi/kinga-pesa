import React, { useEffect, useRef, useState } from 'react';
import { Navbar, Icon } from './components/WelcomeParts';
import { DemoBalance } from './components/DemoBalance';
import { buyDemoUtility, cents, formatZar } from './demoAccount';
import { api } from './api';
import { useConnection } from './useConnection';
import { keys, readStored, writeStored } from './storage';
import { languageStorageKey, readLanguage, translate } from './i18n/translations';
import './welcome.css';
import './send.css';
import './services.css';

const choices = { airtime: [20, 50, 100], electricity: [100, 200, 500], voucher: [100, 250, 500] };
const fresh = () => ({ id: crypto.randomUUID(), target: '', amount: '', step: 1, receipt: null });

export default function ServicePurchase() {
  const type = window.location.pathname.replace(/\/$/, '').split('/').at(-1);
  const storageKey = `kingapesa.nativeService.${type}`;
  const [draft, setDraft] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (saved && typeof saved.id === 'string' && typeof saved.target === 'string' && typeof saved.amount === 'string' && [1,2,3,4].includes(saved.step) && (saved.step !== 4 || saved.receipt?.type === type)) return saved;
    } catch { /* A missing/invalid draft starts a new purchase, never a debit. */ }
    return fresh();
  });
  const [language, setLanguage] = useState(readLanguage);
  const t = (key, values) => translate(language, key, values);
  const { connection, healthEpoch, reconnected, checkConnection, reportFailure } = useConnection();
  const [recipients, setRecipients] = useState(() => {
    const cached = readStored(keys.recipients, []);
    return Array.isArray(cached) ? cached.filter(person => person?.id && person.name && person.country) : [];
  });
  const [cached, setCached] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const heading = useRef(null);
  const live = connection === 'online';
  const receipt = draft.receipt;
  const connectionKey = live ? (reconnected ? 'backOnline' : 'online') : connection === 'checking' ? 'checkingConnection' : connection === 'offline' ? 'deviceOffline' : 'weakConnection';

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(languageStorageKey, language); } catch { /* Preference is optional. */ }
  }, [language]);
  useEffect(() => { heading.current?.focus(); }, [draft.step]);
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  useEffect(() => {
    if (!healthEpoch || !live || type === 'electricity') return;
    let active = true;
    api('/recipients').then(data => {
      if (!active) return;
      setRecipients(data); setCached(false); writeStored(keys.recipients, data);
    }).catch(err => { if (active) { setCached(true); reportFailure(err); } });
    return () => { active = false; };
  }, [healthEpoch, live, type, reportFailure]);

  function save(next) {
    // A stable purchase ID survives refresh. Receipts/drafts contain no balance or PIN.
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setError('accountUnavailable'); return false; }
    setDraft(next); return true;
  }
  function change(field, value) {
    setError(''); save({ ...draft, [field]: value });
  }
  function next(event) {
    event.preventDefault(); setError('');
    if (draft.step === 1) {
      const target = draft.target.trim();
      const savedRecipient = recipients.some(person => person.name === target);
      const valid = type === 'electricity' ? /^\d{6,20}$/.test(target) : type === 'airtime' ? savedRecipient || /^\+?[\d -]{7,20}$/.test(target) : target.length >= 2 && target.length <= 80;
      if (!valid) { setError('utilityInvalidTarget'); return; }
      save({ ...draft, target, step: 2 });
    } else {
      try { if (cents(draft.amount) > 100000000) throw new Error('invalidAmount'); }
      catch { setError('invalidAmount'); return; }
      save({ ...draft, step: 3 });
    }
  }
  async function confirm() {
    if (locked.current || receipt) return;
    if (!live || !navigator.onLine) { setError('nativeReconnect'); return; }
    if (!save(draft)) return;
    locked.current = true; setBusy(true); setError('');
    try {
      // Exactly the same function used by WhatsApp: limits, debit, token and deduplication.
      const result = await buyDemoUtility({ id: draft.id, type, target: draft.target, amount: draft.amount });
      const completed = { ...draft, step: 4, receipt: result };
      // Always show a completed purchase; the prior persisted ID still prevents replay
      // if storage fills up between the debit and saving the success screen.
      save(completed); setDraft(completed);
    } catch (err) { setError(err.message || 'requestFailed'); }
    finally { locked.current = false; setBusy(false); }
  }
  function cancel() {
    if (locked.current) return;
    try { sessionStorage.removeItem(storageKey); } catch { setError('accountUnavailable'); return; }
    window.location.assign('/app');
  }
  function again() { setError(''); save(fresh()); }

  return <div className="kp-home kp-send-page kp-native-service">
    <Navbar back language={language} onLanguageChange={setLanguage} />
    <main className="kp-send-main">
      <a className="kp-send-back" href="/app">← {t('waBack')}</a>
      <div className="kp-send-heading"><div><p className="kp-eyebrow">{t('utilityHeading')}</p><h1 ref={heading} tabIndex={-1}>{t(`utility.${type}`)}</h1></div><span role="status" className="kp-send-connection">{t(connectionKey)}</span></div>
      {connection === 'weak' && <button className="kp-send-link" onClick={checkConnection}>{t('retryConnection')}</button>}
      <DemoBalance t={t} />
      {error && <p role="alert" className="kp-send-message">{t(error, { currency: 'ZAR' })}</p>}
      {!receipt && <ol className="kp-send-steps" aria-label={t('nativeSteps')}>{['nativeDetails','nativeAmount','nativeReview'].map((key,index) => <li key={key} className={draft.step === index+1 ? 'is-current' : ''} aria-current={draft.step === index+1 ? 'step' : undefined}><span>{index+1}</span>{t(key)}</li>)}</ol>}
      <section className="kp-send-panel">
        {draft.step === 1 && <form onSubmit={next} noValidate>
          <h2>{t(`nativeTargetTitle.${type}`)}</h2>
          {type !== 'electricity' && <>
            <p className="kp-send-muted">{t('nativeChooseOrType')}</p>
            {(cached || !live) && recipients.length > 0 && <p className="kp-send-muted">{t('cachedRecipients')}</p>}
            <fieldset className="kp-recipient-options"><legend className="kp-sr-only">{t('selectRecipient')}</legend>{recipients.map(person => <label key={person.id} className={`kp-recipient-option${draft.target === person.name ? ' is-selected' : ''}`}><input type="radio" name="service-recipient" checked={draft.target === person.name} onChange={() => change('target',person.name)} /><span className="kp-send-avatar" aria-hidden="true">{person.name[0]}</span><span><strong>{person.name}</strong><small>{person.country}</small></span></label>)}</fieldset>
          </>}
          <div className="kp-amount-fields"><label htmlFor="utility-target">{t(`nativeTargetLabel.${type}`)}</label><input id="utility-target" value={draft.target} onChange={event => change('target',event.target.value)} inputMode={type === 'electricity' ? 'numeric' : 'text'} autoComplete="off" maxLength={type === 'electricity' ? 20 : 80} required /></div>
          <button className="kp-button kp-send-primary" type="submit">{t('nativeContinue')} <Icon name="arrow" /></button>
        </form>}
        {draft.step === 2 && <form onSubmit={next} noValidate>
          <h2>{t('nativeChooseAmount')}</h2><p className="kp-send-muted">{t('utilityTarget')}: <strong>{draft.target}</strong></p>
          <div className="kp-amount-fields"><label htmlFor="utility-amount">{t('nativeAmountLabel')}</label><input id="utility-amount" type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" required placeholder="0.00" value={draft.amount} onChange={event => change('amount',event.target.value)} /></div>
          <div className="kp-quick-amounts" aria-label={t('nativeQuickAmounts')}>{choices[type].map(amount => <button key={amount} type="button" aria-pressed={Number(draft.amount) === amount} onClick={() => change('amount',String(amount))}>R{amount}</button>)}</div>
          <p className="kp-send-muted">{t('utilityAmount')}</p><button type="submit" className="kp-button kp-send-primary">{t('nativeReview')} <Icon name="arrow" /></button>
        </form>}
        {draft.step === 3 && <>
          <h2>{t('nativeReviewTitle')}</h2><p className="kp-send-muted">{t('utilityReview')}</p>
          <dl className="kp-send-summary"><div><dt>{t(type === 'electricity' ? 'nativeMeter' : 'utilityTarget')}</dt><dd>{draft.target}</dd></div><div><dt>{t('nativePurchaseValue')}</dt><dd>{formatZar(cents(draft.amount))}</dd></div><div><dt>{t('transferFee')}</dt><dd>R0.00</dd></div><div className="kp-send-total"><dt>{t('utilityCost')}</dt><dd>{formatZar(cents(draft.amount))}</dd></div></dl>
          {!live && <p className="kp-send-message">{t('nativeReconnect')}</p>}
          <button className="kp-button kp-send-primary" disabled={busy || !live} onClick={confirm}>{t('nativeConfirm')} <Icon name="arrow" /></button>
        </>}
        {receipt && <>
          <div className="kp-send-success" aria-hidden="true">✓</div><h2>{t(`nativeSuccess.${type}`)}</h2><p className="kp-send-muted">{t('utilitySuccess')}</p>
          <dl className="kp-send-summary"><div><dt>{t(type === 'electricity' ? 'nativeMeter' : 'utilityTarget')}</dt><dd>{receipt.target}</dd></div><div className="kp-send-total"><dt>{t('utilityCost')}</dt><dd>{formatZar(receipt.amount)}</dd></div></dl>
          <div className="kp-native-reference"><h3>{t(type === 'electricity' ? 'utilityToken' : type === 'voucher' ? 'nativeVoucherCode' : 'utilityReference')}</h3><p>{receipt.reference}</p></div>
          <div className="kp-send-finish"><button className="kp-button" onClick={again}>{t(type === 'voucher' ? 'nativeAnotherVoucher' : 'nativeBuyAgain')}</button><a className="kp-send-secondary" href="/app">{t('waBack')}</a></div>
        </>}
        {!receipt && <div className="kp-native-navigation">{draft.step > 1 && <button className="kp-send-link" disabled={busy} onClick={() => { setError(''); save({ ...draft, step: draft.step-1 }); }}>← {t('nativeBack')}</button>}<button className="kp-send-link" disabled={busy} onClick={cancel}>{t('waCancel')}</button></div>}
        {busy && <p role="status">{t('pleaseWait')}</p>}
      </section>
      <p className="kp-send-footnote">{t('nativeDisclaimer')}</p>
    </main>
  </div>;
}
