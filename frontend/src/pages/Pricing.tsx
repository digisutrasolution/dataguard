import { useEffect, useState } from 'react';
import { api, type PricingRule } from '../lib/api';
import { PageHeader, Card, Badge } from '../components/ui';

function scopeLabel(r: PricingRule) {
  const parts = [];
  if (r.customer_id) parts.push(`customer ${r.customer_id.slice(0, 10)}`);
  if (r.iso2) parts.push(r.iso2);
  return parts.length ? parts.join(' · ') : 'standard';
}

function RuleRow({ r, onChange }: { r: PricingRule; onChange: () => void }) {
  const [rate, setRate] = useState(String(r.credits_per_number));
  const [busy, setBusy] = useState(false);
  const dirty = Number(rate) !== r.credits_per_number;
  const wrap = (fn: () => Promise<unknown>) => async () => { setBusy(true); try { await fn(); onChange(); } finally { setBusy(false); } };
  const save = wrap(() => api.admin.pricing.update(r.id, { creditsPerNumber: Number(rate) }));
  const toggle = wrap(() => api.admin.pricing.update(r.id, { active: !r.active }));
  const remove = wrap(() => api.admin.pricing.remove(r.id));
  return (
    <tr>
      <td style={{ textTransform: 'capitalize', fontWeight: 500 }}>{r.service}</td>
      <td className="muted">{scopeLabel(r)}</td>
      <td>{r.min_qty.toLocaleString()}+</td>
      <td>
        <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal"
          style={{ width: 110, padding: '6px 9px' }} aria-label="credits per number" />
      </td>
      <td>{r.active ? <Badge tone="ok">active</Badge> : <Badge tone="warn">off</Badge>}</td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {dirty && <button className="btn primary sm" disabled={busy} onClick={save}>Save</button>}
        <button className="btn sm" disabled={busy} onClick={toggle} style={{ marginLeft: 6 }}>{r.active ? 'Disable' : 'Enable'}</button>
        <button className="btn sm icon-btn" disabled={busy} onClick={remove} style={{ marginLeft: 6 }} aria-label="Delete rule"><i className="ti ti-trash" aria-hidden="true" /></button>
      </td>
    </tr>
  );
}

export default function Pricing() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ service: 'basic', iso2: '', customerId: '', minQty: '0', creditsPerNumber: '0.01' });
  const load = () => api.admin.pricing.list().then(setRules).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  async function add() {
    await api.admin.pricing.create({
      service: form.service,
      iso2: form.iso2.trim() || undefined,
      customerId: form.customerId.trim() || undefined,
      minQty: Number(form.minQty) || 0,
      creditsPerNumber: Number(form.creditsPerNumber),
    });
    setForm({ ...form, iso2: '', customerId: '' });
    load();
  }

  return (
    <>
      <PageHeader title="Pricing" sub={`${rules.length} rules · credits charged per number (1 credit = $0.0025)`} />
      {err && <div className="pill bad" style={{ marginBottom: 16 }}>{err} — sign in as admin</div>}

      <Card pad={false} className="card-pad-0" >
        <div className="table-wrap">
          <table>
            <thead><tr><th>Service</th><th>Scope</th><th>Tier (min qty)</th><th>Credits / number</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rules.map((r) => <RuleRow key={r.id} r={r} onChange={load} />)}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 14 }} />
      <Card title="Add pricing rule">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', alignItems: 'end', gap: 12 }}>
          <div><label>Service</label>
            <select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
              <option value="basic">basic</option><option value="advanced">advanced</option>
              <option value="premium">premium</option><option value="detection">detection</option>
            </select></div>
          <div><label>Country (opt)</label><input value={form.iso2} maxLength={2} placeholder="e.g. IN" onChange={(e) => setForm({ ...form, iso2: e.target.value.toUpperCase() })} /></div>
          <div><label>Customer (opt)</label><input value={form.customerId} placeholder="customer id" onChange={(e) => setForm({ ...form, customerId: e.target.value })} /></div>
          <div><label>Min qty (tier)</label><input value={form.minQty} inputMode="numeric" onChange={(e) => setForm({ ...form, minQty: e.target.value })} /></div>
          <div><label>Credits / number</label><input value={form.creditsPerNumber} inputMode="decimal" onChange={(e) => setForm({ ...form, creditsPerNumber: e.target.value })} /></div>
          <button className="btn primary" onClick={add}>Add rule</button>
        </div>
        <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
          Most specific match wins: customer &gt; country &gt; standard, then the highest matching tier.
        </p>
      </Card>
    </>
  );
}
