import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { hasDemoSession } from './demoAccount';
import './tokens.css';
import { AppEntry } from './components/Brand';

// Separate lazy entry points keep the existing prototype and public screens isolated.
const ServicePurchase = lazy(() => import('./ServicePurchase'));
const routes = {
  '/services/airtime': ServicePurchase,
  '/services/electricity': ServicePurchase,
  '/services/voucher': ServicePurchase,
  '/demo': lazy(async () => { await import('./style.css'); return import('./DemoApp'); }),
  '/whatsapp': lazy(() => import('./WhatsApp')),
  '/send': lazy(() => import('./Send')),
  '/login': lazy(() => import('./Login')),
  '/app': lazy(() => import('./Dashboard')),
};
const Welcome = lazy(() => import('./Welcome'));
const Page = routes[window.location.pathname.replace(/\/$/, '')] || Welcome;

// Demo-session selection only, not production authentication.
const accountRoute = ['/app', '/send', '/whatsapp', '/demo', '/services/airtime', '/services/electricity', '/services/voucher'].includes(window.location.pathname.replace(/\/$/, ''));
if (accountRoute && !hasDemoSession()) window.location.replace('/login');
// Do not restore a previous account screen (and its balance) from browser history.
if (accountRoute) {
  window.addEventListener('pagehide', () => { document.getElementById('root').style.visibility = 'hidden'; });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
}
createRoot(document.getElementById('root')).render(
  accountRoute && !hasDemoSession() ? null : <AppEntry><Suspense fallback={null}><Page /></Suspense></AppEntry>,
);
