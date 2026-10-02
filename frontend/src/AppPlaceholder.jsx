import React from 'react';
import './welcome.css';
import './login.css';

// Temporary destination only. No session, dashboard, or access control yet.
export default function AppPlaceholder() {
  return <div className="kp-home"><main className="kp-app-placeholder">
    <h1>KingaPesa</h1><h2>Welcome, Naledi</h2><p>Dashboard coming next.</p>
  </main></div>;
}
