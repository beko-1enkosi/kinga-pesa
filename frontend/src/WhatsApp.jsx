import React, { useEffect, useRef, useState } from 'react';
import DemoApp from './DemoApp';
import { languages } from './i18n/translations';
import { DemoBalance } from './components/DemoBalance';
import { buyDemoUtility, cents, formatZar } from './demoAccount';
import './welcome.css';
import './whatsapp.css';

const money = (value, currency) => `${currency} ${Number(value).toFixed(2)}`;
const utilityTypes = ['airtime', 'electricity', 'voucher'];
const utilityAmounts = { airtime: [20, 50, 100], electricity: [100, 200, 500], voucher: [100, 250, 500] };

function Chat(s) {
  const { t } = s;
  const [stage, setStage] = useState('start');
  const [messages, setMessages] = useState([]);
  const [replies, setReplies] = useState([{ key: 'waHello' }]);
  const [input, setInput] = useState('');
  const [otp, setOtp] = useState(null);
  const [smsVisible, setSmsVisible] = useState(false);
  const [suggestedAmount, setSuggestedAmount] = useState('');
  const [utility, setUtility] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const lastQuote = useRef(null);
  const lastTransfer = useRef('');
  const thread = useRef(null);
  const locked = useRef(false);
  const typing = replies.length > 0;
  const say = (key, values) => setReplies(items => [...items, { key, values }]);
  const user = text => setMessages(items => [...items, { text, user: true }]);

  // Queue bot replies; cancel timers on unmount. Reduced motion skips the pause.
  useEffect(() => {
    if (!replies.length) return;
    const timer = setTimeout(() => {
      setMessages(items => [...items, replies[0]]);
      setReplies(items => items.slice(1));
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500);
    return () => clearTimeout(timer);
  }, [replies]);
  useEffect(() => { setSmsVisible(Boolean(otp)); }, [otp]);
  useEffect(() => {
    if (!smsVisible) return;
    const timer = setTimeout(() => setSmsVisible(false), 10000);
    return () => clearTimeout(timer);
  }, [smsVisible]);
  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get('service');
    if (utilityTypes.includes(type)) beginUtility(type);
  }, []);
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
    else if (stage === 'success') say('waTracking');
  }, [s.transfer]);
  useEffect(() => {
    // Scroll this element only: never move the browser viewport.
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages, stage, s.error, typing, s.transfer?.status]);

  useEffect(() => {
    const element = thread.current;
    const resize = new ResizeObserver(() => { element.scrollTop = element.scrollHeight; });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  async function start() {
    if (s.pendingSend) { say('sendUncertain'); return; }
    if (s.transfer) s.startAgain();
    s.editQuote(); setOtp(null); setUtility(null); setStage('recipient'); say('waWho');
    if (!s.recipients.length && s.live) await s.retryRecipients();
  }
  function quote(value) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 1000000) {
      say('invalidAmount', { currency: s.sendCurrency }); return;
    }
    s.editAmount(value); s.requestQuote(value);
  }
  function beginUtility(type) {
    if (s.pendingSend) { say('sendUncertain'); return; }
    s.editQuote(); setOtp(null); setReceipt(null);
    setUtility({ type, target: '', amount: '', id: crypto.randomUUID() });
    setStage('utilityTarget'); say(`utilityTarget.${type}`);
  }
  async function action(value, label = value) {
    if (s.busy || locked.current || typing) return;
    const text = value.trim(); if (!text) return;
    const normal = text.toLowerCase();
    const matches = (key, ...aliases) => [key.toLowerCase(), t(key).toLowerCase(), ...aliases].includes(normal);
    setInput('');
    if (stage === 'otp' && !matches('waCancel', 'cancel')) {
      user(t('waVerified'));
      if (!s.live || !navigator.onLine) { say('reconnectBeforeSend'); return; }
      if (text !== otp) { say('waWrong'); return; }
      locked.current = true; setOtp(null); setStage('sending');
      say('waVerified');
      try { await s.confirm(); } finally { locked.current = false; }
      return;
    }
    user(label);
    if (matches('waCancel', 'cancel')) { s.editQuote(); setOtp(null); setUtility(null); setReceipt(null); setSuggestedAmount(''); setStage('start'); say('waCancelled'); return; }
    if (matches('waDone', 'done')) { setStage('start'); setUtility(null); say('waHello'); return; }
    if (matches('waTrack', 'track transfer', 'track')) {
      if (!s.transfer) { say('waNoTransfer'); return; }
      setStage('success'); setOtp(null); say('waTracking'); if (s.live) await s.refresh(); return;
    }
    for (const type of utilityTypes) {
      if (matches(`utility.${type}`, ...(type === 'voucher' ? ['food voucher', 'buy food voucher'] : [`buy ${type}`]))) { beginUtility(type); return; }
    }
    if (matches('waSend', 'send money') || matches('waAgain', 'send again')) { await start(); return; }
    if (matches('waFees', 'check fees')) { say('waFeeHelp'); await start(); return; }
    if (matches('waConfirm', 'confirm') && stage === 'utilityReview') {
      if (!s.live || !navigator.onLine) { say('reconnectBeforeSend'); return; }
      locked.current = true;
      try {
        const result = await buyDemoUtility(utility);
        setReceipt(result); setStage('utilitySuccess'); say('utilitySuccess');
      } catch (err) { say(err.message, { currency: 'ZAR' }); }
      finally { locked.current = false; }
      return;
    }
    if (matches('waConfirm', 'confirm') && stage === 'quote') {
      if (!s.live || !navigator.onLine || s.pendingSend) { say('reconnectBeforeSend'); return; }
      setOtp(String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      setStage('otp'); say('waCodePrompt'); return;
    }
    if (matches('waChange', 'change amount') && ['quote','utilityReview'].includes(stage)) {
      if (stage === 'utilityReview') { setStage('utilityAmount'); say('utilityAmount'); }
      else { s.editQuote(); setStage('amount'); say('waAmount', { currency: s.sendCurrency }); }
      return;
    }
    if (stage === 'utilityTarget') {
      const person = s.recipients.find(item => String(item.id) === text || item.name.toLowerCase() === normal);
      const target = person && utility.type !== 'electricity' ? person.name : text;
      const valid = utility.type === 'electricity' ? /^\d{6,20}$/.test(text) : utility.type === 'airtime' ? person || /^\+?[\d -]{7,20}$/.test(text) : target.length >= 2 && target.length <= 80;
      if (!valid) { say('utilityInvalidTarget'); return; }
      setUtility(current => ({ ...current, target })); setStage('utilityAmount'); say('utilityAmount'); return;
    }
    if (stage === 'recipient') {
      const person = s.recipients.find(item => String(item.id) === text || item.name.toLowerCase() === normal);
      if (person) { s.selectRecipient(String(person.id)); setStage('amount'); say('waAmount', { currency: s.sendCurrency }); if (suggestedAmount) s.editAmount(suggestedAmount); return; }
    }
    const parsed = text.match(/^(?:send\s+)?(?:R\s*|ZAR\s*|BWP\s*)?(\d+(?:\.\d{1,2})?)$/i);
    if (parsed && stage === 'utilityAmount') {
      try { if (cents(parsed[1]) > 100000000) throw new Error('invalidAmount'); }
      catch { say('invalidAmount', { currency: 'ZAR' }); return; }
      setUtility(current => ({ ...current, amount: parsed[1] })); setStage('utilityReview'); say('utilityReview'); return;
    }
    if (parsed && stage === 'amount') { quote(parsed[1]); return; }
    if (parsed && /^send\s/i.test(text)) { setSuggestedAmount(parsed[1]); await start(); return; }
    if (matches('waOther', 'other')) { say(stage === 'utilityAmount' ? 'utilityAmount' : 'waAmount', { currency: s.sendCurrency }); return; }
    if (matches('waRetry') && s.amount) { quote(s.amount); return; }
    say('waHint');
  }
  const chip = (key, disabled = false) => <button key={key} disabled={s.busy || typing || disabled} onClick={() => action(key, t(key))}>{t(key)}</button>;
  const transfer = s.transfer;
  const review = s.quote && ['quote', 'otp', 'sending'].includes(stage);
  return <div className="kp-home kp-chat-page">
    <main className="kp-chat-shell">
      <header className="kp-chat-header"><a href="/app" aria-label={t('waBack')}>←</a><span className="kp-chat-avatar" aria-hidden="true">K</span><div><h1>KingaPesa</h1><span>Business · Demo</span></div><label><span className="kp-sr-only">{t('language')}</span><select aria-label={t('language')} value={s.language} onChange={e => s.setLanguage(e.target.value)}>{languages.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label></header>
      <p className="kp-chat-disclaimer">{t('waShortDemo')}</p><div className="kp-chat-account"><DemoBalance t={t} quote={review ? s.quote : null} /></div><p className="kp-chat-connection" role="status">{t(s.connectionText)} {s.connection === 'weak' && <button onClick={s.checkConnection}>{t('retryConnection')}</button>}</p>
      <div ref={thread} className="kp-chat-thread" role="log" aria-label={t('waTitle')} aria-live="polite">
        {messages.map((message, index) => <div key={index} className={`kp-bubble ${message.user ? 'kp-bubble-user' : ''}`}>{message.user ? message.text : t(message.key, message.values)}</div>)}
        {typing && <div className="kp-bubble kp-chat-typing" role="status" aria-label={t('waTyping')}><span aria-hidden="true">●</span><span aria-hidden="true">●</span><span aria-hidden="true">●</span></div>}
        {!typing && review && <div className="kp-bubble kp-chat-quote"><strong>{s.recipient?.name} · {s.recipient?.country}</strong><dl>{[['youSend',money(s.quote.send_amount,s.quote.send_currency)],['transferFee',money(s.quote.fee,s.quote.send_currency)],['totalYouPay',money(s.quote.total_cost,s.quote.send_currency)],['exchangeRate',`1 ${s.quote.send_currency} = ${s.quote.exchange_rate} ${s.quote.receive_currency}`],['recipientReceives',money(s.quote.receive_amount,s.quote.receive_currency)]].map(([key,value])=><div key={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}</dl></div>}
        {!typing && ['utilityReview','utilitySuccess'].includes(stage) && utility && <div className="kp-bubble kp-utility-receipt"><strong>{t(`utility.${utility.type}`)}</strong><p>{t('utilityTarget')}: {utility.target}</p><p>{t('utilityCost')}: {formatZar(cents(utility.amount))}</p>{stage === 'utilitySuccess' && receipt && <p>{t(utility.type === 'electricity' ? 'utilityToken' : 'utilityReference')}: <strong>{receipt.reference}</strong></p>}</div>}
        {!typing && stage === 'success' && transfer && <div className="kp-bubble kp-chat-transfer"><strong>{s.transferName} · {t('waReference')} KP-{transfer.id}</strong><p>{money(transfer.send_amount,transfer.send_currency)} → {money(transfer.receive_amount,transfer.receive_currency)}</p><p>{t(s.transferCached || !s.live ? 'savedTransferStatus' : 'transferStatus')} <strong>{t(`status.${transfer.status}`)}</strong></p><ol>{s.statuses.map(status=><li key={status} aria-current={status === transfer.status ? 'step' : undefined}>{t(`status.${status}`)}</li>)}</ol></div>}
        {s.error && <p className="kp-chat-alert" role="alert">{t(s.error,{currency:s.sendCurrency})}</p>}
        {!s.canSave && <p className="kp-chat-alert" role="alert">{t('storageUnavailable')}</p>}
        {s.pendingSend && !transfer && <p className="kp-chat-alert" role="alert">{t('sendUncertain')}</p>}
        {s.busy && <p role="status">{t('pleaseWait')}</p>}
      </div>
      <div className="kp-chat-replies" aria-label="Suggested replies">
        {stage === 'start' && <>{chip('waSend',s.pendingSend)}{chip('waTrack')}{utilityTypes.map(type => chip(`utility.${type}`,s.pendingSend))}{chip('waFees',s.pendingSend)}</>}
        {(stage === 'recipient' || stage === 'utilityTarget' && utility.type !== 'electricity') && <>{s.recipients.map(person=><button key={person.id} disabled={s.busy || typing} onClick={()=>action(String(person.id),person.name)}>{person.name} · {person.country} · {person.currency}</button>)}{!s.recipients.length && <button disabled={!s.live || s.busy || typing} onClick={s.retryRecipients}>{t('retryRecipients')}</button>}{s.recipientsCached && <small>{t('cachedRecipients')}</small>}</>}
        {stage === 'amount' && <>{[...new Set([...(suggestedAmount ? [Number(suggestedAmount)] : []),200,500,1000])].map(value=><button key={value} disabled={s.busy || typing} onClick={()=>action(String(value),`${s.sendCurrency} ${value}`)}>{s.sendCurrency === 'ZAR' ? 'R' : 'BWP '}{value}</button>)}{chip('waOther')}{s.error && chip('waRetry',!s.live)}</>}
        {stage === 'utilityAmount' && <>{utilityAmounts[utility.type].map(value => <button key={value} disabled={typing} onClick={() => action(String(value),`R${value}`)}>R{value}</button>)}{chip('waOther')}</>}
        {['quote','utilityReview'].includes(stage) && <>{chip('waConfirm',!s.live || s.pendingSend)}{chip('waChange')}</>}
        {['recipient','amount','quote','otp','utilityTarget','utilityAmount','utilityReview'].includes(stage) && chip('waCancel')}
        {stage === 'otp' && !smsVisible && <button onClick={() => setSmsVisible(true)}>{t('waSmsAgain')}</button>}
        {stage === 'sending' && !s.busy && !s.pendingSend && !transfer && <button disabled={typing} onClick={()=>setStage('quote')}>{t('waReview',{name:s.recipient?.name,country:s.recipient?.country})}</button>}
        {stage === 'success' && <>{chip('waTrack',!s.live)}{chip('waAgain')}<a href="/app">{t('waBack')}</a></>}
        {stage === 'utilitySuccess' && <>{chip('waDone')}<a href="/app">{t('waBack')}</a></>}
      </div>
      <form className="kp-chat-composer" onSubmit={e=>{e.preventDefault();action(input);}}><label className="kp-sr-only" htmlFor="chat-input">{t('waInput')}</label><input id="chat-input" value={input} onChange={e=>setInput(e.target.value)} placeholder={stage==='otp'?'••••••':t('waInput')} type={stage==='otp'?'password':'text'} inputMode={stage==='otp'?'numeric':'text'} autoComplete="off" maxLength={stage==='otp'?6:160} disabled={s.busy || stage==='sending'} /><button disabled={s.busy || typing || !input.trim() || stage==='sending'} type="submit" aria-label={t('waSubmit')}>➤</button></form>
      {stage==='success' && s.nextStatus && <aside className="kp-chat-demo"><button disabled={!s.live || s.busy || s.transferCached || typing} onClick={s.advance}>{t('waDemoControl')}: {t(`status.${s.nextStatus}`)}</button></aside>}
    </main>
    {otp && smsVisible && <aside className="kp-chat-sms" role="status" aria-label={t('waSms')}><button className="kp-sms-close" aria-label={t('waCloseSms')} onClick={() => setSmsVisible(false)}>×</button><strong>KingaPesa</strong><small>{t('waSms')} • now</small><p>{t('waCode')}</p><code>{otp}</code><p>{t('waSecret')}</p></aside>}
  </div>;
}
export default function WhatsApp() { return <DemoApp renderSend={state=><Chat {...state} />} />; }
