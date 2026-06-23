import { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import Validate from './pages/Validate';
import Providers from './pages/Providers';
import Login from './pages/Login';
import { useAuth } from './lib/auth';

function Sidebar({ theme, toggle }: { theme: string; toggle: () => void }) {
  const { user, logout } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="mark">◈</span> DataGuard
      </div>
      <div className="group">Customer</div>
      <nav className="nav">
        <NavLink to="/dashboard" className={link}>▦ Dashboard</NavLink>
        <NavLink to="/validate" className={link}>✓ Validate</NavLink>
      </nav>
      <div className="group">Admin</div>
      <nav className="nav">
        <NavLink to="/admin" className={link}>⚙ Overview</NavLink>
        <NavLink to="/admin/providers" className={link}>⊞ Detection providers</NavLink>
      </nav>
      <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14 }}>
        {user ? (
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-bg)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500 }}>
                {user.email[0].toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.email}</div>
                <div>{user.role}</div>
              </div>
            </div>
            <button className="btn" style={{ width: '100%' }} onClick={logout}>Sign out</button>
          </div>
        ) : (
          <NavLink to="/login" className="btn" style={{ display: 'block', textAlign: 'center', width: '100%', marginBottom: 8 }}>Sign in</NavLink>
        )}
        <button className="btn" style={{ width: '100%' }} onClick={toggle}>
          {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
        </button>
      </div>
    </aside>
  );
}

// Redirect to /login when not authenticated.
function Protected({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="main">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  return (
    <div className="app">
      <Sidebar theme={theme} toggle={toggle} />
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<CustomerDashboard />} />
          <Route path="/validate" element={<Validate />} />
          <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
          <Route path="/admin/providers" element={<Protected><Providers /></Protected>} />
        </Routes>
      </main>
    </div>
  );
}
