import React, { useEffect, useState } from 'react';
import { Hero, Icon, Navbar, ServiceGrid } from './components/WelcomeParts';
import { languageStorageKey, readLanguage } from './i18n/translations';
import './welcome.css';

export default function Welcome() {
  const [language, setLanguage] = useState(readLanguage);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    // The language preference is shared with the existing demo. Welcome copy is
    // English for this design milestone; full welcome translations come later.
    document.documentElement.lang = 'en';
    try { localStorage.setItem(languageStorageKey, language); } catch { /* Still usable without storage. */ }
  }, [language]);
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* Online welcome remains usable. */ });
    }
  }, []);
  const signIn = () => window.location.assign('/login');
  function selectService(service) {
    setNotice(service.public
      ? 'Check rates will be available without signing in. The rate-checking screen is coming in a later step.'
      : `${service.title} will require Sign In. This service is not connected on the welcome preview yet.`);
  }
  return <div className="kp-home">
    <a className="kp-skip" href="#main-content">Skip to content</a>
    <Navbar language={language} onLanguageChange={value => {
      setLanguage(value);
      setNotice('Language preference saved. This welcome preview is currently in English.');
    }} onSignIn={signIn} />
    <main id="main-content" className="kp-container" tabIndex={-1}>
      <Hero /><ServiceGrid onSelect={selectService} />
      <div className="kp-notice" role="status" aria-live="polite" aria-atomic="true">{notice && <><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></>}</div>
      <section className="kp-sign-in" aria-labelledby="sign-in-title"><div><h2 id="sign-in-title">Your people. A little closer.</h2><p>Sign in to send support and stay connected.</p></div><button className="kp-button" onClick={signIn}>Sign In to KingaPesa <Icon name="arrow" /></button></section>
    </main>
    <footer className="kp-footer kp-container"><span>KingaPesa <span aria-hidden="true">/</span> Made for connection.</span><span>Prototype · No real money moves here.</span></footer>
  </div>;
}
