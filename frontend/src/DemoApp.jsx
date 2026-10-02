import React, { useEffect, useRef, useState } from 'react';
import { languages, languageStorageKey, readLanguage, translate } from './i18n/translations';

import { api } from './api';
import { keys, readStored, writeStored, storageAvailable } from './storage';
import { useConnection } from './useConnection';
import RecipientAccess from './RecipientAccess';
import FamilyServices from './FamilyServices';
import { senders, fixedFeeLabels, readSenderCountry } from './sender';

const statuses = ['Sent', 'In Transit', 'Ready to Collect', 'Collected'];
const money = (amount, currency) => `${currency} ${Number(amount).toFixed(2)}`;

function QuoteDetails({ quote, t }) {
  return (
    <dl>
      <dt>{t('youSend')}</dt><dd>{money(quote.send_amount, quote.send_currency)}</dd>
      <dt>{t('transferFee')}</dt><dd>{money(quote.fee, quote.send_currency)}</dd>
      <dt>{t('exchangeRate')}</dt><dd>1 {quote.send_currency} = {quote.exchange_rate} {quote.receive_currency}</dd>
      <dt>{t('totalYouPay')}</dt><dd>{money(quote.total_cost, quote.send_currency)}</dd>
      <dt>{t('recipientReceives')}</dt><dd>{money(quote.receive_amount, quote.receive_currency)}</dd>
    </dl>
  );
}

