import { useEffect, useState } from 'react';
import { api, type ApiKey, type ApiLog } from '../lib/api';
import { PageHeader, Card, Badge } from '../components/ui';

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [label, setLabel] = useState('');
  const [rate, setRate] = useState(1000);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => { api.apiKeys.list().then(setKeys).catch(() => {}); api.apiKeys.logs().then(setLogs).catch(() => {}); };
  useEffect(() => { load(); }, []);

  async function create() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      const k = await api.apiKeys.create(label.trim(), rate);
      setFresh(k.key); setLabel(''); load();
    } finally { setBusy(false); }
  }
  async function revoke(id: string) { await api.apiKeys.revoke(id); load(); }
  function copy() { if (fresh) { navigator.clipboard?.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 1500); } }

  return (
    <>
      <PageHeader title="API keys" sub="Authenticate API requests with the x-api-key header" />

      {fresh && (
        <div className="card" style={{ borderColor: 'var(--brand)', marginBottom: 14 }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <strong style={{ fontWeight: 600 }}>Your new API key</strong>
            <button className="btn ghost sm icon-btn" onClick={() => setFresh(null)} aria-label="Dismiss"><i className="ti ti-x" aria-hidden="true" /></button>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>Copy it now — it won't be shown again.</p>
          <div className="between" style={{ gap: 8, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
            <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fresh}</span>
            <button className="btn sm" onClick={copy}><i className={`ti ti-${copied ? 'check' : 'copy'}`} aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', marginBottom: 14 }}>
        <Card title="Your keys" pad={false} className="card-pad-0">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Label</th><th>Key</th><th>Rate/min</th><th>Used</th><th>Last used</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 500 }}>{k.label ?? '—'}</td>
                    <td className="mono hint">{k.key_prefix}</td>
                    <td>{k.rate_limit.toLocaleString()}</td>
                    <td>{k.request_count.toLocaleString()}</td>
                    <td className="muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}</td>
                    <td>{k.is_active ? <Badge tone="ok">active</Badge> : <Badge tone="bad">revoked</Badge>}</td>
                    <td style={{ textAlign: 'right' }}>{k.is_active && <button className="btn sm" onClick={() => revoke(k.id)}>Revoke</button>}</td>
                  </tr>
                ))}
                {keys.length === 0 && <tr><td colSpan={7} className="hint" style={{ textAlign: 'center', padding: 24 }}>No API keys yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Create key">
          <label htmlFor="lbl">Label</label>
          <input id="lbl" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Production server" />
          <div style={{ marginTop: 12 }}>
            <label htmlFor="rl">Rate limit (req/min)</label>
            <input id="rl" type="number" min={60} step={100} value={rate} onChange={(e) => setRate(Math.max(60, Number(e.target.value)))} />
          </div>
          <button className="btn primary" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} disabled={busy || !label.trim()} onClick={create}>
            {busy ? 'Creating…' : 'Create API key'}
          </button>
        </Card>
      </div>

      <Card title="Recent API requests" pad={false} className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Method</th><th>Endpoint</th><th>Status</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td className="mono">{l.method}</td>
                  <td className="mono">{l.path}</td>
                  <td><Badge tone={l.status < 400 ? 'ok' : 'bad'}>{l.status}</Badge></td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} className="hint" style={{ textAlign: 'center', padding: 24 }}>No API requests logged yet — use a key to see traffic here.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
