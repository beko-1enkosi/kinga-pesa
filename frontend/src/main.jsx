import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

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
    throw new Error('Cannot reach the backend. Check that it is running and try again.');
  }
  const data = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join('. ')
      : data.detail;
    throw new Error(detail || 'The request failed. Please try again.');
  }
  return data;
}

function QuoteDetails({ quote }) {
  return (
    <dl>
      <dt>You send</dt><dd>{money(quote.send_amount, quote.send_currency)}</dd>
      <dt>Transfer fee</dt><dd>{money(quote.fee, quote.send_currency)}</dd>
      <dt>Exchange rate</dt><dd>1 ZAR = {quote.exchange_rate} {quote.receive_currency}</dd>
      <dt>Total you pay</dt><dd>{money(quote.total_cost, quote.send_currency)}</dd>
      <dt>Recipient receives</dt><dd>{money(quote.receive_amount, quote.receive_currency)}</dd>
    </dl>
  );
}

function App() {
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
      setError(err.message);
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
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function getQuote(event) {
    event.preventDefault();
    setQuote(null);
    run(async () => setQuote(await api('/quote', 'POST', {
      recipient_id: Number(recipientId), amount,
    })));
  }

  const nextStatus = transfer ? statuses[statuses.indexOf(transfer.status) + 1] : null;
  const recipient = recipients.find((item) => item.id === Number(recipientId));

  return (
    <main>
      <h1>KingaPesa</h1>
      <p>Demo only — mock rates, no real money is sent.</p>
      <p>Fee: ZAR 10.00 + 2% of the amount you send.</p>
      {error && <p role="alert" className="error">{error}</p>}
      {loading ? <p role="status">Loading recipients…</p> : recipients.length === 0 ? (
        <button onClick={loadRecipients}>Retry loading recipients</button>
      ) : !transfer ? (
        <>
          <form onSubmit={getQuote}>
            <fieldset disabled={busy}>
              <legend>Send money</legend>
              <label htmlFor="recipient">Recipient</label>
              <select id="recipient" value={recipientId} onChange={(event) => {
                setRecipientId(event.target.value); setQuote(null); setError('');
              }}>
                {recipients.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} — {item.country} ({item.currency})</option>
                ))}
              </select>
              <label htmlFor="amount">Amount in ZAR</label>
              <input id="amount" type="number" inputMode="decimal" min="0.01" max="1000000"
                step="0.01" required value={amount} onChange={(event) => {
                  setAmount(event.target.value); setQuote(null); setError('');
                }} />
              <button type="submit">Get quote</button>
            </fieldset>
          </form>
          {quote && <section aria-labelledby="quote-heading">
            <h2 id="quote-heading">Quote for {recipient?.name}</h2>
            <QuoteDetails quote={quote} />
            <button disabled={busy} onClick={() => run(async () => {
              setTransfer(await api('/transfers', 'POST', quote));
              setQuote(null);
            })}>Confirm and send</button>
          </section>}
        </>
      ) : (
        <section aria-labelledby="transfer-heading">
          <h2 id="transfer-heading">Transfer sent successfully</h2>
          <p>Transfer #{transfer.id} to {recipient?.name}</p>
          <QuoteDetails quote={transfer} />
          <p role="status">Current status: <strong>{transfer.status}</strong></p>
          <p className="status-flow">{statuses.join(' → ')}</p>
          {nextStatus && <button disabled={busy} onClick={() => run(async () => {
            setTransfer(await api(`/transfers/${transfer.id}/status`, 'PATCH', { status: nextStatus }));
          })}>Demo: advance to {nextStatus}</button>}
          <button disabled={busy} onClick={() => run(async () => {
            setTransfer(await api(`/transfers/${transfer.id}`));
          })}>Refresh status</button>
          <button disabled={busy} onClick={() => {
            setTransfer(null); setAmount(''); setError('');
          }}>Start another transfer</button>
        </section>
      )}
      {busy && <p role="status">Please wait…</p>}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
