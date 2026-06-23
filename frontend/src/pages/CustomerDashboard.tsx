import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const jobs = [
  { name: 'india_leads.csv', recs: '240,000 records', state: 'ok', label: 'Completed' },
  { name: 'uae_batch.xlsx', recs: '88,000 records · 64%', state: 'run', label: 'Running' },
  { name: 'us_misc.txt', recs: '12,400 records', state: 'warn', label: 'Resumable' },
] as const;

export default function CustomerDashboard() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    api.balance().then((w) => setBalance(w.balance)).catch(() => setBalance(512400));
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
            <div style={{ fontSize: 12, opacity: 0.85 }}>auto-deduct enabled</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <span style={{ background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '7px 14px', fontSize: 13 }}>＋ Recharge</span>
              <span style={{ background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '7px 14px', fontSize: 13 }}>🧾 Invoices</span>
            </div>
          </div>
          <div className="card">
            <h3>Recent jobs</h3>
            {jobs.map((j) => (
              <div key={j.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13 }}>{j.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{j.recs}</div>
                </div>
                <span className={`pill ${j.state}`}>{j.label}</span>
              </div>
            ))}
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
            <div className="value">3.18M</div>
            <div className="bar-track" style={{ marginTop: 8 }}><div className="bar-fill" style={{ width: '62%' }} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>62% of monthly average</div>
          </div>
        </div>
      </div>
    </>
  );
}
