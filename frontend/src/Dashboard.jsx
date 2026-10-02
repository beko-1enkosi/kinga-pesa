import React, { useEffect, useState } from 'react';
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
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return <div className="kp-home kp-dashboard">
    <a className="kp-skip" href="#dashboard-main">{t('dash.skip')}</a>
    <Navbar profile t={t} language={language} onLanguageChange={value => {
      setLanguage(value);
      try { localStorage.setItem(languageStorageKey, value); } catch { /* Optional preference. */ }
      setNotice('dash.languageChanged');
    }} />
    <main id="dashboard-main" className="kp-container kp-dashboard-main" tabIndex={-1}>
      <div className="kp-dashboard-greeting"><div><p className="kp-eyebrow">{t('dash.eyebrow')}</p><h1>{t('dash.welcome', { name: 'Naledi' })}<span>.</span></h1><p>{t('dash.intro')}</p></div><span className="kp-demo-label">{t('dash.demoAccount')}</span></div>
      <DemoBalance t={t} />
      <section className="kp-send-banner" aria-labelledby="send-title">
        <div><span className="kp-banner-icon"><Icon name="send" /></span><h2 id="send-title">{t('dash.acrossBorders')}<br />{t('dash.closerHome')}</h2><p>{t('dash.heroFirst')}<br className="kp-desktop-break" />{' '}{t('dash.heroSecond')}</p><a className="kp-send-cta" href="/send">{t('sendMoney')} <Icon name="arrow" /></a></div>
        <div className="kp-send-illustration" aria-hidden="true"><div className="kp-orbit kp-orbit-outer" /><div className="kp-orbit kp-orbit-inner" /><span className="kp-connection-line" /><span className="kp-person kp-person-you">N</span><span className="kp-person kp-person-home">M</span><span className="kp-connection-heart">♡</span><span className="kp-connection-caption">{t('dash.yourPeople')}</span></div>
      </section>
      <section className="kp-dashboard-actions" aria-labelledby="quick-title">
        <h2 id="quick-title">{t('dash.quickTitle')}</h2>
        <div className="kp-quick-grid">
          <a href="/send" className="kp-quick-card"><span className="kp-quick-icon"><Icon name="send" /></span><strong>{t('sendMoney')}</strong><span>{t('dash.supportHome')}</span><Icon name="arrow" className="kp-quick-arrow" /></a>
          <a href="/send" className="kp-quick-card"><span className="kp-quick-icon"><Icon name="history" /></span><strong>{t('dash.track')}</strong><span>{t('dash.openSaved')}</span><Icon name="arrow" className="kp-quick-arrow" /></a>
          <a href="/whatsapp" className="kp-quick-card"><span className="kp-quick-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.5 8L3 21l1.5-4.5A9 9 0 1 1 21 11.5Z" /><path d="M8 8c0 4 4 8 8 8l1-3-3-1-1 1-2-2 1-1-1-3-3 1Z" /></svg></span><strong>{t('dash.whatsapp')}</strong><span>{t('dash.chatDemo')}</span></a>
          <button className="kp-quick-card" aria-expanded={helpOpen} aria-controls="dashboard-help" onClick={() => setHelpOpen(!helpOpen)}><span className="kp-quick-icon kp-help-icon" aria-hidden="true">?</span><strong>{t('dash.help')}</strong><span>{t('dash.guidance')}</span><Icon name="arrow" className="kp-quick-arrow" /></button>
        </div>
        <div id="dashboard-help" className="kp-dashboard-help" hidden={!helpOpen}><h3>{t('dash.helpTitle')}</h3><p>{t('dash.helpFlow')}</p><p>{t('dash.helpDemo')}</p></div>
      </section>
      <section className="kp-recent" aria-labelledby="recent-title">
        <div className="kp-recent-heading"><h2 id="recent-title">{t('dash.recent')}</h2><span className="kp-demo-label">{t('dash.example')}</span></div>
        <article className="kp-transfer-card">
          <div className="kp-transfer-overview"><div className="kp-recipient"><span className="kp-recipient-avatar" aria-hidden="true">M</span><div><h3>{example.recipient}</h3><p>{example.country}</p></div></div><span className="kp-transfer-status"><span aria-hidden="true">✓</span>{t(`status.${example.status}`)}</span></div>
          <dl className="kp-transfer-amounts"><div><dt>{t('dash.sentAmount')}</dt><dd>{example.sent}</dd></div><div><dt>{t('dash.recipientAmount')}</dt><dd>{example.received}</dd></div></dl>
          <ol className="kp-transfer-steps" aria-label={t('dash.progress')}>{statuses.map((status, index) => <li key={status} className={index < 2 ? 'is-complete' : index === 2 ? 'is-current' : ''} aria-current={status === example.status ? 'step' : undefined}><span aria-hidden="true">{index < 2 ? '✓' : index + 1}</span>{t(`status.${status}`)}</li>)}</ol>
          <div className="kp-transfer-meta"><time dateTime={example.date}>{t('dash.exampleDate')}</time><span>{t('dash.reference', { reference: example.reference })}</span></div>
        </article>
      </section>
      <aside className="kp-send-again"><div><p className="kp-eyebrow">{t('dash.keepConnected')}</p><h2>{t('dash.moreLove')}</h2><p>{t('dash.supportAgain', { name: 'Mama' })}</p></div><a href="/send" className="kp-button">{t('dash.sendAgain')} <Icon name="arrow" /></a></aside>
      <section className="kp-home-services"><h2>{t('utilityHeading')}</h2><div>{[['airtime','airtime'],['electricity','electricity'],['voucher','food']].map(([type,icon]) => <a key={type} href={`/services/${type}`}><Icon name={icon} />{t(`utility.${type}`)}</a>)}</div></section>
      <AccountControls t={t} />
      <p className="kp-dashboard-notice" role="status">{notice && t(notice)}</p>
    </main>
    <footer className="kp-footer kp-container"><span>KingaPesa <span aria-hidden="true">/</span> {t('dash.footerConnection')}</span><span>{t('dash.footerDemo')}</span></footer>
  </div>;
}
