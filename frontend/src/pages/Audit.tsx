import { useEffect, useState } from 'react';
import { api, type AuditRow } from '../lib/api';
import { PageHeader, Card, Badge, ExportButtons } from '../components/ui';

const tone = (action: string): 'ok' | 'bad' | 'warn' | 'run' | 'muted' => {
  if (action.includes('failed') || action.includes('delete')) return 'bad';
  if (action.includes('login') || action.includes('register')) return 'run';
  if (action.includes('2fa') || action.includes('recharge')) return 'ok';
  if (action.includes('provider') || action.includes('update') || action.includes('pricing')) return 'warn';
  return 'muted';
};

export default function Audit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.admin.audit(100).then(setRows).catch((e) => setErr(String(e))); }, []);

  return (
    <>
      <PageHeader title="Activity &amp; audit log" sub={rows.length ? `${rows.length} recent events` : 'Loading…'}
        actions={<ExportButtons path="/admin/export/audit" name="audit-log" />} />
      {err && <div className="pill bad" style={{ marginBottom: 16 }}>{err} — sign in as admin</div>}
      <Card pad={false} className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th><th>Device</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.actor ?? '—'}</td>
                  <td><Badge tone={tone(r.action)}>{r.action}</Badge></td>
                  <td className="muted">{r.target ?? '—'}</td>
                  <td className="mono hint">{r.ip ?? '—'}</td>
                  <td className="hint" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.device ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
