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

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
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
    } catch (ex) {
      setErr(String(ex).includes('twofa') ? '2FA code invalid' : 'Invalid email or password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: 'center', fontSize: 20, marginBottom: 4 }}>
          <span className="mark"><i className="ti ti-shield-check" aria-hidden="true" /></span>DataGuard
        </div>
        <p className="hint" style={{ textAlign: 'center', marginBottom: 20 }}>Sign in to your account</p>
        <form className="card" onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <div style={{ height: 14 }} />
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {needTotp && (
            <>
              <div style={{ height: 14 }} />
              <label htmlFor="totp">2FA code</label>
              <input id="totp" value={totp} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" placeholder="123456" autoFocus />
            </>
          )}
          {err && <div className="pill bad" style={{ marginTop: 14 }}>{err}</div>}
          <button className="btn primary" style={{ width: '100%', marginTop: 18, justifyContent: 'center' }} disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="hint" style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
            Demo: admin@dataguard.io / admin123 · owner@acme.com / owner123
          </p>
        </form>
      </div>
    </div>
  );
}
