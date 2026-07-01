import { useEffect, useState } from 'react';
import { api, type TeamMember, type AuditRow } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader, Card, Badge } from '../components/ui';

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({ email: '', password: '', role: 'customer_member' });
  const [err, setErr] = useState<string | null>(null);
  const [activity, setActivity] = useState<{ id: string; email: string; rows: AuditRow[] } | null>(null);

  const isCustomer = !!user?.customerId;
  const load = () => api.team.list().then(setMembers).catch(() => {});
  useEffect(() => { if (isCustomer) load(); }, [isCustomer]);

  async function add() {
    if (!form.email.trim() || form.password.length < 6) { setErr('Enter an email and a password of 6+ characters.'); return; }
    setErr(null);
    try { await api.team.create(form.email.trim(), form.password, form.role); setForm({ email: '', password: '', role: 'customer_member' }); load(); }
    catch (e) { setErr(String(e).includes('email_taken') ? 'That email is already in use.' : 'Could not create member.'); }
  }
  async function setRole(m: TeamMember, role: string) { await api.team.update(m.id, { role }); load(); }
  async function toggle(m: TeamMember) { await api.team.update(m.id, { isActive: !m.isActive }); load(); }
  async function showActivity(m: TeamMember) { const rows = await api.team.activity(m.id); setActivity({ id: m.id, email: m.email, rows }); }

  if (!isCustomer) {
    return (
      <>
        <PageHeader title="Team" sub="Manage users under your account" />
        <Card><p className="hint" style={{ margin: 0 }}>Team management is for customer accounts. Sign in as a customer owner (e.g. owner@acme.com / owner123) to add and manage team members.</p></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Team" sub={`${members.length} members · role-based access`} />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', marginBottom: 14 }}>
        <Card title="Members" pad={false} className="card-pad-0">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Email</th><th>Role</th><th>2FA</th><th>Last login</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {members.map((m) => {
                  const self = m.id === user?.id;
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500 }}>{m.email}{self && <span className="hint"> (you)</span>}</td>
                      <td>
                        <select value={m.role} disabled={self} onChange={(e) => setRole(m, e.target.value)} style={{ width: 150, padding: '5px 8px' }}>
                          <option value="customer_owner">owner</option>
                          <option value="customer_member">member</option>
                        </select>
                      </td>
                      <td>{m.twofaEnabled ? <Badge tone="ok">on</Badge> : <span className="hint">off</span>}</td>
                      <td className="muted">{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : 'never'}</td>
                      <td>{m.isActive ? <Badge tone="ok">active</Badge> : <Badge tone="bad">disabled</Badge>}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn sm" onClick={() => showActivity(m)}>Activity</button>
                        {!self && <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => toggle(m)}>{m.isActive ? 'Disable' : 'Enable'}</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Add member">
          <label htmlFor="em">Email</label>
          <input id="em" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="agent@company.com" autoComplete="off" />
          <div style={{ marginTop: 12 }}>
            <label htmlFor="pw">Temporary password</label>
            <input id="pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 characters" autoComplete="new-password" />
          </div>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="ro">Role</label>
            <select id="ro" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="customer_member">member — run validations, view reports</option>
              <option value="customer_owner">owner — full access incl. team & billing</option>
            </select>
          </div>
          <button className="btn primary" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} onClick={add}>Add member</button>
          {err && <div className="pill bad" style={{ marginTop: 12 }}>{err}</div>}
        </Card>
      </div>

      {activity && (
        <Card title={`Activity · ${activity.email}`} action={<button className="btn ghost sm icon-btn" onClick={() => setActivity(null)} aria-label="Close"><i className="ti ti-x" aria-hidden="true" /></button>} pad={false} className="card-pad-0">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Action</th><th>Target</th><th>IP</th></tr></thead>
              <tbody>
                {activity.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td><Badge tone={r.action.includes('failed') ? 'bad' : 'run'}>{r.action}</Badge></td>
                    <td className="muted">{r.target ?? '—'}</td>
                    <td className="mono hint">{r.ip ?? '—'}</td>
                  </tr>
                ))}
                {activity.rows.length === 0 && <tr><td colSpan={4} className="hint" style={{ textAlign: 'center', padding: 24 }}>No activity recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
