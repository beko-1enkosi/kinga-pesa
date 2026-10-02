import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

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

createRoot(document.getElementById('root')).render(
  <Suspense fallback={<p role="status">KingaPesa…</p>}><Page /></Suspense>,
);
