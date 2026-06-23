import { useEffect, useMemo, useState } from 'react';
import { api, type CustomerRow } from '../lib/api';
import { PageHeader, Card } from '../components/ui';

const fmt = (n: number) => n.toLocaleString();

export default function Customers() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => { api.admin.customers().then(setRows).catch((e) => setErr(String(e))); }, []);

  const filtered = useMemo(
    () => rows.filter((c) => c.company.toLowerCase().includes(query.toLowerCase())),
    [rows, query]);

  return (
    <>
      <PageHeader title="Customers" sub={rows.length ? `${rows.length} accounts` : 'Loading…'}
        actions={
          <div className="search">
            <i className="ti ti-search" aria-hidden="true" />
            <input placeholder="Search customers…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customers" />
          </div>
        } />
      {err && <div className="pill bad" style={{ marginBottom: 16 }}>{err} — sign in as admin</div>}
      <Card pad={false} className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Company</th><th>Balance</th><th>Numbers validated</th><th>Credits spent</th><th>Jobs</th><th>Last activity</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="row">
                      <span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{c.company[0]}</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{c.company}</div>
                        <div className="mono hint">{c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{fmt(c.balance)}</td>
                  <td>{fmt(c.numbers)}</td>
                  <td>{fmt(c.spent)}</td>
                  <td>{c.jobs}</td>
                  <td className="muted">{c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && rows.length > 0 && (
                <tr><td colSpan={6} className="hint" style={{ textAlign: 'center', padding: 24 }}>No customers match “{query}”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
