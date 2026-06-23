import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const bars = [45, 60, 52, 72, 65, 90];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const countries = [
  { name: 'India +91', pct: 38 },
  { name: 'USA +1', pct: 22 },
  { name: 'UK +44', pct: 14 },
  { name: 'UAE +971', pct: 9 },
];

function TwoFactorCard() {
  const { user, refresh } = useAuth();
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function start() {
    const r = await api.auth.setup2fa();
    setSecret(r.secret);
    setOtpauth(r.otpauth);
    setMsg(null);
  }
  async function enable() {
    const r = await api.auth.enable2fa(code);
    if (r.enabled) { setMsg('2FA enabled ✓'); setOtpauth(null); refresh(); }
    else setMsg('Invalid code, try again');
  }
  async function disable() { await api.auth.disable2fa(); setMsg('2FA disabled'); refresh(); }

  return (
    <div className="card">
      <h3>Security · two-factor authentication</h3>
      {user?.twofaEnabled ? (
        <div>
          <span className="pill ok">● 2FA enabled</span>
          <button className="btn" style={{ marginLeft: 10 }} onClick={disable}>Disable</button>
        </div>
      ) : otpauth ? (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
            Add to your authenticator app, then enter the 6-digit code.
          </div>
          <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all', marginBottom: 8 }}>secret: {secret}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" style={{ maxWidth: 140 }} />
            <button className="btn primary" onClick={enable}>Enable</button>
          </div>
        </div>
      ) : (
        <div>
          <span className="pill warn">2FA not enabled</span>
          <button className="btn primary" style={{ marginLeft: 10 }} onClick={start}>Set up 2FA</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="h1">Admin overview</h1>
          <div className="sub">System healthy · 99.99% uptime</div>
        </div>
        <span className="pill ok">● All workers live</span>
      </div>

      <div className="grid cards-4" style={{ marginBottom: 14 }}>
        <div className="metric"><div className="label">Revenue (30d)</div><div className="value">$184,920</div><div className="delta up">▲ 12.4%</div></div>
        <div className="metric"><div className="label">Active customers</div><div className="value">2,847</div><div className="delta up">▲ 5.1%</div></div>
        <div className="metric"><div className="label">Validations (30d)</div><div className="value">1.42B</div><div className="delta up">▲ 18%</div></div>
        <div className="metric"><div className="label">Success rate</div><div className="value">97.3%</div><div className="delta">avg</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="card">
          <h3>Revenue trend</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
            {bars.map((h, i) => (
              <div key={i} style={{ flex: 1, background: i === bars.length - 1 ? 'var(--brand)' : 'var(--brand-bg)', height: `${h}%`, borderRadius: '4px 4px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            {months.map((m) => <span key={m}>{m}</span>)}
          </div>
        </div>
        <div className="card">
          <h3>Top countries</h3>
          {countries.map((c) => (
            <div key={c.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span>{c.name}</span><span style={{ color: 'var(--text-2)' }}>{c.pct}%</span>
              </div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${c.pct}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <TwoFactorCard />
      </div>
    </>
  );
}
