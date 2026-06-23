import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { loginWithToken } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@dataguard.io');
  const [password, setPassword] = useState('admin123');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.auth.login(email, password, totp || undefined);
      if (r.token && r.user) {
        loginWithToken(r.token, r.user);
        nav('/admin');
      } else if (r.error === 'twofa_required') {
        setNeedTotp(true);
        setErr('Enter your 2FA code to continue.');
      } else {
        setErr(r.error ?? 'Login failed');
      }
    } catch (e) {
      const msg = String(e).includes('twofa') ? '2FA code invalid' : 'Invalid email or password';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '8vh auto' }}>
      <div className="logo" style={{ justifyContent: 'center', marginBottom: 8 }}>
        <span className="mark">◈</span> DataGuard
      </div>
      <div className="sub" style={{ textAlign: 'center', marginBottom: 22 }}>Sign in to your account</div>
      <div className="card">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <div style={{ height: 12 }} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {needTotp && (
          <>
            <div style={{ height: 12 }} />
            <label>2FA code</label>
            <input value={totp} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" placeholder="123456" />
          </>
        )}
        {err && <div className="pill bad" style={{ marginTop: 12 }}>{err}</div>}
        <button className="btn primary" style={{ width: '100%', marginTop: 16 }} disabled={busy} onClick={submit}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>
          Demo: admin@dataguard.io / admin123 · owner@acme.com / owner123
        </div>
      </div>
    </div>
  );
}
