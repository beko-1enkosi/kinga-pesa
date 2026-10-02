import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { hasDemoSession } from './demoAccount';

// Separate lazy entry points keep the existing prototype and public screens isolated.
const routes = {
  '/demo': lazy(async () => { await import('./style.css'); return import('./DemoApp'); }),
  '/whatsapp': lazy(() => import('./WhatsApp')),
  '/send': lazy(() => import('./Send')),
  '/login': lazy(() => import('./Login')),
  '/app': lazy(() => import('./Dashboard')),
};
const Welcome = lazy(() => import('./Welcome'));
const Page = routes[window.location.pathname.replace(/\/$/, '')] || Welcome;

// Demo-session selection only, not production authentication.
const accountRoute = ['/app', '/send', '/whatsapp', '/demo'].includes(window.location.pathname.replace(/\/$/, ''));
if (accountRoute && !hasDemoSession()) window.location.replace('/login');
// Do not restore a previous account screen (and its balance) from browser history.
if (accountRoute) {
  window.addEventListener('pagehide', () => { document.getElementById('root').style.visibility = 'hidden'; });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
}
createRoot(document.getElementById('root')).render(
  accountRoute && !hasDemoSession() ? null : <Suspense fallback={<p role="status">KingaPesa…</p>}><Page /></Suspense>,
);
