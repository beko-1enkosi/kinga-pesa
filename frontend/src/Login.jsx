import React, { useEffect, useRef, useState } from 'react';
import { Navbar } from './components/WelcomeParts';
import PinPad from './components/PinPad';
import { languageStorageKey, readLanguage } from './i18n/translations';
import { authenticatePin } from './demoLogin';
import './welcome.css';
import './login.css';

export default function Login() {
  const [language, setLanguage] = useState(readLanguage);
  const [length, setLength] = useState(0);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // PIN exists only in component memory; the DOM receives a digit count only.
  const pin = useRef('');
  const busy = useRef(false);
  const attempt = useRef(0);
  const panel = useRef(null);

  useEffect(() => {
    panel.current?.focus();
    document.documentElement.lang = 'en';
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => { pin.current = ''; attempt.current += 1; };
  }, []);

  async function submit() {
    if (busy.current) return;
    if (pin.current.length !== 4) { setError('Enter all 4 digits to continue.'); return; }
    busy.current = true;
    setChecking(true); setError(''); setNotice('');
    const request = ++attempt.current;
    const resultPromise = authenticatePin(pin.current);
    pin.current = '';
    try {
      const result = await resultPromise;
      if (request !== attempt.current) return;
      if (result.success) {
        window.location.replace('/app');
        return;
      }
      setError("That PIN doesn't look right. Try again.");
    } catch {
      if (request !== attempt.current) return;
      setError('Unable to sign in right now. Please try again.');
    }
    if (request === attempt.current) {
      setLength(0); setChecking(false); busy.current = false;
      panel.current?.focus();
    }
  }
  function addDigit(digit) {
    if (busy.current || pin.current.length >= 4) return;
    setError(''); setNotice('');
    pin.current += digit; setLength(pin.current.length);
    if (pin.current.length === 4) submit();
  }
  function removeDigit() {
    if (busy.current) return;
    pin.current = pin.current.slice(0, -1); setLength(pin.current.length); setError('');
  }
  useEffect(() => {
    function handleKey(event) {
      // Leave native controls, browser shortcuts, and language selection alone.
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat ||
          event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (/^[0-9]$/.test(event.key)) { event.preventDefault(); addDigit(event.key); }
      else if (event.key === 'Backspace') { event.preventDefault(); removeDigit(); }
      else if (event.key === 'Enter' && !event.target.closest('button, a')) { event.preventDefault(); submit(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  return <div className="kp-home kp-login-page">
    <a className="kp-skip" href="#login-panel">Skip to PIN entry</a>
    <Navbar back language={language} onLanguageChange={value => {
      setLanguage(value);
      try { localStorage.setItem(languageStorageKey, value); } catch { /* Preference is optional. */ }
      setNotice('Language selected. This sign-in preview is currently in English.');
    }} />
    <main className="kp-login-main">
      <section ref={panel} id="login-panel" className="kp-login-panel" tabIndex={-1} aria-labelledby="login-title" aria-describedby="pin-help">
        <p className="kp-eyebrow">A LITTLE CLOSER TO HOME</p>
        <h1 id="login-title">Welcome back,<span>Thandi</span></h1>
        <h2>Enter your PIN</h2>
        <p id="pin-help" className="kp-pin-help">Use your 4-digit KingaPesa PIN to continue.</p>
        <PinPad length={length} disabled={checking} onDigit={addDigit} onDelete={removeDigit} />
        <div className="kp-pin-feedback">
          <p className="kp-pin-error" role="alert">{error}</p>
          <div role="status" aria-live="polite">{checking && <span className="kp-pin-loading"><span className="kp-loading-nodes" aria-hidden="true"><i /><i /><i /></span>Signing you in…</span>}</div>
        </div>
        <button className="kp-button kp-pin-continue" disabled={checking} onClick={submit}>Continue</button>
        <button className="kp-forgot" onClick={() => setNotice('PIN recovery is not implemented in this prototype yet.')}>Forgot PIN?</button>
        <p className="kp-pin-notice" role="status">{notice}</p>
      </section>
      <p className="kp-login-footnote">Prototype sign-in · No real account is accessed.</p>
    </main>
  </div>;
}
