import { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import Validate from './pages/Validate';
import Recharge from './pages/Recharge';
import Providers from './pages/Providers';
import Customers from './pages/Customers';
import Audit from './pages/Audit';
import Login from './pages/Login';
import { useAuth } from './lib/auth';

const NAV = {
  customer: [
    { to: '/dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { to: '/validate', icon: 'circle-check', label: 'Validate' },
    { to: '/recharge', icon: 'wallet', label: 'Recharge' },
  ],
  admin: [
    { to: '/admin', icon: 'chart-bar', label: 'Overview' },
    { to: '/admin/customers', icon: 'users', label: 'Customers' },
    { to: '/admin/providers', icon: 'plug-connected', label: 'Providers' },
    { to: '/admin/audit', icon: 'history', label: 'Activity log' },
  ],
};

function Sidebar({ open, onClose, theme, toggleTheme }:
  { open: boolean; onClose: () => void; theme: string; toggleTheme: () => void }) {
  const { user, logout } = useAuth();
  const cls = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`;
  const item = (n: { to: string; icon: string; label: string }) => (
    <NavLink key={n.to} to={n.to} end={n.to === '/admin'} className={cls} onClick={onClose}>
      <i className={`ti ti-${n.icon} ic`} aria-hidden="true" />{n.label}
    </NavLink>
  );
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><span className="mark"><i className="ti ti-shield-check" aria-hidden="true" /></span>DataGuard</div>
      <div className="nav-group">Customer</div>
      <nav className="nav">{NAV.customer.map(item)}</nav>
      <div className="nav-group">Admin</div>
      <nav className="nav">{NAV.admin.map(item)}</nav>
      <div className="sidebar-foot">
        <button className="btn ghost sm" onClick={toggleTheme} style={{ justifyContent: 'flex-start' }}>
          <i className={`ti ti-${theme === 'dark' ? 'sun' : 'moon'}`} aria-hidden="true" />{theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {user ? (
          <div className="card" style={{ padding: 10, boxShadow: 'none' }}>
            <div className="userline">
              <div className="avatar">{user.email[0].toUpperCase()}</div>
              <div className="meta"><div className="nm">{user.email}</div><div className="rl">{user.role}</div></div>
            </div>
            <button className="btn sm" style={{ width: '100%', marginTop: 8 }} onClick={logout}>Sign out</button>
          </div>
        ) : (
          <NavLink to="/login" className="btn primary sm" style={{ justifyContent: 'center' }} onClick={onClose}>Sign in</NavLink>
        )}
      </div>
    </aside>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="main hint">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [drawer, setDrawer] = useState(false);
  document.documentElement.setAttribute('data-theme', theme);
  const loc = useLocation();
  const isLogin = loc.pathname === '/login';

  if (isLogin) {
    document.documentElement.setAttribute('data-theme', theme);
    return <Routes><Route path="/login" element={<Login />} /></Routes>;
  }

  return (
    <div className="app">
      <Sidebar open={drawer} onClose={() => setDrawer(false)} theme={theme}
        toggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
      <div className={`backdrop ${drawer ? 'show' : ''}`} onClick={() => setDrawer(false)} aria-hidden="true" />
      <div className="content">
        <div className="topbar">
          <button className="btn icon-btn ghost" onClick={() => setDrawer(true)} aria-label="Open menu"><i className="ti ti-menu-2" aria-hidden="true" /></button>
          <div className="brand" style={{ padding: 0 }}><span className="mark" style={{ width: 28, height: 28 }}><i className="ti ti-shield-check" aria-hidden="true" /></span>DataGuard</div>
          <span style={{ width: 36 }} />
        </div>
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<CustomerDashboard />} />
            <Route path="/validate" element={<Validate />} />
          <Route path="/recharge" element={<Recharge />} />
            <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
            <Route path="/admin/customers" element={<Protected><Customers /></Protected>} />
            <Route path="/admin/providers" element={<Protected><Providers /></Protected>} />
            <Route path="/admin/audit" element={<Protected><Audit /></Protected>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
