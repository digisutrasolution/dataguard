import { useEffect, useState } from 'react';
import { api, type JobRow, type MyStats } from '../lib/api';
import { PageHeader, Card, StatCard, Badge, compact, money } from '../components/ui';

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
      <PageHeader title="Dashboard" sub="Welcome back — your account at a glance" />

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <StatCard label="Wallet balance" value={balance === null ? '—' : compact(balance)} icon="wallet" tone="brand"
          foot={balance === null ? '' : `≈ ${money(balance * 0.0025)} · auto-deduct on`} />
        <StatCard label="Usage this month" value={stats ? compact(stats.numbersThisMonth) : '—'} icon="phone-check" tone="info"
          foot={stats ? `${stats.jobs} jobs` : ''} />
        <StatCard label="Success rate" value={stats ? `${stats.successRate}%` : '—'} icon="circle-check" tone="success" foot="valid / total" />
        <StatCard label="Credits spent" value={stats ? compact(stats.creditsSpent) : '—'} icon="coin" tone="muted" foot="this month" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
        <Card title="Recent jobs" action={<a className="hint" href="/validate">View all</a>}>
          {jobs.length === 0 && <p className="hint">No jobs yet — run one from Validate.</p>}
          {jobs.map((j) => {
            const total = num(j.total_records);
            const rate = total ? Math.round((num(j.valid_count) / total) * 100) : 0;
            return (
              <div key={j.id} className="between" style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                <div className="row">
                  <span className="stat-ic" style={{ background: 'var(--brand-bg)', color: 'var(--brand)', width: 32, height: 32 }}><i className="ti ti-file-check" aria-hidden="true" /></span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{j.service} · {j.country ?? '—'}</div>
                    <div className="hint">{total.toLocaleString()} records · {new Date(j.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge tone="ok">{j.status}</Badge>
                  <div className="hint" style={{ marginTop: 3 }}>{rate}% valid</div>
                </div>
              </div>
            );
          })}
        </Card>

        <Card title="Crypto recharge" action={<span className="pill run">USDT</span>}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
            {['USDT', 'BTC', 'ETH', 'TRX'].map((c, i) => (
              <div key={c} style={{ textAlign: 'center', fontSize: 12, padding: '8px 0', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', background: i === 0 ? 'var(--brand-bg)' : 'transparent', color: i === 0 ? 'var(--brand)' : 'var(--text-2)', fontWeight: i === 0 ? 500 : 400 }}>{c}</div>
            ))}
          </div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 16, textAlign: 'center' }}>
            <div aria-hidden="true" style={{ width: 84, height: 84, margin: '0 auto 10px', background: 'repeating-conic-gradient(var(--text) 0 25%, transparent 0 50%) 50%/13px 13px', borderRadius: 6, opacity: .85 }} />
            <div className="hint">Send USDT (TRC-20) to</div>
            <div className="mono">TJ8x…9Kd2qP</div>
          </div>
          <p className="hint" style={{ textAlign: 'center', marginBottom: 0, marginTop: 10 }}><i className="ti ti-clock" aria-hidden="true" /> Awaiting 1/12 confirmations</p>
        </Card>
      </div>
    </>
  );
}
