import React, { useEffect, useRef, useState } from 'react';
import DemoApp from './DemoApp';
import { languages } from './i18n/translations';
import './welcome.css';
import './whatsapp.css';

const money = (value, currency) => `${currency} ${Number(value).toFixed(2)}`;

function Chat(s) {
  const { t } = s;
  const [stage, setStage] = useState('start');
  const [messages, setMessages] = useState([{ key: 'waHello' }]);
  const [input, setInput] = useState('');
  const [otp, setOtp] = useState(null);
  const [suggestedAmount, setSuggestedAmount] = useState('');
  const lastQuote = useRef(null);
  const lastTransfer = useRef('');
  const end = useRef(null);
  const locked = useRef(false);
  const say = (key, values) => setMessages(items => [...items, { key, values }]);
  const user = text => setMessages(items => [...items, { text, user: true }]);
  useEffect(() => {
    if (s.quote && s.quote !== lastQuote.current) {
      lastQuote.current = s.quote; setOtp(null); setStage('quote');
      say('waReview', { name: s.recipient?.name, country: s.recipient?.country });
    }
  }, [s.quote]);
  useEffect(() => {
    if (!s.transfer) { lastTransfer.current = ''; return; }
    const identity = `${s.transfer.id}:${s.transfer.status}`;
    if (lastTransfer.current === identity) return;
    lastTransfer.current = identity;
    if (stage === 'sending') { setOtp(null); setStage('success'); say('waSuccess'); }
  }, [s.transfer]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, stage, s.error]);

  async function start() {
    if (s.pendingSend) return;
    if (s.transfer) s.startAgain();
    s.editQuote(); setOtp(null); setStage('recipient'); say('waWho');
    if (!s.recipients.length && s.live) await s.retryRecipients();
  }
  function quote(value) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 1000000) {
      say('invalidAmount', { currency: s.sendCurrency }); return;
    }
    s.editAmount(value); s.requestQuote(value);
  }
  async function action(value, label = value) {
    if (s.busy || locked.current) return;
    const text = value.trim(); if (!text) return;
    const normal = text.toLowerCase();
    const matches = (key, ...aliases) => [key.toLowerCase(), t(key).toLowerCase(), ...aliases].includes(normal);
    setInput('');
    // Never echo a submitted OTP into the transcript or persist it anywhere.
    if (stage === 'otp' && !matches('waCancel', 'cancel')) {
      user(t('waVerified'));
      if (!s.live || !navigator.onLine) { say('reconnectBeforeSend'); return; }
      if (text !== otp) { say('waWrong'); return; }
      locked.current = true; setOtp(null); setStage('sending');
      try { await s.confirm(); } finally { locked.current = false; }
      return;
    }
    user(label);
    if (matches('waCancel', 'cancel')) { s.editQuote(); setOtp(null); setSuggestedAmount(''); setStage('start'); say('waCancelled'); return; }
    if (matches('waTrack', 'track transfer', 'track')) {
      if (!s.transfer) { say('waNoTransfer'); return; }
      setStage('success'); setOtp(null); if (s.live) await s.refresh(); return;
    }
    if (matches('waSend', 'send money') || matches('waAgain', 'send again')) { await start(); return; }
    if (matches('waFees', 'check fees')) { say('waFeeHelp'); await start(); return; }
    if (matches('waConfirm', 'confirm') && stage === 'quote') {
      if (!s.live || !navigator.onLine || s.pendingSend) { say('reconnectBeforeSend'); return; }
      // Frontend-only demo code. It is not an authentication credential.
      setOtp(String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      setStage('otp'); say('waCodePrompt'); return;
    }
    if (matches('waChange', 'change amount') && stage === 'quote') { s.editQuote(); setStage('amount'); say('waAmount', { currency: s.sendCurrency }); return; }
    if (stage === 'recipient') {
      const person = s.recipients.find(item => String(item.id) === text || item.name.toLowerCase() === normal);
      if (person) { s.selectRecipient(String(person.id)); setStage('amount'); say('waAmount', { currency: s.sendCurrency }); if (suggestedAmount) s.editAmount(suggestedAmount); return; }
    }
    const parsed = text.match(/^(?:send\s+)?(?:R\s*|ZAR\s*|BWP\s*)?(\d+(?:\.\d{1,2})?)$/i);
    if (parsed && stage === 'amount') { quote(parsed[1]); return; }
    if (parsed && /^send\s/i.test(text)) { setSuggestedAmount(parsed[1]); await start(); return; }
    if (matches('waOther', 'other')) { say('waAmount', { currency: s.sendCurrency }); return; }
    if (matches('waRetry') && s.amount) { quote(s.amount); return; }
    say('waHint');
  }
  const chip = (key, disabled = false) => <button key={key} disabled={s.busy || disabled} onClick={() => action(key, t(key))}>{t(key)}</button>;
  const transfer = s.transfer;
  const review = s.quote && ['quote', 'otp', 'sending'].includes(stage);
  return <div className="kp-home kp-chat-page">
    <main className="kp-chat-shell">
      <header className="kp-chat-header"><a href="/app" aria-label={t('waBack')}>←</a><span className="kp-chat-avatar" aria-hidden="true">K</span><div><h1>KingaPesa</h1><span>Business · Demo</span></div><label><span className="kp-sr-only">{t('language')}</span><select aria-label={t('language')} value={s.language} onChange={e => s.setLanguage(e.target.value)}>{languages.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label></header>
      <p className="kp-chat-disclaimer">{t('waDemo')}</p><p className="kp-chat-connection" role="status">{t(s.connectionText)} {s.connection === 'weak' && <button onClick={s.checkConnection}>{t('retryConnection')}</button>}</p>
      <div className="kp-chat-thread" role="log" aria-label={t('waTitle')} aria-live="polite">
        {messages.map((message, index) => <div key={index} className={`kp-bubble ${message.user ? 'kp-bubble-user' : ''}`}>{message.user ? message.text : t(message.key, message.values)}</div>)}
        {review && <div className="kp-bubble kp-chat-quote"><strong>{s.recipient?.name} · {s.recipient?.country}</strong><dl>{[['youSend',money(s.quote.send_amount,s.quote.send_currency)],['transferFee',money(s.quote.fee,s.quote.send_currency)],['totalYouPay',money(s.quote.total_cost,s.quote.send_currency)],['exchangeRate',`1 ${s.quote.send_currency} = ${s.quote.exchange_rate} ${s.quote.receive_currency}`],['recipientReceives',money(s.quote.receive_amount,s.quote.receive_currency)]].map(([key,value])=><div key={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}</dl></div>}
        {stage === 'success' && transfer && <div className="kp-bubble kp-chat-transfer"><strong>{s.transferName} · {t('waReference')} KP-{transfer.id}</strong><p>{money(transfer.send_amount,transfer.send_currency)} → {money(transfer.receive_amount,transfer.receive_currency)}</p><p>{t(s.transferCached || !s.live ? 'savedTransferStatus' : 'transferStatus')} <strong>{t(`status.${transfer.status}`)}</strong></p><ol>{s.statuses.map(status=><li key={status} aria-current={status === transfer.status ? 'step' : undefined}>{t(`status.${status}`)}</li>)}</ol></div>}
        {s.error && <p className="kp-chat-alert" role="alert">{t(s.error,{currency:s.sendCurrency})}</p>}
        {!s.canSave && <p className="kp-chat-alert" role="alert">{t('storageUnavailable')}</p>}
        {s.pendingSend && !transfer && <p className="kp-chat-alert" role="alert">{t('sendUncertain')}</p>}
        {s.busy && <p role="status">{t('pleaseWait')}</p>}
        <div ref={end} />
      </div>
      <div className="kp-chat-replies" aria-label="Suggested replies">
        {stage === 'start' && <>{chip('waSend',s.pendingSend)}{chip('waTrack')}{chip('waFees',s.pendingSend)}</>}
        {stage === 'recipient' && <>{s.recipients.map(person=><button key={person.id} disabled={s.busy} onClick={()=>action(String(person.id),person.name)}>{person.name} · {person.country} · {person.currency}</button>)}{!s.recipients.length && <button disabled={!s.live || s.busy} onClick={s.retryRecipients}>{t('retryRecipients')}</button>}{s.recipientsCached && <small>{t('cachedRecipients')}</small>}</>}
        {stage === 'amount' && <>{[...new Set([...(suggestedAmount ? [Number(suggestedAmount)] : []),200,500,1000])].map(value=><button key={value} disabled={s.busy} onClick={()=>action(String(value),`${s.sendCurrency} ${value}`)}>{s.sendCurrency === 'ZAR' ? 'R' : 'BWP '}{value}</button>)}{chip('waOther')}{s.error && chip('waRetry',!s.live)}</>}
        {stage === 'quote' && <>{chip('waConfirm',!s.live || s.pendingSend)}{chip('waChange')}</>}
        {['recipient','amount','quote','otp'].includes(stage) && chip('waCancel')}
        {stage === 'sending' && !s.busy && !s.pendingSend && !transfer && <button onClick={()=>{setStage('quote');}}>{t('waReview',{name:s.recipient?.name,country:s.recipient?.country})}</button>}
        {stage === 'success' && <>{chip('waTrack',!s.live)}{chip('waAgain')}<a href="/app">{t('waBack')}</a></>}
      </div>
      <form className="kp-chat-composer" onSubmit={e=>{e.preventDefault();action(input);}}><label className="kp-sr-only" htmlFor="chat-input">{t('waInput')}</label><input id="chat-input" value={input} onChange={e=>setInput(e.target.value)} placeholder={stage==='otp'?'••••••':t('waInput')} type={stage==='otp'?'password':'text'} inputMode={stage==='otp'?'numeric':'text'} autoComplete="off" maxLength={stage==='otp'?6:160} disabled={s.busy || stage==='sending'} /><button disabled={s.busy || !input.trim() || stage==='sending'} type="submit" aria-label={t('waSubmit')}>➤</button></form>
      {stage==='success' && s.nextStatus && <aside className="kp-chat-demo"><button disabled={!s.live || s.busy || s.transferCached} onClick={s.advance}>{t('waDemoControl')}: {t(`status.${s.nextStatus}`)}</button></aside>}
    </main>
    {otp && <aside className="kp-chat-sms" role="status" aria-label={t('waSms')}><strong>{t('waSms')}</strong><p>{t('waCode')}</p><code>{otp}</code><p>{t('waSecret')}</p></aside>}
  </div>;
}
export default function WhatsApp() { return <DemoApp renderSend={state=><Chat {...state} />} />; }
