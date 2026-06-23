import { useEffect, useState } from 'react';
import { api, type AdminStats } from '../lib/api';
import { useAuth } from '../lib/auth';

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
        <div><span className="pill ok">● 2FA enabled</span>
          <button className="btn" style={{ marginLeft: 10 }} onClick={disable}>Disable</button></div>
      ) : otpauth ? (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>Add to your authenticator app, then enter the 6-digit code.</div>
          <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all', marginBottom: 8 }}>secret: {secret}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" style={{ maxWidth: 140 }} />
            <button className="btn primary" onClick={enable}>Enable</button>
          </div>
        </div>
      ) : (
        <div><span className="pill warn">2FA not enabled</span>
          <button className="btn primary" style={{ marginLeft: 10 }} onClick={start}>Set up 2FA</button></div>
      )}
      {msg && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString();
const compact = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);

export default function AdminDashboard() {
  const [s, setS] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.admin.stats().then(setS).catch((e) => setErr(String(e))); }, []);

  const maxRev = s ? Math.max(...s.monthlyRevenue.map((m) => m.usd), 1) : 1;
  const maxCountry = s ? Math.max(...s.topCountries.map((c) => c.n), 1) : 1;

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="h1">Admin overview</h1>
          <div className="sub">{s ? `${s.customers} customers · ${s.jobs} jobs processed` : 'Loading…'}</div>
        </div>
        <span className="pill ok">● All workers live</span>
      </div>

      {err && <div className="pill bad">{err} — sign in as admin</div>}

      {s && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
            <div className="metric"><div className="label">Revenue (all-time)</div><div className="value">${fmt(s.revenueUsd)}</div></div>
            <div className="metric"><div className="label">Credits sold</div><div className="value">{compact(s.creditsSold)}</div></div>
            <div className="metric"><div className="label">Customers</div><div className="value">{s.customers}</div></div>
            <div className="metric"><div className="label">Active users</div><div className="value">{s.activeUsers}</div></div>
            <div className="metric"><div className="label">Numbers validated</div><div className="value">{compact(s.numbersValidated)}</div></div>
            <div className="metric"><div className="label">Success rate</div><div className="value">{s.successRate}%</div></div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginBottom: 14 }}>
            <div className="card">
              <h3>Monthly revenue</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
                {s.monthlyRevenue.map((m, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ background: i === s.monthlyRevenue.length - 1 ? 'var(--brand)' : 'var(--brand-bg)', height: `${Math.round((m.usd / maxRev) * 110)}px`, borderRadius: '4px 4px 0 0' }} />
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{m.m}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>Top countries</h3>
              {s.topCountries.map((c) => (
                <div key={c.country} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{c.country}</span><span style={{ color: 'var(--text-2)' }}>{compact(c.n)}</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.round((c.n / maxCountry) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Service performance</h3>
            <table>
              <thead><tr><th>Service</th><th>Jobs</th><th>Numbers processed</th></tr></thead>
              <tbody>
                {s.servicePerformance.map((r) => (
                  <tr key={r.service}>
                    <td style={{ textTransform: 'capitalize' }}>{r.service}</td>
                    <td>{r.jobs}</td>
                    <td>{fmt(r.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <TwoFactorCard />
    </>
  );
}
