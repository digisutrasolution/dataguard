import { useState } from 'react';
import { api, type BulkResponse, type DetectResponse } from '../lib/api';
import { PageHeader, Card, Segmented, Badge } from '../components/ui';

const COUNTRIES = ['IN', 'US', 'GB', 'AE', 'AU', 'DE', 'FR', 'SG'];
type Service = 'basic' | 'advanced' | 'premium' | 'detection';
const SERVICES: { value: Service; label: string }[] = [
  { value: 'basic', label: 'Basic' }, { value: 'advanced', label: 'Advanced' },
  { value: 'premium', label: 'Premium' }, { value: 'detection', label: 'Detection' },
];

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'bad' | 'warn' }) {
  const bg = tone === 'ok' ? 'var(--success-bg)' : tone === 'bad' ? 'var(--danger-bg)' : tone === 'warn' ? 'var(--warning-bg)' : 'var(--surface-2)';
  const fg = tone === 'ok' ? 'var(--success)' : tone === 'bad' ? 'var(--danger)' : tone === 'warn' ? 'var(--warning)' : 'var(--text)';
  return (
    <div style={{ background: bg, borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: fg, opacity: .85 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: fg }}>{value.toLocaleString()}</div>
    </div>
  );
}

export default function Validate() {
  const [text, setText] = useState('9876543210\n9876543216\n9876543219\n(415) 555-0172\n9876543210\n12345');
  const [country, setCountry] = useState('IN');
  const [service, setService] = useState<Service>('advanced');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<BulkResponse | null>(null);
  const [det, setDet] = useState<DetectResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const numbers = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  async function run() {
    setBusy(true); setErr(null); setRes(null); setDet(null);
    try {
      if (service === 'detection') setDet(await api.detect(numbers, country));
      else setRes(await api.bulk(numbers, country, service));
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) file.text().then(setText);
  }

  return (
    <>
      <PageHeader title="Bulk validation" sub="Drop a file or paste numbers — normalized to E.164"
        actions={<Segmented value={service} onChange={setService} options={SERVICES} />} />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', marginBottom: 14 }}>
        <Card>
          <div className={`dropzone ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)} onDrop={onDrop}>
            <i className="ti ti-cloud-upload" style={{ fontSize: 32, color: 'var(--brand)' }} aria-hidden="true" />
            <div style={{ fontWeight: 500, marginTop: 8 }}>Drag &amp; drop CSV / TXT</div>
            <div className="hint">or paste numbers below</div>
          </div>
          <textarea style={{ marginTop: 12, minHeight: 130, fontFamily: 'var(--font-mono, monospace)' }}
            value={text} onChange={(e) => setText(e.target.value)} aria-label="Numbers to validate" />
        </Card>

        <Card title="Options">
          <label htmlFor="country">Default country</label>
          <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div style={{ marginTop: 16 }}>
            <label>Numbers detected</label>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{numbers.length.toLocaleString()}</div>
          </div>
          <button className="btn primary" style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}
            disabled={busy || !numbers.length} onClick={run}>
            {busy ? 'Processing…' : service === 'detection' ? 'Run detection' : `Run validation · ${service}`}
          </button>
          {err && <div className="pill bad" style={{ marginTop: 12 }}>{err}</div>}
        </Card>
      </div>

      {res && (
        <Card title="Validation results" action={<span className="pill run">{res.creditsUsed} credits · balance {res.balance.toLocaleString()}</span>}>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <Metric label="Valid" value={res.valid} tone="ok" />
            <Metric label="Invalid" value={res.invalid} tone="bad" />
            <Metric label="Duplicates" value={res.duplicate} tone="warn" />
            <Metric label="Total" value={res.total} />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Input</th><th>E.164</th><th>Country</th><th>Type</th><th>Status</th></tr></thead>
              <tbody className="mono">
                {res.results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.raw}</td><td>{r.e164 ?? '—'}</td><td>{r.iso2 ?? '?'}</td><td>{r.numberType ?? '—'}</td>
                    <td><Badge tone={r.status === 'valid' ? 'ok' : r.status === 'duplicate' ? 'warn' : 'bad'}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {det && (
        <Card title={`Number detection · via ${det.provider} provider`}
          action={<span className="pill run">{det.creditsUsed} credits · balance {det.balance.toLocaleString()}</span>}>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <Metric label="Registered" value={det.registered} tone="ok" />
            <Metric label="Unregistered" value={det.unregistered} tone="bad" />
            <Metric label="Unknown" value={det.unknown} tone="warn" />
            <Metric label="Total" value={det.total} />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Input</th><th>E.164</th><th>Country</th><th>Carrier</th><th>Registration</th></tr></thead>
              <tbody className="mono">
                {det.results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.raw}</td><td>{r.e164 ?? '—'}</td><td>{r.iso2 ?? '?'}</td><td>{r.carrier ?? '—'}</td>
                    <td><Badge tone={r.registration === 'registered' ? 'ok' : r.registration === 'unregistered' ? 'bad' : 'warn'}>{r.registration}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
