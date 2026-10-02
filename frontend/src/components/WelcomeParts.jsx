import React from 'react';
import { languages, translate } from '../i18n/translations';

// Small local SVGs avoid an icon package, webfont, or external image requests.
export function Icon({ name, ...props }) {
  const paths = {
    rates: <><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" /></>,
    send: <><path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3" /></>,
    airtime: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4m-3 14h2M9 11h6m-3-3v6" /></>,
    electricity: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
    food: <><path d="M3 8h18l-2 12H5L3 8Zm4 0 5-6 5 6M9 12v4m6-4v4" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function Navbar({ language, onLanguageChange, onSignIn, back = false, profile = false, t = (key, values) => translate('en', key, values) }) {
  return <header className="kp-header">
    <nav className="kp-nav kp-container" aria-label={t('nav.main')}>
      <a className="kp-brand" href="/" aria-label={t('nav.home')}>Kinga<span>Pesa</span><span className="kp-brand-dot" aria-hidden="true">.</span></a>
      <div className="kp-nav-actions">
        <label className="kp-language"><Icon name="globe" /><span className="kp-sr-only">{t('language')}</span>
          <span aria-hidden="true">{language.toUpperCase()}</span>
          <select value={language} onChange={event => onLanguageChange(event.target.value)} aria-label={t('language')}>
            {languages.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select><span aria-hidden="true">⌄</span>
        </label>
        {profile ? <div className="kp-profile" aria-label={t('nav.profile', { name: 'Naledi' })}><span className="kp-avatar" aria-hidden="true">N</span><span className="kp-profile-name">Naledi<span>{t('nav.personal')}</span></span></div>
          : back ? <a className="kp-button kp-button-small kp-back" href="/">← Back</a>
          : <button className="kp-button kp-button-small" onClick={onSignIn}>Sign In <Icon name="arrow" /></button>}
      </div>
    </nav>
  </header>;
}

export function Hero() {
  return <section className="kp-welcome" aria-labelledby="welcome-title">
    <div className="kp-intro"><p className="kp-eyebrow">CONNECTED BY MORE THAN BORDERS</p><span className="kp-intro-note">Closer to the people who matter.</span></div>
    <div className="kp-hero">
      {/* COLLAGE PLACEHOLDER: set --kp-hero-image to url('/images/welcome-collage.webp')
          in welcome.css when supplied. One static background, behind all text;
          the gradient remains a fallback. Never clip photography into the letters. */}
      <div className="kp-hero-content"><p className="kp-hero-kicker">A little closer to home.</p><h1 id="welcome-title">HELLO<span>Naledi</span></h1></div>
      <p className="kp-hero-caption">Across borders.<br />Always connected.</p>
    </div>
    <svg className="kp-network" viewBox="0 0 220 160" fill="none" aria-hidden="true"><ellipse cx="110" cy="80" rx="94" ry="60" /><ellipse cx="110" cy="80" rx="45" ry="60" /><path d="M16 80h188M30 48l147 74M35 118 176 37M110 20v120" /><circle cx="69" cy="65" r="4" /><circle cx="147" cy="57" r="4" /><circle cx="128" cy="97" r="4" /></svg>
  </section>;
}

const services = [
  { icon: 'rates', title: 'Check rates', description: 'See the exchange before you send.', public: true },
  { icon: 'send', title: 'Send money', description: 'A little support. A world of difference.' },
  { icon: 'airtime', title: 'Buy airtime', description: 'Keep the conversation going.' },
  { icon: 'electricity', title: 'Buy electricity', description: 'Help keep the lights on at home.' },
  { icon: 'food', title: 'Food vouchers', description: 'Put everyday essentials within reach.' },
  { icon: 'history', title: 'Transaction history', description: 'Your support, all in one place.' },
];

export function ServiceCard({ service, onSelect }) {
  return <button className={`kp-service-card${service.public ? ' kp-service-public' : ''}`} onClick={() => onSelect(service)}>
    <span className="kp-card-top"><span className="kp-service-icon"><Icon name={service.icon} /></span><Icon name="arrow" className="kp-card-arrow" /></span>
    <span className="kp-service-title">{service.title}</span><span className="kp-service-description">{service.description}</span>
    <span className="kp-service-access">{service.public ? <><span className="kp-access-dot" />No sign in needed</> : <><Icon name="lock" />Sign in required</>}</span>
  </button>;
}

export function ServiceGrid({ onSelect }) {
  return <section className="kp-services" aria-labelledby="services-title">
    <div className="kp-section-heading"><div><p className="kp-eyebrow">EVERYDAY WAYS TO CARE</p><h2 id="services-title">How can we help today?</h2></div><p>For you. For family. For home.</p></div>
    <div className="kp-service-grid">{services.map(service => <ServiceCard key={service.icon} service={service} onSelect={onSelect} />)}</div>
  </section>;
}
