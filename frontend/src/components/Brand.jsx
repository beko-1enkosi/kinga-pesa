import React, { useEffect, useState } from 'react';
import horizontal from '../assets/kingapesa-horizontal.webp';
import stackedLogo from '../assets/kingapesa-stacked.webp';
import './brand.css';

export function BrandLogo({ stacked = false }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="kp-logo-fallback">KingaPesa</span> : <img
    className={stacked ? 'kp-logo kp-logo-stacked' : 'kp-logo'}
    src={stacked ? stackedLogo : horizontal} alt="KingaPesa"
    width={stacked ? 360 : 640} height={stacked ? 462 : 197}
    decoding="async" onError={() => setFailed(true)} />;
}

function EntryLoading() {
  return <div className="kp-brand-loading kp-entry" role="status" aria-label="KingaPesa">
    <div className="kp-entry-content"><div className="kp-entry-logo"><BrandLogo stacked /></div>
      <p className="kp-entry-tagline" lang="en">Send money. Support needs.<br />Stay connected.</p>
      <div className="kp-entry-corridors" aria-hidden="true"><span>🇿🇦 <i /></span><span>🇿🇼 <i /></span><span>🇧🇼</span></div>
      <span className="kp-entry-progress" aria-hidden="true"><span /></span>
    </div>
  </div>;
}

export function AppEntry({ children }) {
  const [show, setShow] = useState(() => {
    try { return ['/', '/index.html'].includes(window.location.pathname) && sessionStorage.getItem('kingapesa.brandEntry') !== 'seen'; } catch { return false; }
  });
  useEffect(() => {
    // Entering any app route consumes the entry moment, including a direct login.
    try { sessionStorage.setItem('kingapesa.brandEntry', 'seen'); } catch { /* Branding never blocks app access. */ }
    if (!show) return;
    const timer = setTimeout(() => setShow(false), matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 1100);
    return () => clearTimeout(timer);
  }, [show]);
  return <>{show && <EntryLoading />}<div hidden={show}>{children}</div></>;
}
