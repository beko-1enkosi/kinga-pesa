import React, { useState } from 'react';
import { Icon, Navbar } from './components/WelcomeParts';
import { languageStorageKey, readLanguage, translate } from './i18n/translations';
import './welcome.css';
import './dashboard.css';
import { DemoBalance, AccountControls } from './components/DemoBalance';

// Display-only example. Never write mock activity to transfer storage or send it
// to the API. /demo retains ownership of real prototype drafts and transfers.
const example = {
  recipient: 'Mama', country: 'Zimbabwe', sent: 'ZAR 500.00', received: 'USD 27.50',
  status: 'Ready to Collect', date: '2026-05-24', reference: 'KP-DEMO-0524',
};
const statuses = ['Sent', 'In Transit', 'Ready to Collect', 'Collected'];

export default function Dashboard() {
  const [language, setLanguage] = useState(readLanguage);
  const [notice, setNotice] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const t = (key, values) => translate(language, key, values);
  return <div className="kp-home kp-dashboard">
    <a className="kp-skip" href="#dashboard-main">Skip to dashboard</a>
    <Navbar profile language={language} onLanguageChange={value => {
      setLanguage(value);
      try { localStorage.setItem(languageStorageKey, value); } catch { /* Optional preference. */ }
      setNotice('Language preference saved. This dashboard preview is currently in English.');
    }} />
    <main id="dashboard-main" className="kp-container kp-dashboard-main" tabIndex={-1}>
      <div className="kp-dashboard-greeting"><div><p className="kp-eyebrow">YOUR EVERYDAY CONNECTION TO HOME</p><h1>Welcome, Naledi<span>.</span></h1><p>A little support goes a long way. Make someone’s day back home.</p></div><span className="kp-demo-label">Demo account</span></div>
      <DemoBalance t={t} />
      <section className="kp-send-banner" aria-labelledby="send-title">
        <div><span className="kp-banner-icon"><Icon name="send" /></span><h2 id="send-title">Across borders.<br />Closer to home.</h2><p>Send money with clear fees and exchange rates,<br className="kp-desktop-break" /> so you know what your family will receive.</p><a className="kp-send-cta" href="/send">Send money <Icon name="arrow" /></a></div>
        <div className="kp-send-illustration" aria-hidden="true"><div className="kp-orbit kp-orbit-outer" /><div className="kp-orbit kp-orbit-inner" /><span className="kp-connection-line" /><span className="kp-person kp-person-you">N</span><span className="kp-person kp-person-home">M</span><span className="kp-connection-heart">♡</span><span className="kp-connection-caption">You & your people</span></div>
      </section>
      <section className="kp-dashboard-actions" aria-labelledby="quick-title">
        <h2 id="quick-title">A few ways to get things done</h2>
        <div className="kp-quick-grid">
          <a href="/send" className="kp-quick-card"><span className="kp-quick-icon"><Icon name="send" /></span><strong>Send money</strong><span>Support someone back home</span><Icon name="arrow" className="kp-quick-arrow" /></a>
          <a href="/send" className="kp-quick-card"><span className="kp-quick-icon"><Icon name="history" /></span><strong>Track transfer</strong><span>Open your saved transfer</span><Icon name="arrow" className="kp-quick-arrow" /></a>
          <a href="/whatsapp" className="kp-quick-card"><span className="kp-quick-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.5 8L3 21l1.5-4.5A9 9 0 1 1 21 11.5Z" /><path d="M8 8c0 4 4 8 8 8l1-3-3-1-1 1-2-2 1-1-1-3-3 1Z" /></svg></span><strong>WhatsApp send</strong><span>Chat with KingaPesa · Demo</span></a>
          <button className="kp-quick-card" aria-expanded={helpOpen} aria-controls="dashboard-help" onClick={() => setHelpOpen(!helpOpen)}><span className="kp-quick-icon kp-help-icon" aria-hidden="true">?</span><strong>Help / support</strong><span>A little guidance when you need it</span><Icon name="arrow" className="kp-quick-arrow" /></button>
        </div>
        <div id="dashboard-help" className="kp-dashboard-help" hidden={!helpOpen}><h3>Here to help you get started</h3><p>Choose Send money to open the transfer flow. If a transfer is already saved, you can check its status or choose “Send again”. Track transfer opens that same saved transfer; if you haven’t sent one yet, you’ll see the send form.</p><p>All money movement is simulated. Live customer support is not connected in this prototype.</p></div>
      </section>
      <section className="kp-recent" aria-labelledby="recent-title">
        <div className="kp-recent-heading"><h2 id="recent-title">Recent transfer</h2><span className="kp-demo-label">Example activity</span></div>
        <article className="kp-transfer-card">
          <div className="kp-transfer-overview"><div className="kp-recipient"><span className="kp-recipient-avatar" aria-hidden="true">M</span><div><h3>{example.recipient}</h3><p>{example.country}</p></div></div><span className="kp-transfer-status"><span aria-hidden="true">✓</span>{example.status}</span></div>
          <dl className="kp-transfer-amounts"><div><dt>Amount sent</dt><dd>{example.sent}</dd></div><div><dt>Recipient amount</dt><dd>{example.received}</dd></div></dl>
          <ol className="kp-transfer-steps" aria-label="Transfer progress">{statuses.map((status, index) => <li key={status} className={index < 2 ? 'is-complete' : index === 2 ? 'is-current' : ''} aria-current={status === example.status ? 'step' : undefined}><span aria-hidden="true">{index < 2 ? '✓' : index + 1}</span>{status}</li>)}</ol>
          <div className="kp-transfer-meta"><time dateTime={example.date}>24 May 2026</time><span>Ref: {example.reference}</span></div>
        </article>
      </section>
      <aside className="kp-send-again"><div><p className="kp-eyebrow">KEEP THE CONNECTION GOING</p><h2>A little more love for home.</h2><p>Ready to support Mama again?</p></div><a href="/send" className="kp-button">Send again <Icon name="arrow" /></a></aside>
      <section className="kp-home-services"><h2>{t('utilityHeading')}</h2><div>{[['airtime','airtime'],['electricity','electricity'],['voucher','food']].map(([type,icon]) => <a key={type} href={`/services/${type}`}><Icon name={icon} />{t(`utility.${type}`)}</a>)}</div></section>
      <AccountControls t={t} />
      <p className="kp-dashboard-notice" role="status">{notice}</p>
    </main>
    <footer className="kp-footer kp-container"><span>KingaPesa <span aria-hidden="true">/</span> Made for connection.</span><span>Prototype · No real money moves here.</span></footer>
  </div>;
}
