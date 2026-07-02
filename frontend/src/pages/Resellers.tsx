import { useEffect, useState } from 'react';
import { api, type Reseller, type ResellerCustomer, type AssignableCustomer } from '../lib/api';
import { PageHeader, Card, StatCard, money } from '../components/ui';

function ManagePanel({ r, onChange }: { r: Reseller; onChange: () => void }) {
  const [customers, setCustomers] = useState<ResellerCustomer[]>([]);
  const [all, setAll] = useState<AssignableCustomer[]>([]);
  const [pick, setPick] = useState('');
  const load = () => {
    api.admin.resellers.customers(r.id).then(setCustomers).catch(() => {});
    api.admin.resellers.allCustomers().then(setAll).catch(() => {});
  };
  useEffect(() => { load(); }, [r.id]);

  const assignable = all.filter((c) => c.reseller_id !== r.id);
  async function assign() { if (pick) { await api.admin.resellers.assign(r.id, pick); setPick(''); load(); onChange(); } }
  async function unassign(id: string) { await api.admin.resellers.unassign(id); load(); onChange(); }

  return (
    <Card title={`${r.name} · assigned customers`} action={<span className="hint">{r.commission_rate * 100}% commission</span>}>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Customer</th><th>Numbers</th><th>Credits spent</th><th>Commission</th><th></th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.company}</td>
                <td>{c.numbers.toLocaleString()}</td>
                <td>{c.spent.toLocaleString()}</td>
                <td style={{ color: 'var(--success)' }}>{money(c.commission_usd)}</td>
                <td style={{ textAlign: 'right' }}><button className="btn sm" onClick={() => unassign(c.id)}>Unassign</button></td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={5} className="hint" style={{ textAlign: 'center', padding: 20 }}>No customers assigned yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ maxWidth: 280 }}>
          <option value="">Assign a customer…</option>
          {assignable.map((c) => <option key={c.id} value={c.id}>{c.company}{c.reseller_id ? ' (reassign)' : ''}</option>)}
        </select>
        <button className="btn primary" disabled={!pick} onClick={assign}>Assign</button>
      </div>
    </Card>
  );
}

function RateInput({ r, onSaved }: { r: Reseller; onSaved: () => void }) {
  const [pct, setPct] = useState(String(Math.round(r.commission_rate * 100)));
  const dirty = Number(pct) !== Math.round(r.commission_rate * 100);
  async function save() { await api.admin.resellers.update(r.id, Math.max(0, Math.min(100, Number(pct))) / 100); onSaved(); }
  return (
    <span className="row" style={{ gap: 6 }}>
      <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="numeric" style={{ width: 64, padding: '5px 8px' }} aria-label="commission %" />%
      {dirty && <button className="btn primary sm" onClick={save}>Save</button>}
    </span>
  );
}

export default function Resellers() {
  const [list, setList] = useState<Reseller[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', rate: '20' });
  const [manage, setManage] = useState<string | null>(null);
  const load = () => api.admin.resellers.list().then(setList).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  const totalCommission = list.reduce((s, r) => s + r.commission_usd, 0);
  async function add() {
    if (!form.name.trim()) return;
    await api.admin.resellers.create(form.name.trim(), form.email.trim() || undefined, Number(form.rate) / 100);
    setForm({ name: '', email: '', rate: '20' }); load();
  }
  async function remove(id: string) { await api.admin.resellers.remove(id); if (manage === id) setManage(null); load(); }

  return (
    <>
      <PageHeader title="Resellers" sub={`${list.length} resellers · commission on assigned customers' spend`} />
      {err && <div className="pill bad" style={{ marginBottom: 16 }}>{err} — sign in as admin</div>}

      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <StatCard label="Resellers" value={String(list.length)} icon="users-group" tone="brand" />
        <StatCard label="Total commission owed" value={money(totalCommission)} icon="cash" tone="success" />
        <StatCard label="Assigned customers" value={String(list.reduce((s, r) => s + r.customers, 0))} icon="users" tone="info" />
      </div>

      <Card title="Resellers" pad={false} className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Reseller</th><th>Commission</th><th>Customers</th><th>Commission owed</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="hint">{r.email ?? '—'}</div></td>
                  <td><RateInput r={r} onSaved={load} /></td>
                  <td>{r.customers}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 500 }}>{money(r.commission_usd)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn sm" onClick={() => setManage(manage === r.id ? null : r.id)}>{manage === r.id ? 'Close' : 'Manage'}</button>
                    <button className="btn sm icon-btn" style={{ marginLeft: 6 }} onClick={() => remove(r.id)} aria-label="Delete reseller"><i className="ti ti-trash" aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="hint" style={{ textAlign: 'center', padding: 24 }}>No resellers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {manage && list.find((r) => r.id === manage) && (
        <div style={{ marginTop: 14 }}><ManagePanel r={list.find((r) => r.id === manage)!} onChange={load} /></div>
      )}

      <div style={{ height: 14 }} />
      <Card title="Add reseller">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.4fr) 120px auto', alignItems: 'end', gap: 12 }}>
          <div><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nexus Partners" /></div>
          <div><label>Email (optional)</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="partner@company.com" /></div>
          <div><label>Commission %</label><input value={form.rate} inputMode="numeric" onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
          <button className="btn primary" onClick={add}>Add reseller</button>
        </div>
      </Card>
    </>
  );
}
