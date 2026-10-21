import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../store.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z' },
  { to: '/knowledge', label: 'Knowledge base', icon: 'M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h6' },
  { to: '/models', label: 'Models & voice', icon: 'M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z' },
  { to: '/calls', label: 'Calls & chats', icon: 'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z' },
  { to: '/evaluation', label: 'Evaluation', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
];

// Sibling apps. Set in Vercel project env vars (or .env); an empty value hides the link.
const LINKS = [
  ['Open agent console', import.meta.env.VITE_AGENT_CONSOLE_URL],
  ['Open citizen demo', import.meta.env.VITE_CITIZEN_DEMO_URL],
].filter(([, url]) => url);

export default function Layout() {
  const { kb } = useStore();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <NavLink className="side-brand" to="/">
          <span className="side-brand__mark" aria-hidden="true">VA</span>
          <span><strong>Voice AI Platform</strong><small>Admin console · POC</small></span>
        </NavLink>
        <nav aria-label="Admin">
          <ul className="side-nav">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.to === '/'}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                  <span>{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {LINKS.length > 0 && (
          <div className="side-foot">
            {LINKS.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <label className="tenant">
            <span className="sr-only">Helpline</span>
            <select aria-label="Helpline" defaultValue={kb.tenant}>
              <option value={kb.tenant}>{kb.tenantName}</option>
              <option disabled>+ Add helpline (later)</option>
            </select>
          </label>
          <span className="pill pill--accent" title="Knowledge base version used by live calls">KB v{kb.version}</span>
          <span className="pill pill--ok" title="Where the POC runs"><span className="dot" />POC · India-hosted</span>
          <span className="top-spacer" />
          <span className="who"><span className="avatar" aria-hidden="true">AD</span><span className="who__name">admin@dic</span></span>
        </header>
        <main className="content" id="main"><Outlet /></main>
      </div>
    </div>
  );
}