export default function DemoApp({ renderSend }) {
  const [senderArea, setSenderArea] = useState('money');
  const [serviceBusy, setServiceBusy] = useState(false);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [saved] = useState(() => {
    const draft = readStored(keys.draft, {});
    const current = readStored(keys.currentTransfer, {});
    const recipients = readStored(keys.recipients, []);
    return {
      draft: draft && typeof draft === 'object' ? draft : {},
      current: current?.transfer?.id && statuses.includes(current.transfer.status) ? current : {},
      recipients: Array.isArray(recipients) ? recipients.filter(item => item?.id && item.name && item.currency) : [],
    };
  });
  const [senderCountry, setSenderCountry] = useState(() => readSenderCountry(saved.draft));
  const sendCurrency = senders.find(sender => sender.country === senderCountry).currency;
  const [language, setLanguage] = useState(() =>
    languages.some(item => item.code === saved.draft.language) ? saved.draft.language : readLanguage());
  const t = (key, values) => translate(language, key, values);
  const statusLabel = status => t(`status.${status}`);
  const { connection, reconnected, healthEpoch, checkConnection, reportFailure } = useConnection();
  const [canSave, setCanSave] = useState(storageAvailable);
  const [dataLight, setDataLight] = useState(() => readStored(keys.dataLight, false) === true);
  const [sponsoredDemo, setSponsoredDemo] = useState(() => readStored(keys.sponsoredDemo, false) === true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [recipients, setRecipients] = useState(saved.recipients);
  const [recipientId, setRecipientId] = useState(String(saved.draft.recipientId || saved.current.transfer?.recipient_id || saved.recipients[0]?.id || ''));
  const [amount, setAmount] = useState(typeof saved.draft.amount === 'string' ? saved.draft.amount : '');
  const [draftDirty, setDraftDirty] = useState(Boolean(saved.draft.recipientId || saved.draft.amount));
  const [quote, setQuote] = useState(null);
  const quoteStale = useRef(false);
  const [transfer, setTransfer] = useState(saved.current.transfer || null);
  const [transferName, setTransferName] = useState(saved.current.recipientName || '');
  const [notifications, setNotifications] = useState(Array.isArray(saved.current.notifications) ? saved.current.notifications : []);
  const [recipientsCached, setRecipientsCached] = useState(saved.recipients.length > 0);
  const [transferCached, setTransferCached] = useState(Boolean(saved.current.transfer));
  const [notificationsCached, setNotificationsCached] = useState(Boolean(saved.current.transfer));
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState(false);
  const [pendingSend, setPendingSend] = useState(() => Boolean(readStored(keys.pendingSend, null)) && !saved.current.transfer);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const syncedEpoch = useRef(0);

  function save(key, value) {
    if (!writeStored(key, value)) setCanSave(false);
  }

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(languageStorageKey, language); }
    catch { setCanSave(false); }
  }, [language]);

  useEffect(() => { save(keys.senderCountry, senderCountry); }, [senderCountry]);

  useEffect(() => {
    if (draftDirty && !transfer) save(keys.draft, { recipientId, amount, language, sendCurrency });
  }, [recipientId, amount, language, sendCurrency, draftDirty, transfer]);

  function changeSender(country) {
    if (!senders.some(sender => sender.country === country)) return;
    setSenderCountry(country);
    setQuote(null);
    quoteStale.current = false;
    setError('');
    // Neither transaction history nor uncertainty markers are changed here.
  }

  useEffect(() => {
    if (connection === 'offline' || connection === 'weak') {
      quoteStale.current = true;
      setRecipientsCached(true);
      setTransferCached(true);
      setNotificationsCached(true);
    }
  }, [connection]);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    // This caches only the application files, never API data or mutations.
    navigator.serviceWorker.ready.then(() => setOfflineReady(true));
    if (navigator.onLine) {
      navigator.serviceWorker.register('/sw.js').catch(() => setOfflineReady(Boolean(navigator.serviceWorker.controller)));
    }
  }, []);

  function handleError(err) {
    reportFailure(err);
    setError(err.message || 'requestFailed');
  }

  async function loadRecipients() {
    setLoading(true);
    try {
      const data = await api('/recipients');
      setRecipients(data);
      setRecipientsCached(false);
      save(keys.recipients, data);
      setRecipientId(current => current || String(data[0]?.id || ''));
    } catch (err) {
      setRecipientsCached(true);
      handleError(err);
    } finally { setLoading(false); }
  }

  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (err) { handleError(err); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function saveTransfer(updated, records, name) {
    save(keys.currentTransfer, { transfer: updated, notifications: records, recipientName: name });
  }

  async function displayTransfer(updatedTransfer) {
    const name = recipients.find(item => item.id === updatedTransfer.recipient_id)?.name || transferName;
    const previous = updatedTransfer.id === transfer?.id ? notifications : [];
    setTransfer(updatedTransfer);
    setTransferName(name);
    setTransferCached(false);
    setNotificationError(false);
    setNotifications(previous);
    saveTransfer(updatedTransfer, previous, name);
    if (!['Ready to Collect', 'Collected'].includes(updatedTransfer.status)) return;
    setNotificationLoading(true);
    try {
      const records = await api(`/transfers/${updatedTransfer.id}/notifications`);
      setNotifications(records);
      setNotificationsCached(false);
      saveTransfer(updatedTransfer, records, name);
    } catch (err) {
      reportFailure(err);
      setNotificationsCached(true);
      setNotificationError(true);
    } finally { setNotificationLoading(false); }
  }

  async function refreshTransfer() {
    try { await displayTransfer(await api(`/transfers/${transfer.id}`)); }
    catch (err) { setTransferCached(true); throw err; }
  }

  // One read-only synchronization per successful health check, never polling.
  // Wait for any explicit action to finish rather than overlap it with refreshes.
  useEffect(() => {
    if (recipientOpen || !healthEpoch || syncedEpoch.current === healthEpoch || busy || connection !== 'online') return;
    syncedEpoch.current = healthEpoch;
    run(async () => {
      if (transfer) await refreshTransfer();
      else if (!dataLight || recipients.length === 0) await loadRecipients();
    });
  }, [healthEpoch, busy, connection, recipientOpen]);

  function getQuote(event) {
    event.preventDefault();
    if (!navigator.onLine) { setError(canSave ? 'offlineQuote' : 'offlineQuoteUnsaved'); return; }
    if (connection !== 'online') { setError('weakConnection'); return; }
    if (!recipients.some(item => item.id === Number(recipientId))) { setError('recipientRequired'); return; }
    const input = event.currentTarget.elements.namedItem('amount');
    if (!input.validity.valid) {
      setError(input.validity.valueMissing && !input.validity.badInput ? 'amountRequired' : 'invalidAmount');
      return;
    }
    run(async () => {
      const latest = await api('/quote', 'POST', { recipient_id: Number(recipientId), amount, send_currency: sendCurrency });
      setQuote(latest);
      quoteStale.current = false;
    });
  }

  async function confirmTransfer() {
    if (!navigator.onLine || connection !== 'online' || !quote || quote.send_currency !== sendCurrency) return;
    if (pendingSend || readStored(keys.pendingSend, null)) { setPendingSend(true); return; }
    let confirmed = quote;
    if (quoteStale.current) {
      const latest = await api('/quote', 'POST', { recipient_id: quote.recipient_id, amount: quote.send_amount, send_currency: quote.send_currency });
      const numeric = ['send_amount', 'fee', 'exchange_rate', 'total_cost', 'receive_amount'];
      const changed = numeric.some(key => Number(latest[key]) !== Number(quote[key])) ||
        latest.receive_currency !== quote.receive_currency || latest.send_currency !== quote.send_currency;
      setQuote(latest);
      quoteStale.current = false;
      if (changed) { setError('quoteUpdated'); return; }
      confirmed = latest;
    }
    // Persist an uncertainty marker before sending. Never automatically retry a POST.
    save(keys.pendingSend, { recipientId: confirmed.recipient_id, amount: confirmed.send_amount, sendCurrency: confirmed.send_currency, createdAt: new Date().toISOString() });
    setPendingSend(true);
    let created;
    try { created = await api('/transfers', 'POST', confirmed); }
    catch (err) {
      if (err.kind === 'application' && err.status >= 400 && err.status < 500) {
        save(keys.pendingSend, null);
        setPendingSend(false);
      }
      throw err;
    }
    await displayTransfer(created);
    save(keys.pendingSend, null);
    setPendingSend(false);
    save(keys.draft, null);
    setDraftDirty(false);
    setQuote(null);
    setAmount('');
  }

  function startAnotherTransfer() {
    save(keys.currentTransfer, null);
    save(keys.draft, null);
    setDraftDirty(false);
    setTransfer(null); setQuote(null); setAmount(''); setError('');
    setNotifications([]); setNotificationError(false); setTransferName('');
  }

  const nextStatus = transfer ? statuses[statuses.indexOf(transfer.status) + 1] : null;
  const recipient = recipients.find(item => item.id === Number(recipientId));
  const live = connection === 'online';
  const connectionText = connection === 'online' ? (reconnected ? 'backOnline' : 'online') :
    connection === 'checking' ? 'checkingConnection' : connection === 'offline' ?
      (canSave ? 'deviceOffline' : 'offlineUnsaved') : (canSave ? 'weakConnection' : 'weakUnsaved');

  // The polished sender view shares these exact API/persistence handlers with /demo.
  if (renderSend) return renderSend({
    t, language, setLanguage, recipients, recipientId, recipient, amount, sendCurrency,
    senderCountry, changeSender, quote, transfer, transferName, statuses, nextStatus,
    busy, loading, live, connection, connectionText, checkConnection, canSave, error,
    pendingSend, draftDirty, recipientsCached, transferCached, notifications,
    notificationsCached, notificationLoading, notificationError,
    selectRecipient: value => { setRecipientId(value); setDraftDirty(true); setQuote(null); setError(''); },
    editAmount: value => { setAmount(value); setDraftDirty(true); setQuote(null); setError(''); },
    editQuote: () => { setQuote(null); setError(''); },
    getQuote, confirm: () => run(confirmTransfer),
    retryRecipients: () => run(loadRecipients), refresh: () => run(refreshTransfer),
    advance: () => run(async () => {
      await displayTransfer(await api(`/transfers/${transfer.id}/status`, 'PATCH', { status: nextStatus }));
    }),
    startAgain: startAnotherTransfer,
  });

  if (recipientOpen && transfer) return (
    <main>
      <h1>KingaPesa</h1>
      <label htmlFor="recipient-language">{t('language')}</label>
      <select id="recipient-language" value={language} onChange={event => setLanguage(event.target.value)}>
        {languages.map(({ code, name }) => <option key={code} value={code} lang={code}>{name}</option>)}
      </select>
      {connection === 'weak' && <button onClick={checkConnection}>{t('retryConnection')}</button>}
      <RecipientAccess transferId={transfer.id} currency={transfer.receive_currency} t={t} live={live}
        reportFailure={reportFailure} onExit={() => {
          setRecipientOpen(false);
          setTransferCached(true);
          if (live) run(refreshTransfer);
        }} />
    </main>
  );

  return (
    <main>
      <h1>KingaPesa</h1>
      <label htmlFor="language">{t('language')}</label>
      <select id="language" value={language} onChange={(event) => setLanguage(event.target.value)}>
        {languages.map(({ code, name }) => <option key={code} value={code} lang={code}>{name}</option>)}
      </select>
      <p role="status" className="connection-status">{t(connectionText)}</p>
      {connection === 'weak' && <button disabled={busy} onClick={checkConnection}>{t('retryConnection')}</button>}
      {!canSave && <p role="alert">{t('storageUnavailable')}</p>}
      <label htmlFor="sender-country">{t('sendingFrom')}</label>
      <select id="sender-country" value={senderCountry} disabled={busy || serviceBusy}
        onChange={event => changeSender(event.target.value)}>
        {senders.map(sender => <option key={sender.country} value={sender.country}>
          {t(`senderCountry.${sender.country}`)} {sender.flag} — {sender.currency}
        </option>)}
      </select>
      <nav aria-label={t('fsChoose')}>
        <button disabled={busy || serviceBusy} aria-pressed={senderArea === 'money'} onClick={() => setSenderArea('money')}>{t('sendMoney')}</button>
        <button disabled={busy || serviceBusy} aria-pressed={senderArea === 'services'} onClick={() => setSenderArea('services')}>{t('fsSupport')}</button>
      </nav>
      <aside className="data-access" aria-labelledby="data-access-heading">
        <h2 id="data-access-heading">{t('dataAccess')}</h2>
        <p>{t('dataAccessExplanation')}</p>
        <p><strong>{t('sponsoredDisclaimer')}</strong></p>
        <label className="toggle"><input type="checkbox" checked={sponsoredDemo} onChange={event => {
          setSponsoredDemo(event.target.checked); save(keys.sponsoredDemo, event.target.checked);
        }} />{t('sponsoredToggle')}</label>
        {sponsoredDemo && <p>{t('sponsoredEnabled')}</p>}
        {sponsoredDemo && <p>{t('sponsoredScenario')}</p>}
        <label className="toggle"><input type="checkbox" checked={dataLight} onChange={event => {
          setDataLight(event.target.checked); save(keys.dataLight, event.target.checked);
        }} />{t('dataLightToggle')}</label>
        <p>{t('dataLightExplanation')}</p>
        <p>{t(offlineReady ? 'offlineReloadReady' : 'offlineReloadNotReady')}</p>
      </aside>
      {senderArea === 'services' ? <FamilyServices sendCurrency={sendCurrency} recipients={recipients} loadRecipients={loadRecipients}
        live={live} healthEpoch={healthEpoch} reportFailure={reportFailure} t={t}
        onBusy={setServiceBusy} onBack={() => setSenderArea('money')} /> : <>
      <p>{t('introduction')}</p>
      <p>{t('feeExplanation', { currency: transfer?.send_currency || sendCurrency, fixedFee: fixedFeeLabels[transfer?.send_currency || sendCurrency] })}</p>
      {error && <p role="alert" className="error">{t(error, { currency: sendCurrency })}</p>}
      {pendingSend && !transfer && !busy && <p role="alert">{t('sendUncertain')}</p>}
      {!transfer ? (
        <>
          {loading && <p role="status">{t('loadingRecipients')}</p>}
          {(recipientsCached || !live) && recipients.length > 0 && <p>{t('cachedRecipients')}</p>}
          {recipients.length === 0 && <p>{t('noSavedRecipients')}</p>}
          {recipients.length === 0 && <button disabled={busy || !live} onClick={() => run(loadRecipients)}>{t('retryRecipients')}</button>}
          {draftDirty && canSave && <p>{t('draftSaved')}</p>}
          <form onSubmit={getQuote} noValidate>
            <fieldset disabled={busy}>
              <legend>{t('sendMoney')}</legend>
              <label htmlFor="recipient">{t('selectRecipient')}</label>
              <select id="recipient" value={recipientId} onChange={(event) => {
                setRecipientId(event.target.value); setDraftDirty(true); setQuote(null); setError('');
              }}>
                {!recipients.some(item => item.id === Number(recipientId)) && <option value={recipientId}>{t('selectRecipient')}</option>}
                {recipients.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} — {item.country} ({item.currency})</option>
                ))}
              </select>
              <label htmlFor="amount">{t('amountToSend', { currency: sendCurrency })}</label>
              <input id="amount" name="amount" type="number" inputMode="decimal" min="0.01" max="1000000"
                step="0.01" required value={amount} onChange={(event) => {
                  setAmount(event.target.value); setDraftDirty(true); setQuote(null); setError('');
                }} />
              <button type="submit">{t('getQuote')}</button>
            </fieldset>
          </form>
          {quote?.send_currency === sendCurrency && <section aria-labelledby="quote-heading">
            <h2 id="quote-heading">{t('quoteSummary', { name: recipient?.name })}</h2>
            <QuoteDetails quote={quote} t={t} />
            {!live && <p>{t('reconnectBeforeSend')}</p>}
            <button disabled={busy || !live || pendingSend} onClick={() => run(confirmTransfer)}>{t('confirmAndSend')}</button>
          </section>}
        </>
      ) : (
        <section aria-labelledby="transfer-heading">
          <h2 id="transfer-heading">{t('transferSuccessful')}</h2>
          <p>{t('transferDetails', { id: transfer.id, name: transferName || recipient?.name || transfer.recipient_id })}</p>
          <QuoteDetails quote={transfer} t={t} />
          <p role="status">{t(transferCached || !live ? 'savedTransferStatus' : 'transferStatus')} <strong>{statusLabel(transfer.status)}</strong></p>
          <p className="status-flow">{statuses.map(statusLabel).join(' → ')}</p>
          {transfer.status === 'Ready to Collect' && <button disabled={busy} onClick={() => setRecipientOpen(true)}>{t('saOpenRecipient')}</button>}
          {(notifications.length > 0 || notificationLoading || notificationError) && (
            <section className="notification-card" aria-labelledby="notification-heading" aria-live="polite">
              <h3 id="notification-heading">{t('receiverNotification')}</h3>
              <p>{t('simulatedNotification')}</p>
              {(notificationsCached || !live) && notifications.length > 0 && <p>{t('cachedNotifications')}</p>}
              {notificationLoading && <p role="status">{t('loadingNotifications')}</p>}
              {notificationError && <p role="alert">{t('notificationLoadFailed')}</p>}
              {notifications.map((notification) => (
                <div key={notification.id}>
                  <p>{t('notificationSent', { name: notification.recipient_name })}</p>
                  <p>{t('notificationMessage', {
                    name: notification.recipient_name,
                    amount: money(notification.receive_amount, notification.receive_currency),
                  })}</p>
                </div>
              ))}
            </section>
          )}
          {nextStatus && <button disabled={busy || !live || transferCached} onClick={() => run(async () => {
            await displayTransfer(await api(`/transfers/${transfer.id}/status`, 'PATCH', { status: nextStatus }));
          })}>{t('advanceStatus', { status: statusLabel(nextStatus) })}</button>}
          <button disabled={busy || !live} onClick={() => run(refreshTransfer)}>{t('refreshStatus')}</button>
          <button disabled={busy} onClick={startAnotherTransfer}>{t('startAnotherTransfer')}</button>
        </section>
      )}
      {busy && <p role="status">{t('pleaseWait')}</p>}
      </>}
    </main>
  );
}

