import { useEffect, useState } from 'react';
import { api, type AdminStats } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader, Card, StatCard, Segmented, MeterRow, compact, money } from '../components/ui';

function TwoFactorCard() {
  const { user, refresh } = useAuth();
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function start() { const r = await api.auth.setup2fa(); setSecret(r.secret); setOtpauth(r.otpauth); setMsg(null); }
  async function enable() {
    const r = await api.auth.enable2fa(code);
    if (r.enabled) { setMsg('2FA enabled'); setOtpauth(null); refresh(); } else setMsg('Invalid code, try again');
  }
  async function disable() { await api.auth.disable2fa(); setMsg('2FA disabled'); refresh(); }

  return (
    <Card title="Security · two-factor authentication">
      {user?.twofaEnabled ? (
        <div className="row"><span className="pill ok"><span className="dot" />2FA enabled</span>
          <button className="btn sm" onClick={disable}>Disable</button></div>
      ) : otpauth ? (
        <div>
          <p className="hint" style={{ marginTop: 0 }}>Add to your authenticator app, then enter the 6-digit code.</p>
          <div className="mono" style={{ wordBreak: 'break-all', marginBottom: 10 }}>secret: {secret}</div>
          <div className="row">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" style={{ maxWidth: 150 }} />
            <button className="btn primary" onClick={enable}>Enable</button>
          </div>
        </div>
      ) : (
        <div className="row"><span className="pill warn">2FA not enabled</span>
          <button className="btn primary sm" onClick={start}>Set up 2FA</button></div>
      )}
      {msg && <p className="hint" style={{ marginBottom: 0, marginTop: 10 }}>{msg}</p>}
    </Card>
  );
}

export default function AdminDashboard() {
  const [s, setS] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('30d');
  useEffect(() => { api.admin.stats().then(setS).catch((e) => setErr(String(e))); }, []);

  const maxRev = s ? Math.max(...s.monthlyRevenue.map((m) => m.usd), 1) : 1;
  const maxCountry = s ? Math.max(...s.topCountries.map((c) => c.n), 1) : 1;

  return (
    <>
      <PageHeader
        title="Admin overview"
        sub={s ? `${s.customers} customers · ${s.jobs} jobs processed` : 'Loading…'}
        actions={<>
          <span className="pill ok"><span className="dot" />All workers live</span>
          <Segmented value={range} onChange={setRange}
            options={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'all', label: 'All' }]} />
        </>}
      />

      {err && <div className="pill bad" style={{ marginBottom: 16 }}>{err} — sign in as admin</div>}

      {s && (
        <>
          <div className="grid cols-kpi" style={{ marginBottom: 14 }}>
            <StatCard label="Revenue" value={money(s.revenueUsd)} icon="currency-dollar" tone="success" foot="▲ 12% vs last period" footTone="up" spark={[40, 55, 48, 70, 62, 90]} />
            <StatCard label="Credits sold" value={compact(s.creditsSold)} icon="coin" tone="brand" foot="prepaid balance issued" />
            <StatCard label="Numbers validated" value={compact(s.numbersValidated)} icon="phone-check" tone="info" foot={`across ${s.jobs} jobs`} />
            <StatCard label="Customers" value={String(s.customers)} icon="users" tone="brand" foot={`${s.activeUsers} active users`} />
            <StatCard label="Success rate" value={`${s.successRate}%`} icon="circle-check" tone="success" foot="valid / total" />
            <StatCard label="Active users" value={String(s.activeUsers)} icon="user-check" tone="muted" foot="across all accounts" />
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', marginBottom: 14 }}>
            <Card title="Monthly revenue" action={<span className="hint">last 6 months</span>}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 150 }}>
                {s.monthlyRevenue.map((m, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div title={money(m.usd)} style={{ background: i === s.monthlyRevenue.length - 1 ? 'var(--brand)' : 'var(--brand-bg)', height: `${Math.max(6, Math.round((m.usd / maxRev) * 130))}px`, borderRadius: '6px 6px 0 0' }} />
                    <div className="hint" style={{ marginTop: 6 }}>{m.m}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Top countries">
              {s.topCountries.map((c) => <MeterRow key={c.country} label={c.country} value={compact(c.n)} pct={(c.n / maxCountry) * 100} />)}
            </Card>
          </div>

          <Card title="Service performance" className="card-pad-0" pad={false} action={<span className="hint" style={{ paddingRight: 18 }}>{compact(s.numbersValidated)} total</span>}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Service</th><th>Jobs</th><th>Numbers processed</th><th>Share</th></tr></thead>
                <tbody>
                  {s.servicePerformance.map((r) => (
                    <tr key={r.service}>
                      <td style={{ textTransform: 'capitalize', fontWeight: 500 }}>{r.service}</td>
                      <td>{r.jobs}</td>
                      <td>{r.n.toLocaleString()}</td>
                      <td style={{ width: 160 }}><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.round((r.n / s.numbersValidated) * 100)}%` }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ height: 14 }} />
        </>
      )}

      <TwoFactorCard />
    </>
  );
}
