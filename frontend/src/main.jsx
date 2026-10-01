import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { languages, languageStorageKey, readLanguage, translate } from './i18n/translations';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const statuses = ['Sent', 'In Transit', 'Ready to Collect', 'Collected'];
const money = (amount, currency) => `${currency} ${Number(amount).toFixed(2)}`;

async function api(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('networkError');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('requestFailed');
  }
  // Store translation keys, so an error already on screen changes language too.
  if (!response.ok) {
    let key = 'requestFailed';
    if (response.status === 404) {
      key = data.detail === 'Recipient not found' ? 'recipientNotFound' : 'transferNotFound';
    } else if (response.status === 422) {
      key = 'invalidData';
    } else if (response.status === 409) {
      key = method === 'PATCH' ? 'statusConflict' : 'quoteChanged';
      if (data.detail === 'Transfer is already Collected') key = 'alreadyCollected';
    }
    throw new Error(key);
  }
  return data;
}

function QuoteDetails({ quote, t }) {
  return (
    <dl>
      <dt>{t('youSend')}</dt><dd>{money(quote.send_amount, quote.send_currency)}</dd>
      <dt>{t('transferFee')}</dt><dd>{money(quote.fee, quote.send_currency)}</dd>
      <dt>{t('exchangeRate')}</dt><dd>1 ZAR = {quote.exchange_rate} {quote.receive_currency}</dd>
      <dt>{t('totalYouPay')}</dt><dd>{money(quote.total_cost, quote.send_currency)}</dd>
      <dt>{t('recipientReceives')}</dt><dd>{money(quote.receive_amount, quote.receive_currency)}</dd>
    </dl>
  );
}

function App() {
  const [language, setLanguage] = useState(readLanguage);
  const t = (key, values) => translate(language, key, values);
  const statusLabel = (status) => t(`status.${status}`);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(languageStorageKey, language);
    } catch {
      // Language switching still works when browser storage is unavailable.
    }
  }, [language]);

  const [recipients, setRecipients] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadRecipients() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/recipients');
      setRecipients(data);
      setRecipientId(String(data[0]?.id || ''));
    } catch (err) {
      setError(err.message || 'requestFailed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRecipients(); }, []);

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message || 'requestFailed');
    } finally {
      setBusy(false);
    }
  }

  function getQuote(event) {
    event.preventDefault();
    setQuote(null);
    if (!recipientId) {
      setError('recipientRequired');
      return;
    }
    const input = event.currentTarget.elements.namedItem('amount');
    // Replace browser-language validation bubbles with the selected app language.
    if (!input.validity.valid) {
      setError(input.validity.valueMissing && !input.validity.badInput ? 'amountRequired' : 'invalidAmount');
      return;
    }
    run(async () => setQuote(await api('/quote', 'POST', {
      recipient_id: Number(recipientId), amount,
    })));
  }

  const nextStatus = transfer ? statuses[statuses.indexOf(transfer.status) + 1] : null;
  const recipient = recipients.find((item) => item.id === Number(recipientId));

  return (
    <main>
      <h1>KingaPesa</h1>
      <label htmlFor="language">{t('language')}</label>
      <select id="language" value={language} onChange={(event) => setLanguage(event.target.value)}>
        {languages.map(({ code, name }) => <option key={code} value={code} lang={code}>{name}</option>)}
      </select>
      <p>{t('introduction')}</p>
      <p>{t('feeExplanation')}</p>
      {error && <p role="alert" className="error">{t(error)}</p>}
      {loading ? <p role="status">{t('loadingRecipients')}</p> : recipients.length === 0 ? (
        <button onClick={loadRecipients}>{t('retryRecipients')}</button>
      ) : !transfer ? (
        <>
          <form onSubmit={getQuote} noValidate>
            <fieldset disabled={busy}>
              <legend>{t('sendMoney')}</legend>
              <label htmlFor="recipient">{t('selectRecipient')}</label>
              <select id="recipient" value={recipientId} onChange={(event) => {
                setRecipientId(event.target.value); setQuote(null); setError('');
              }}>
                {recipients.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} — {item.country} ({item.currency})</option>
                ))}
              </select>
              <label htmlFor="amount">{t('amountToSend')}</label>
              <input id="amount" name="amount" type="number" inputMode="decimal" min="0.01" max="1000000"
                step="0.01" required value={amount} onChange={(event) => {
                  setAmount(event.target.value); setQuote(null); setError('');
                }} />
              <button type="submit">{t('getQuote')}</button>
            </fieldset>
          </form>
          {quote && <section aria-labelledby="quote-heading">
            <h2 id="quote-heading">{t('quoteSummary', { name: recipient?.name })}</h2>
            <QuoteDetails quote={quote} t={t} />
            <button disabled={busy} onClick={() => run(async () => {
              setTransfer(await api('/transfers', 'POST', quote));
              setQuote(null);
            })}>{t('confirmAndSend')}</button>
          </section>}
        </>
      ) : (
        <section aria-labelledby="transfer-heading">
          <h2 id="transfer-heading">{t('transferSuccessful')}</h2>
          <p>{t('transferDetails', { id: transfer.id, name: recipient?.name })}</p>
          <QuoteDetails quote={transfer} t={t} />
          <p role="status">{t('transferStatus')} <strong>{statusLabel(transfer.status)}</strong></p>
          <p className="status-flow">{statuses.map(statusLabel).join(' → ')}</p>
          {nextStatus && <button disabled={busy} onClick={() => run(async () => {
            setTransfer(await api(`/transfers/${transfer.id}/status`, 'PATCH', { status: nextStatus }));
          })}>{t('advanceStatus', { status: statusLabel(nextStatus) })}</button>}
          <button disabled={busy} onClick={() => run(async () => {
            setTransfer(await api(`/transfers/${transfer.id}`));
          })}>{t('refreshStatus')}</button>
          <button disabled={busy} onClick={() => {
            setTransfer(null); setAmount(''); setError('');
          }}>{t('startAnotherTransfer')}</button>
        </section>
      )}
      {busy && <p role="status">{t('pleaseWait')}</p>}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
