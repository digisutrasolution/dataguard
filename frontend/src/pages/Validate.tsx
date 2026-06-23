import { useEffect, useRef, useState } from 'react';
import { api, type JobDetail } from '../lib/api';
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
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [queueMode, setQueueMode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const numbers = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const isDet = job?.job_type === 'detection';
  const stopPoll = () => { if (poll.current) { clearInterval(poll.current); poll.current = null; } };
  useEffect(() => stopPoll, []);

  async function run() {
    setBusy(true); setErr(null); setJob(null); stopPoll();
    try {
      const sub = await api.submitJob(numbers, country, service, priority);
      setQueueMode(sub.queue);
      poll.current = setInterval(async () => {
        try {
          const j = await api.job(sub.jobId);
          setJob(j);
          if (j.status === 'completed' || j.status === 'failed') { stopPoll(); setBusy(false); }
        } catch { stopPoll(); setBusy(false); }
      }, 600);
    } catch (e) { setErr(String(e)); setBusy(false); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) file.text().then(setText);
  }

  const pct = job && job.total_records ? Math.round((job.processed / job.total_records) * 100) : 0;
  const running = job?.status === 'queued' || job?.status === 'running';

  return (
    <>
      <PageHeader title="Bulk validation" sub="Drop a file or paste numbers — processed in the background"
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
          <div style={{ marginTop: 14 }}>
            <label>Priority</label>
            <Segmented value={priority} onChange={setPriority}
              options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} />
          </div>
          <div style={{ marginTop: 14 }}>
            <label>Numbers detected</label>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{numbers.length.toLocaleString()}</div>
          </div>
          <button className="btn primary" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
            disabled={busy || !numbers.length} onClick={run}>
            {busy ? 'Processing…' : service === 'detection' ? 'Run detection' : `Run validation · ${service}`}
          </button>
          {err && <div className="pill bad" style={{ marginTop: 12 }}>{err}</div>}
        </Card>
      </div>

      {job && (
        <Card
          title={isDet ? `Number detection · ${job.service}` : `Validation results · ${job.service}`}
          action={
            <span className={`pill ${job.status === 'completed' ? 'ok' : job.status === 'failed' ? 'bad' : 'run'}`}>
              {job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'processing'}
              {queueMode && job.status !== 'completed' ? ` · ${queueMode} queue` : ''}
            </span>
          }>
          {running && (
            <div style={{ marginBottom: 16 }}>
              <div className="between" style={{ marginBottom: 6, fontSize: 13 }}>
                <span className="muted">Processing {job.processed.toLocaleString()} / {job.total_records.toLocaleString()}</span>
                <span style={{ fontWeight: 600 }}>{pct}%</span>
              </div>
              <div className="bar-track" style={{ height: 9 }}><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
            </div>
          )}
          {job.status === 'failed' && <div className="pill bad">{job.error ?? 'job failed'}</div>}

          <div className="grid cols-4" style={{ marginBottom: job.sample?.length ? 16 : 0 }}>
            <Metric label={isDet ? 'Registered' : 'Valid'} value={job.valid_count} tone="ok" />
            <Metric label={isDet ? 'Unregistered' : 'Invalid'} value={job.invalid_count} tone="bad" />
            <Metric label={isDet ? 'Unknown' : 'Duplicates'} value={job.dup_count} tone="warn" />
            <Metric label="Total" value={job.total_records} />
          </div>

          {job.sample && job.sample.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  {isDet
                    ? <tr><th>Input</th><th>E.164</th><th>Country</th><th>Carrier</th><th>Registration</th></tr>
                    : <tr><th>Input</th><th>E.164</th><th>Country</th><th>Type</th><th>Status</th></tr>}
                </thead>
                <tbody className="mono">
                  {job.sample.map((r, i) => (
                    <tr key={i}>
                      <td>{r.raw}</td><td>{r.e164 ?? '—'}</td><td>{r.iso2 ?? '?'}</td>
                      {isDet ? <>
                        <td>{r.carrier ?? '—'}</td>
                        <td><Badge tone={r.registration === 'registered' ? 'ok' : r.registration === 'unregistered' ? 'bad' : 'warn'}>{r.registration}</Badge></td>
                      </> : <>
                        <td>{r.numberType ?? '—'}</td>
                        <td><Badge tone={r.status === 'valid' ? 'ok' : r.status === 'duplicate' ? 'warn' : 'bad'}>{r.status}</Badge></td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {job.status === 'completed' && <p className="hint" style={{ marginBottom: 0, marginTop: 10 }}>Showing first {job.sample.length} of {job.total_records.toLocaleString()} · {job.credits_used} credits used</p>}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
