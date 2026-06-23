import { useState } from 'react';
import { api, type BulkResponse, type DetectResponse } from '../lib/api';

const COUNTRIES = ['IN', 'US', 'GB', 'AE', 'AU', 'DE', 'FR', 'SG'];
const SERVICES = ['basic', 'advanced', 'premium', 'detection'] as const;

export default function Validate() {
  const [text, setText] = useState('9876543210\n9876543216\n9876543219\n(415) 555-0172\n9876543210\n12345');
  const [country, setCountry] = useState('IN');
  const [service, setService] = useState<(typeof SERVICES)[number]>('advanced');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<BulkResponse | null>(null);
  const [det, setDet] = useState<DetectResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const numbers = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  async function run() {
    setBusy(true);
    setErr(null);
    setRes(null);
    setDet(null);
    try {
      if (service === 'detection') {
        setDet(await api.detect(numbers, country));
      } else {
        setRes(await api.bulk(numbers, country, service));
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) file.text().then(setText);
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="h1">Bulk validation</h1>
          <div className="sub">Drop a file or paste numbers — normalized to E.164</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SERVICES.map((s) => (
            <span key={s} onClick={() => setService(s)} className={`pill ${service === s ? 'run' : ''}`}
              style={{ cursor: 'pointer', border: service === s ? 'none' : '1px solid var(--border)', textTransform: 'capitalize' }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', marginBottom: 14 }}>
        <div>
          <div className={`dropzone ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}>
            <div style={{ fontSize: 30 }}>⬆</div>
            <div style={{ fontWeight: 500, marginTop: 6 }}>Drag &amp; drop CSV / XLSX / TXT</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>or paste below</div>
          </div>
          <textarea style={{ marginTop: 10, minHeight: 120, fontFamily: 'monospace' }}
            value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="card">
          <h3>Options</h3>
          <label>Default country</label>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div style={{ height: 12 }} />
          <label>Numbers detected</label>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{numbers.length.toLocaleString()}</div>
          <button className="btn primary" style={{ width: '100%', marginTop: 16 }} disabled={busy || !numbers.length} onClick={run}>
            {busy ? 'Processing…' : service === 'detection' ? 'Run detection' : `Run validation (${service})`}
          </button>
          {err && <div className="pill bad" style={{ marginTop: 10 }}>{err}</div>}
        </div>
      </div>

      {res && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Results</h3>
            <span className="pill run">{res.creditsUsed} credits · balance {res.balance.toLocaleString()}</span>
          </div>
          <div className="grid cards-4" style={{ marginBottom: 14 }}>
            <div className="metric" style={{ background: 'var(--success-bg)' }}><div className="label" style={{ color: 'var(--success)' }}>Valid</div><div className="value" style={{ color: 'var(--success)' }}>{res.valid}</div></div>
            <div className="metric" style={{ background: 'var(--danger-bg)' }}><div className="label" style={{ color: 'var(--danger)' }}>Invalid</div><div className="value" style={{ color: 'var(--danger)' }}>{res.invalid}</div></div>
            <div className="metric" style={{ background: 'var(--warning-bg)' }}><div className="label" style={{ color: 'var(--warning)' }}>Duplicates</div><div className="value" style={{ color: 'var(--warning)' }}>{res.duplicate}</div></div>
            <div className="metric"><div className="label">Total</div><div className="value">{res.total}</div></div>
          </div>
          <table>
            <thead><tr><th>Input</th><th>E.164</th><th>Country</th><th>Type</th><th>Status</th></tr></thead>
            <tbody className="mono">
              {res.results.map((r, i) => (
                <tr key={i}>
                  <td>{r.raw}</td>
                  <td>{r.e164 ?? '—'}</td>
                  <td>{r.iso2 ?? '?'}</td>
                  <td>{r.numberType ?? '—'}</td>
                  <td><span className={`pill ${r.status === 'valid' ? 'ok' : r.status === 'duplicate' ? 'warn' : 'bad'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {det && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Number detection · <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>via {det.provider} provider</span></h3>
            <span className="pill run">{det.creditsUsed} credits · balance {det.balance.toLocaleString()}</span>
          </div>
          <div className="grid cards-4" style={{ marginBottom: 14 }}>
            <div className="metric" style={{ background: 'var(--success-bg)' }}><div className="label" style={{ color: 'var(--success)' }}>Registered</div><div className="value" style={{ color: 'var(--success)' }}>{det.registered}</div></div>
            <div className="metric" style={{ background: 'var(--danger-bg)' }}><div className="label" style={{ color: 'var(--danger)' }}>Unregistered</div><div className="value" style={{ color: 'var(--danger)' }}>{det.unregistered}</div></div>
            <div className="metric" style={{ background: 'var(--warning-bg)' }}><div className="label" style={{ color: 'var(--warning)' }}>Unknown</div><div className="value" style={{ color: 'var(--warning)' }}>{det.unknown}</div></div>
            <div className="metric"><div className="label">Total</div><div className="value">{det.total}</div></div>
          </div>
          <table>
            <thead><tr><th>Input</th><th>E.164</th><th>Country</th><th>Carrier</th><th>Registration</th></tr></thead>
            <tbody className="mono">
              {det.results.map((r, i) => (
                <tr key={i}>
                  <td>{r.raw}</td>
                  <td>{r.e164 ?? '—'}</td>
                  <td>{r.iso2 ?? '?'}</td>
                  <td>{r.carrier ?? '—'}</td>
                  <td><span className={`pill ${r.registration === 'registered' ? 'ok' : r.registration === 'unregistered' ? 'bad' : 'warn'}`}>{r.registration}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
