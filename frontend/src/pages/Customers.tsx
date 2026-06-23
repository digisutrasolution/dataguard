import { useEffect, useState } from 'react';
import { api, type CustomerRow } from '../lib/api';

const fmt = (n: number) => n.toLocaleString();

export default function Customers() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.admin.customers().then(setRows).catch((e) => setErr(String(e))); }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="h1">Customers</h1>
          <div className="sub">{rows.length ? `${rows.length} accounts` : 'Loading…'}</div>
        </div>
      </div>
      {err && <div className="pill bad">{err} — sign in as admin</div>}
      <div className="card">
        <table>
          <thead><tr><th>Company</th><th>Balance</th><th>Numbers validated</th><th>Credits spent</th><th>Jobs</th><th>Last activity</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.company}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.id}</div>
                </td>
                <td>{fmt(c.balance)}</td>
                <td>{fmt(c.numbers)}</td>
                <td>{fmt(c.spent)}</td>
                <td>{c.jobs}</td>
                <td style={{ color: 'var(--text-2)' }}>{c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
