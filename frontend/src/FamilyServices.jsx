import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { keys, readStored, writeStored } from './storage';

const types = ['airtime', 'electricity', 'grocery_voucher'];
const icons = { airtime: '📱', electricity: '⚡', grocery_voucher: '🛒' };
const money = (amount, currency) => `${currency} ${amount}`;

function ServiceDetails({ quote, t }) {
  return <dl>
    <dt>{t('fsProvider')}</dt><dd>{quote.provider}</dd>
    <dt>{t('youSend')}</dt><dd>{money(quote.send_amount, quote.send_currency)}</dd>
    <dt>{t('fsServiceFee')}</dt><dd>{money(quote.service_fee, quote.send_currency)}</dd>
    <dt>{t('totalYouPay')}</dt><dd>{money(quote.total_cost, quote.send_currency)}</dd>
    <dt>{t('exchangeRate')}</dt><dd>1 ZAR = {quote.exchange_rate} {quote.local_currency}</dd>
    <dt>{t(`fsValue.${quote.service_type}`)}</dt><dd>{money(quote.local_value, quote.local_currency)}</dd>
  </dl>;
}

export default function FamilyServices({ recipients, loadRecipients, live, healthEpoch, reportFailure, t, onBusy, onBack }) {
  const [recipientId, setRecipientId] = useState(String(recipients[0]?.id || ''));
  const [catalog, setCatalog] = useState(null);
  const [serviceType, setServiceType] = useState('');
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [purchaseId, setPurchaseId] = useState(() => {
    const stored = readStored(keys.currentServicePurchase, null);
    return Number.isInteger(stored?.id) && stored.id > 0 ? stored.id : null;
  });
  const [purchase, setPurchase] = useState(null);
  const [pending, setPending] = useState(() => Boolean(readStored(keys.pendingServicePurchase, null)));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const quoteRevision = useRef(0);
  const blocked = busy || loading;
  const recipient = recipients.find(item => item.id === Number(recipientId));

  useEffect(() => { onBusy(blocked); return () => onBusy(false); }, [blocked, onBusy]);
  useEffect(() => { if (!recipientId && recipients.length) setRecipientId(String(recipients[0].id)); }, [recipients, recipientId]);
  useEffect(() => {
    if (!live) { quoteRevision.current += 1; setQuote(null); }
  }, [live]);

  function handleError(err) { reportFailure(err); setError(err.message || 'requestFailed'); }
  function store(key, value) {
    if (writeStored(key, value)) return true;
    setError('fsStorageRequired');
    return false;
  }

  // Reconnect performs GETs only. No purchase or quote is replayed.
  useEffect(() => {
    if (!live) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        if (purchaseId) {
          const result = await api(`/service-purchases/${purchaseId}`);
          if (active) {
            setPurchase(result);
            if (store(keys.pendingServicePurchase, null)) setPending(false);
          }
        } else if (!recipients.length) {
          await loadRecipients();
        } else if (recipientId) {
          const result = await api(`/recipients/${recipientId}/services`);
          if (active) setCatalog({ recipientId, services: result });
        }
      } catch (err) { if (active) handleError(err); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [live, healthEpoch, recipientId, purchaseId, recipients.length]);

  async function run(action) {
    if (busyRef.current || loading || !live || !navigator.onLine) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); } catch (err) { handleError(err); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function edit() { quoteRevision.current += 1; setQuote(null); setError(''); }

  function getQuote(event) {
    event.preventDefault();
    if (!live || !navigator.onLine || pending) return;
    if (!event.currentTarget.elements.namedItem('service-amount').validity.valid) { setError('fsInvalidAmount'); return; }
    const normalized = target.replace(/[\s-]/g, '');
    if (serviceType === 'airtime' && !/^\+263[0-9]{9}$/.test(normalized)) { setError('fsInvalidPhone'); return; }
    if (serviceType === 'electricity' && !/^[0-9]{6,20}$/.test(target.trim())) { setError('fsInvalidMeter'); return; }
    if (!recipient || !catalog?.services.some(item => item.type === serviceType)) { setError('fsUnavailable'); return; }
    run(async () => {
      const revision = quoteRevision.current;
      const result = await api('/service-quote', 'POST', { recipient_id: Number(recipientId), service_type: serviceType, amount });
      if (revision === quoteRevision.current && navigator.onLine) setQuote(result);
    });
  }

  async function confirm() {
    if (!quote || pending || readStored(keys.pendingServicePurchase, null)) { setPending(true); return; }
    // Save a marker BEFORE POST. Storage failure must not permit an untracked send.
    if (!store(keys.pendingServicePurchase, { createdAt: new Date().toISOString() })) return;
    setPending(true);
    let result;
    try {
      result = await api('/service-purchases', 'POST', {
        quote, target_reference: serviceType === 'grocery_voucher' ? recipient.name : target,
      });
    } catch (err) {
      if (err.kind === 'application' && err.status >= 400 && err.status < 500) {
        if (store(keys.pendingServicePurchase, null)) setPending(false);
        if (err.status === 409) setQuote(null);
      }
      throw err;
    }
    setPurchase(result); setTarget(''); setAmount(''); setQuote(null);
    // Only a lookup pointer is persisted; no phone, meter, token or voucher is cached.
    if (store(keys.currentServicePurchase, { id: result.id })) {
      setPurchaseId(result.id);
      if (store(keys.pendingServicePurchase, null)) setPending(false);
    }
  }

  function startAnother() {
    if (pending || !store(keys.currentServicePurchase, null)) return;
    setPurchaseId(null); setPurchase(null); setServiceType(''); setTarget(''); setAmount(''); edit();
  }

  const available = catalog?.recipientId === recipientId ? catalog.services : null;
  return <section aria-labelledby="family-services-heading">
    <h2 id="family-services-heading">{t('fsSupport')}</h2>
    {!live && <p role="status">{t('fsReconnect')}</p>}
    {error && <p role="alert">{t(error)}</p>}
    {pending && !purchase && !blocked && <p role="alert">{t('fsUncertain')}</p>}
    {purchase ? <section aria-labelledby="service-success-heading">
      <h3 id="service-success-heading">{t(`fsSuccess.${purchase.service_type}`)}</h3>
      <ServiceDetails quote={purchase} t={t} />
      <p>{t(purchase.service_type === 'airtime' ? 'fsPhone' : purchase.service_type === 'electricity' ? 'fsMeter' : 'fsDelivery')}: {purchase.target_reference}</p>
      {purchase.electricity_token && <p>{t('fsToken')}: <strong>{purchase.electricity_token}</strong></p>}
      {purchase.voucher_code && <p>{t('fsVoucherCode')}: <strong>{purchase.voucher_code}</strong></p>}
      <p>{t('fsReference')}: {purchase.fulfillment_reference}</p>
      <p><small>{t(`fsDisclaimer.${purchase.service_type}`)}</small></p>
      <button disabled={blocked || pending} onClick={startAnother}>{t('fsAnother')}</button>
    </section> : purchaseId ? <>
      <p>{t('fsRestore')}</p>
      <button disabled={blocked || !live} onClick={() => run(async () => setPurchase(await api(`/service-purchases/${purchaseId}`)))}>{t('fsRefresh')}</button>
      <button disabled={blocked || pending} onClick={startAnother}>{t('fsAnother')}</button>
    </> : <>
      <label htmlFor="service-recipient">{t('selectRecipient')}</label>
      <select id="service-recipient" disabled={blocked || pending} value={recipientId} onChange={event => {
        setRecipientId(event.target.value); setServiceType(''); setTarget(''); setCatalog(null); edit();
      }}>
        {!recipientId && <option value="">{t('selectRecipient')}</option>}
        {recipients.map(item => <option key={item.id} value={item.id}>{item.name} — {item.country} ({item.currency})</option>)}
      </select>
      {available?.length === 0 && <p>{t('fsUnavailable')}</p>}
      {types.map(type => <button key={type} disabled={blocked || pending || !available?.some(item => item.type === type)}
        aria-pressed={serviceType === type} onClick={() => { setServiceType(type); setTarget(''); edit(); }}>
        {icons[type]} {t(`fsType.${type}`)}
      </button>)}
      {serviceType && <form onSubmit={getQuote} noValidate>
        <fieldset disabled={blocked || pending}>
          <legend>{t(`fsType.${serviceType}`)}</legend>
          <p>{t('fsProvider')}: {available?.find(item => item.type === serviceType)?.provider}</p>
          {serviceType !== 'grocery_voucher' && <>
            <label htmlFor="service-target">{t(serviceType === 'airtime' ? 'fsPhone' : 'fsMeter')}</label>
            <input id="service-target" type={serviceType === 'airtime' ? 'tel' : 'text'} inputMode={serviceType === 'airtime' ? 'tel' : 'numeric'}
              autoComplete="off" maxLength={100} value={target} onChange={event => { setTarget(event.target.value); edit(); }} />
            {serviceType === 'airtime' && <p>{t('fsPhoneHint')}</p>}
          </>}
          <label htmlFor="service-amount">{t('amountToSend')}</label>
          <input id="service-amount" name="service-amount" type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" required
            value={amount} onChange={event => { setAmount(event.target.value); edit(); }} />
          <button type="submit" disabled={!live}>{t('getQuote')}</button>
        </fieldset>
      </form>}
      {quote && <section aria-labelledby="service-quote-heading">
        <h3 id="service-quote-heading">{t('quoteSummary', { name: recipient?.name })}</h3>
        <ServiceDetails quote={quote} t={t} />
        <p>{t('fsRecipientValue', { name: recipient?.name, value: money(quote.local_value, quote.local_currency), service: t(`fsType.${quote.service_type}`) })}</p>
        <p>{t(serviceType === 'airtime' ? 'fsPhone' : serviceType === 'electricity' ? 'fsMeter' : 'fsDelivery')}: {serviceType === 'grocery_voucher' ? recipient?.name : target}</p>
        <button disabled={blocked || !live || pending} onClick={() => run(confirm)}>{t(`fsBuy.${serviceType}`)}</button>
      </section>}
    </>}
    {blocked && <p role="status">{t('pleaseWait')}</p>}
    <button disabled={blocked} onClick={onBack}>{t('fsBack')}</button>
  </section>;
}
