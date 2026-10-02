import React, { useEffect, useRef, useState } from 'react';
import DemoApp from './DemoApp';
import { Navbar, Icon } from './components/WelcomeParts';
import { senders } from './sender';
import './welcome.css';
import './send.css';

const money = (amount, currency) => `${currency} ${Number(amount).toFixed(2)}`;

function AmountSummary({ value, t }) {
  return <dl className="kp-send-summary">
    <div><dt>{t('youSend')}</dt><dd>{money(value.send_amount, value.send_currency)}</dd></div>
    <div><dt>{t('transferFee')}</dt><dd>{money(value.fee, value.send_currency)}</dd></div>
    <div><dt>{t('exchangeRate')}</dt><dd>1 {value.send_currency} = {value.exchange_rate} {value.receive_currency}</dd></div>
    <div className="kp-send-total"><dt>{t('totalYouPay')}</dt><dd>{money(value.total_cost, value.send_currency)}</dd></div>
    <div className="kp-send-received"><dt>{t('recipientReceives')}</dt><dd>{money(value.receive_amount, value.receive_currency)}</dd></div>
  </dl>;
}

function SendView(s) {
  const [step, setStep] = useState(1);
  const heading = useRef(null);
  const { t, transfer, quote } = s;
  const reviewing = !transfer && quote?.send_currency === s.sendCurrency;
  const currentStep = transfer ? 4 : reviewing ? 3 : step;
  useEffect(() => { heading.current?.focus(); }, [currentStep]);
  function edit() { s.editQuote(); setStep(2); }
  return <div className="kp-home kp-send-page">
    <Navbar back language={s.language} onLanguageChange={s.setLanguage} />
    <main className="kp-send-main">
      <a href="/app" className="kp-send-back">← Back to dashboard</a>
      <div className="kp-send-heading"><div><p className="kp-eyebrow">A LITTLE SUPPORT. A LITTLE CLOSER.</p><h1 ref={heading} tabIndex={-1}>{transfer ? t('transferSuccessful') : t('sendMoney')}</h1></div><span className="kp-send-connection" role="status">{t(s.connectionText)}</span></div>
      {s.connection === 'weak' && <button className="kp-send-link" onClick={s.checkConnection} disabled={s.busy}>{t('retryConnection')}</button>}
      {!s.canSave && <p className="kp-send-message" role="alert">{t('storageUnavailable')}</p>}
      {s.error && <p className="kp-send-message" role="alert">{t(s.error, { currency: s.sendCurrency })}</p>}
      {s.pendingSend && !transfer && !s.busy && <p className="kp-send-message" role="alert">{t('sendUncertain')}</p>}
      {!transfer && <ol className="kp-send-steps" aria-label="Send money steps">{['Recipient', 'Amount', 'Review & send'].map((label, index) => <li key={label} className={currentStep === index + 1 ? 'is-current' : ''} aria-current={currentStep === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>}
      <section className="kp-send-panel" aria-label={transfer ? 'Transfer details' : 'Send money'}>
        {!transfer && !reviewing && step === 1 && <>
          <h2>Who are you sending to?</h2><p className="kp-send-muted">Choose someone to support back home.</p>
          {s.loading && <p role="status">{t('loadingRecipients')}</p>}
          {(s.recipientsCached || !s.live) && s.recipients.length > 0 && <p className="kp-send-muted">{t('cachedRecipients')}</p>}
          <fieldset className="kp-recipient-options" disabled={s.busy}><legend className="kp-sr-only">{t('selectRecipient')}</legend>
            {s.recipients.map(person => <label key={person.id} className={`kp-recipient-option${s.recipientId === String(person.id) ? ' is-selected' : ''}`}><input type="radio" name="recipient" value={person.id} checked={s.recipientId === String(person.id)} onChange={event => s.selectRecipient(event.target.value)} /><span className="kp-send-avatar" aria-hidden="true">{person.name[0]}</span><span><strong>{person.name}</strong><small>{person.country} · {person.currency}</small></span></label>)}
          </fieldset>
          {!s.recipients.length && <><p>{t('noSavedRecipients')}</p><button className="kp-send-secondary" disabled={!s.live || s.busy} onClick={s.retryRecipients}>{t('retryRecipients')}</button></>}
          <button className="kp-button kp-send-primary" disabled={!s.recipient || s.busy} onClick={() => setStep(2)}>Continue <Icon name="arrow" /></button>
        </>}
        {!transfer && !reviewing && step === 2 && <>
          <h2>How much would you like to send?</h2><p className="kp-send-muted">To <strong>{s.recipient?.name}</strong> · {s.recipient?.country} · {s.recipient?.currency}</p>
          <form noValidate onSubmit={s.getQuote}><fieldset className="kp-amount-fields" disabled={s.busy}>
            <label htmlFor="sender-country">{t('sendingFrom')}</label><select id="sender-country" value={s.senderCountry} onChange={event => s.changeSender(event.target.value)}>{senders.map(sender => <option key={sender.country} value={sender.country}>{t(`senderCountry.${sender.country}`)} — {sender.currency}</option>)}</select>
            <label htmlFor="amount">{t('amountToSend', { currency: s.sendCurrency })}</label><input id="amount" name="amount" type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" required value={s.amount} placeholder="0.00" onChange={event => s.editAmount(event.target.value)} />
            <div className="kp-quick-amounts" aria-label="Quick amounts">{[200, 500, 1000].map(value => <button type="button" key={value} aria-pressed={Number(s.amount) === value} onClick={() => s.editAmount(String(value))}>{s.sendCurrency === 'ZAR' ? 'R' : 'BWP '}{value}</button>)}</div>
            <p className="kp-send-muted">You’ll see the full fee and exchange rate before you send.</p><button type="submit" className="kp-button kp-send-primary">{t('getQuote')} <Icon name="arrow" /></button>
          </fieldset></form>
          <button className="kp-send-link" disabled={s.busy} onClick={() => setStep(1)}>← Change recipient</button>
          {s.draftDirty && s.canSave && <p className="kp-send-saved">{t('draftSaved')}</p>}
        </>}
        {reviewing && <>
          <h2 id="quote-heading">Review your transfer</h2><p className="kp-send-destination"><strong>{s.recipient?.name}</strong><span>{s.recipient?.country} · {quote.receive_currency}</span></p>
          <AmountSummary value={quote} t={t} />
          <p className="kp-send-muted">Check the amounts above, then confirm when you’re ready.</p>
          {!s.live && <p className="kp-send-message">{t('reconnectBeforeSend')}</p>}
          <button className="kp-button kp-send-primary" disabled={s.busy || !s.live || s.pendingSend} onClick={s.confirm}>{t('confirmAndSend')} <Icon name="arrow" /></button>
          <button className="kp-send-link" disabled={s.busy} onClick={edit}>← Back / Edit amount</button>
        </>}
        {transfer && <>
          <div className="kp-send-success" aria-hidden="true">✓</div><h2 id="transfer-heading">Transfer details</h2>
          <p className="kp-send-destination"><strong>{s.transferName || s.recipient?.name || transfer.recipient_id}</strong><span>Transfer #{transfer.id} · {transfer.receive_currency}</span></p>
          <AmountSummary value={transfer} t={t} />
          <p role="status" className="kp-send-status">{t(s.transferCached || !s.live ? 'savedTransferStatus' : 'transferStatus')} <strong>{t(`status.${transfer.status}`)}</strong></p>
          <ol className="kp-send-tracking" aria-label="Transfer progress">{s.statuses.map((status, index) => <li key={status} className={index <= s.statuses.indexOf(transfer.status) ? 'is-reached' : ''} aria-current={status === transfer.status ? 'step' : undefined}><span aria-hidden="true">{index < s.statuses.indexOf(transfer.status) ? '✓' : index + 1}</span>{t(`status.${status}`)}</li>)}</ol>
          {(s.notifications.length > 0 || s.notificationLoading || s.notificationError) && <aside className="kp-send-notification"><h3>{t('receiverNotification')}</h3><p>{t('simulatedNotification')}</p>{s.notificationsCached && s.notifications.length > 0 && <p>{t('cachedNotifications')}</p>}{s.notificationLoading && <p role="status">{t('loadingNotifications')}</p>}{s.notificationError && <p role="alert">{t('notificationLoadFailed')}</p>}{s.notifications.map(item => <p key={item.id}>{t('notificationMessage', { name: item.recipient_name, amount: money(item.receive_amount, item.receive_currency) })}</p>)}</aside>}
          <button className="kp-send-secondary" disabled={s.busy || !s.live} onClick={s.refresh}>{t('refreshStatus')}</button>
          <div className="kp-send-finish"><a className="kp-button" href="/app">Back to dashboard</a><button className="kp-send-secondary" disabled={s.busy} onClick={() => { s.startAgain(); setStep(1); }}>Send again</button></div>
        </>}
        {s.busy && <p role="status" className="kp-send-muted">{t('pleaseWait')}</p>}
      </section>
      {transfer && s.nextStatus && <aside className="kp-send-demo"><h2>Demo control</h2><p>For the hackathon demonstration only. Move this transfer to the next status.</p><button className="kp-send-secondary" disabled={s.busy || !s.live || s.transferCached} onClick={s.advance}>{t('advanceStatus', { status: t(`status.${s.nextStatus}`) })}</button></aside>}
      <p className="kp-send-footnote">Prototype · Mock exchange rates. No real money moves here.</p>
    </main>
  </div>;
}

export default function Send() {
  return <DemoApp renderSend={state => <SendView {...state} />} />;
}
