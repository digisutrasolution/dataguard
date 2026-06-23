import { useEffect, useState } from 'react';
import { api, type JobRow, type MyStats } from '../lib/api';

const compact = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
const num = (v: number | string) => Number(v);

export default function CustomerDashboard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    api.balance().then((w) => setBalance(w.balance)).catch(() => {});
    api.history().then((j) => setJobs(j.slice(0, 5))).catch(() => {});
    api.myStats().then(setStats).catch(() => {});
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="h1">Dashboard</h1>
          <div className="sub">Welcome back — here's your account at a glance</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="grid" style={{ gap: 14 }}>
          <div className="card" style={{ background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Wallet balance</div>
            <div style={{ fontSize: 30, fontWeight: 600, margin: '2px 0' }}>
              {balance === null ? '—' : balance.toLocaleString()} <span style={{ fontSize: 14, opacity: 0.85 }}>credits</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {balance === null ? '' : `≈ $${Math.round(balance * 0.0025).toLocaleString()} · auto-deduct enabled`}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <span style={{ background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '7px 14px', fontSize: 13 }}>＋ Recharge</span>
              <span style={{ background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '7px 14px', fontSize: 13 }}>🧾 Invoices</span>
            </div>
          </div>

          <div className="card">
            <h3>Recent jobs</h3>
            {jobs.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No jobs yet — run one from Validate.</div>}
            {jobs.map((j) => {
              const total = num(j.total_records);
              const valid = num(j.valid_count);
              const rate = total ? Math.round((valid / total) * 100) : 0;
              return (
                <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, textTransform: 'capitalize' }}>{j.service} · {j.country ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{total.toLocaleString()} records · {new Date(j.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="pill ok">{j.status}</span>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{rate}% valid</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid" style={{ gap: 14 }}>
          <div className="card">
            <h3>Crypto recharge</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12, fontSize: 12, textAlign: 'center' }}>
              {['USDT', 'BTC', 'ETH', 'TRX'].map((c, i) => (
                <div key={c} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 0', background: i === 0 ? 'var(--brand-bg)' : 'transparent', color: i === 0 ? 'var(--brand)' : 'var(--text-2)' }}>{c}</div>
              ))}
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, margin: '0 auto 8px', background: 'repeating-conic-gradient(var(--text) 0 25%, transparent 0 50%) 50%/12px 12px', borderRadius: 6, opacity: 0.85 }} />
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Send USDT (TRC-20) to</div>
              <div className="mono">TJ8x...9Kd2qP</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8, textAlign: 'center' }}>⏱ Awaiting 1/12 confirmations</div>
          </div>

          <div className="metric">
            <div className="label">Usage this month</div>
            <div className="value">{stats ? compact(stats.numbersThisMonth) : '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
              {stats ? `${stats.jobs} jobs · ${stats.successRate}% valid · ${stats.creditsSpent.toLocaleString()} credits` : ''}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
