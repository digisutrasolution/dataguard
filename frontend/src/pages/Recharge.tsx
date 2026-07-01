import { useEffect, useRef, useState } from 'react';
import { api, type Coin, type Payment, type Invoice } from '../lib/api';
import { PageHeader, Card, Segmented, Badge, ExportButtons } from '../components/ui';

const COINS: { value: Coin; label: string }[] = [
  { value: 'USDT', label: 'USDT' }, { value: 'BTC', label: 'BTC' },
  { value: 'ETH', label: 'ETH' }, { value: 'TRX', label: 'TRX' },
];
const PRESETS = [50000, 100000, 500000, 1000000];
const statusTone = (s: Payment['status']) =>
  s === 'completed' ? 'ok' : s === 'failed' || s === 'expired' ? 'bad' : 'run';

export default function Recharge() {
  const [coin, setCoin] = useState<Coin>('USDT');
  const [credits, setCredits] = useState(100000);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<Payment | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = () => { api.payments.list().then(setHistory).catch(() => {}); api.invoices.list().then(setInvoices).catch(() => {}); };
  const stop = () => { if (poll.current) { clearInterval(poll.current); poll.current = null; } };
  useEffect(() => { loadHistory(); return stop; }, []);

  async function create() {
    setBusy(true); setErr(null); setPay(null); stop();
    try {
      const p = await api.payments.create(coin, credits);
      setPay(p);
      poll.current = setInterval(async () => {
        const cur = await api.payments.get(p.id).catch(() => null);
        if (!cur) return;
        setPay(cur);
        if (cur.status === 'completed' || cur.status === 'failed' || cur.status === 'expired') {
          stop(); setBusy(false); loadHistory();
        }
      }, 1200);
    } catch (e) { setErr(String(e)); setBusy(false); }
  }

  function copy() {
    if (pay) { navigator.clipboard?.writeText(pay.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  }

  const pct = pay ? Math.round((pay.confirmations / pay.required_confirmations) * 100) : 0;
  const done = pay?.status === 'completed';

  return (
    <>
      <PageHeader title="Recharge wallet" sub="Add prepaid credits with cryptocurrency" />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', marginBottom: 14 }}>
        <Card title="Buy credits">
          <label>Pay with</label>
          <Segmented value={coin} onChange={setCoin} options={COINS} />
          <div style={{ marginTop: 16 }}>
            <label htmlFor="credits">Credits</label>
            <input id="credits" type="number" min={1000} step={1000} value={credits}
              onChange={(e) => setCredits(Math.max(0, Number(e.target.value)))} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {PRESETS.map((v) => (
              <button key={v} className={`btn sm ${credits === v ? 'primary' : ''}`} onClick={() => setCredits(v)}>
                {v.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="between" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <span className="muted">You pay</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>${(credits * 0.0025).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <button className="btn primary" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}
            disabled={busy || credits < 1000} onClick={create}>
            {busy ? 'Awaiting payment…' : 'Generate payment address'}
          </button>
          {err && <div className="pill bad" style={{ marginTop: 12 }}>{err}</div>}
        </Card>

        <Card title="Payment" action={pay && <Badge tone={statusTone(pay.status)}>{pay.status}</Badge>}>
          {!pay && <p className="hint">Choose an amount and generate a payment address to continue.</p>}
          {pay && !done && (
            <>
              <div style={{ display: 'flex', gap: 16 }}>
                <div aria-hidden="true" style={{ width: 96, height: 96, flexShrink: 0, background: 'repeating-conic-gradient(var(--text) 0 25%, transparent 0 50%) 50%/14px 14px', borderRadius: 8, opacity: .85 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="hint">Send exactly</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{pay.amount} {pay.coin}</div>
                  <div className="hint" style={{ marginTop: 6 }}>to this {pay.coin} address</div>
                  <div className="between" style={{ gap: 8 }}>
                    <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pay.address}</span>
                    <button className="btn sm icon-btn" onClick={copy} aria-label="Copy address"><i className={`ti ti-${copied ? 'check' : 'copy'}`} aria-hidden="true" /></button>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="between" style={{ marginBottom: 6, fontSize: 13 }}>
                  <span className="muted">Confirmations {pay.confirmations}/{pay.required_confirmations}</span>
                  <span style={{ fontWeight: 600 }}>{pct}%</span>
                </div>
                <div className="bar-track" style={{ height: 9 }}><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                  <i className="ti ti-clock" aria-hidden="true" /> Waiting for blockchain confirmations — wallet credits automatically.
                </p>
              </div>
            </>
          )}
          {done && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div className="stat-ic" style={{ background: 'var(--success-bg)', color: 'var(--success)', width: 48, height: 48, margin: '0 auto 10px', fontSize: 26 }}><i className="ti ti-circle-check" aria-hidden="true" /></div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Payment confirmed</div>
              <p className="hint" style={{ marginTop: 4 }}>{pay.credits.toLocaleString()} credits added to your wallet.</p>
            </div>
          )}
        </Card>
      </div>

      <Card title="Payment history" pad={false} className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Coin</th><th>Amount</th><th>Credits</th><th>Confirmations</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>{p.coin}</td>
                  <td className="mono">{p.amount} {p.coin}</td>
                  <td>{p.credits.toLocaleString()}</td>
                  <td className="muted">{p.confirmations}/{p.required_confirmations}</td>
                  <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6} className="hint" style={{ textAlign: 'center', padding: 24 }}>No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 14 }} />
      <Card title="Invoices" action={<ExportButtons path="/export/invoices" name="invoices" />} pad={false} className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Credits</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="mono">{inv.number}</td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td>${inv.amount_usd.toFixed(2)}</td>
                  <td>{inv.credits.toLocaleString()}</td>
                  <td><Badge tone="ok">{inv.status}</Badge></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn sm" onClick={() => api.invoices.download(inv.id, inv.number)}>
                      <i className="ti ti-download" aria-hidden="true" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={6} className="hint" style={{ textAlign: 'center', padding: 24 }}>No invoices yet — complete a recharge to generate one.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
