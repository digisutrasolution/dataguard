import { useEffect, useState } from 'react';
import { api, type ProviderConfig, type ProviderType } from '../lib/api';
import { PageHeader, Card, Badge } from '../components/ui';

const FIELDS: Record<ProviderType, { key: string; label: string; secret?: boolean }[]> = {
  mock: [],
  apify: [
    { key: 'actorId', label: 'Actor ID (e.g. user~whatsapp-checker)' },
    { key: 'token', label: 'Apify API token', secret: true },
    { key: 'inputField', label: 'Input field (default phoneNumbers)' },
    { key: 'resultField', label: 'Result field (default status)' },
  ],
  http: [
    { key: 'url', label: 'API URL' },
    { key: 'apiKey', label: 'API key (Bearer)', secret: true },
    { key: 'statusField', label: 'Status field (default status)' },
  ],
};

function ProviderCard({ p, onChange }: { p: ProviderConfig; onChange: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(p.settings);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = (fn: () => Promise<unknown>) => async () => { setBusy(true); try { await fn(); onChange(); } finally { setBusy(false); } };

  const save = wrap(() => api.providers.update(p.id, { settings: draft }));
  const activate = wrap(() => api.providers.activate(p.id));
  const toggle = wrap(() => api.providers.update(p.id, { enabled: !p.enabled }));
  const remove = async () => { setBusy(true); try { await api.providers.remove(p.id); onChange(); } catch { alert("Can't remove the active or mock provider"); } finally { setBusy(false); } };

  return (
    <div className="card" style={p.isActive ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 1px var(--brand)' } : undefined}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div className="row">
          <span className="stat-ic" style={{ background: 'var(--brand-bg)', color: 'var(--brand)' }}>
            <i className={`ti ti-${p.type === 'apify' ? 'robot' : p.type === 'http' ? 'world' : 'cpu'}`} aria-hidden="true" />
          </span>
          <div>
            <div style={{ fontWeight: 500 }}>{p.name} <span className="pill muted" style={{ marginLeft: 4 }}>{p.type}</span></div>
            <div style={{ marginTop: 5 }}>
              {p.isActive ? <Badge tone="ok"><span className="dot" />active</Badge>
                : p.enabled ? <Badge tone="run">enabled</Badge> : <Badge tone="warn">disabled</Badge>}
            </div>
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!p.isActive && <button className="btn primary sm" disabled={busy} onClick={activate}>Set active</button>}
          {p.type !== 'mock' && <button className="btn sm" disabled={busy} onClick={toggle}>{p.enabled ? 'Disable' : 'Enable'}</button>}
          {FIELDS[p.type].length > 0 && <button className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Configure'}</button>}
          {p.type !== 'mock' && !p.isActive && <button className="btn sm icon-btn" disabled={busy} onClick={remove} aria-label="Remove provider"><i className="ti ti-trash" aria-hidden="true" /></button>}
        </div>
      </div>
      {open && FIELDS[p.type].length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          {FIELDS[p.type].map((f) => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label>{f.label}</label>
              <input type={f.secret ? 'password' : 'text'} placeholder={f.secret ? '(stored — leave masked to keep)' : ''}
                value={draft[f.key] ?? ''} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
            </div>
          ))}
          <button className="btn primary sm" disabled={busy} onClick={save}>Save settings</button>
        </div>
      )}
    </div>
  );
}

export default function Providers() {
  const [list, setList] = useState<ProviderConfig[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<ProviderType>('apify');
  const [err, setErr] = useState<string | null>(null);
  const load = () => api.providers.list().then(setList).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    await api.providers.add(name.trim(), type, {});
    setName(''); load();
  }

  return (
    <>
      <PageHeader title="Detection providers" sub="Manage third-party number-detection providers · one active at a time" />
      {err && <div className="pill bad" style={{ marginBottom: 16 }}>{err} — sign in as admin</div>}

      <div className="grid" style={{ marginBottom: 18 }}>
        {list.map((p) => <ProviderCard key={p.id} p={p} onChange={load} />)}
      </div>

      <Card title="Add provider">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 160px auto', alignItems: 'end', gap: 12 }}>
          <div>
            <label htmlFor="pname">Name</label>
            <input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apify Telegram checker" />
          </div>
          <div>
            <label htmlFor="ptype">Type</label>
            <select id="ptype" value={type} onChange={(e) => setType(e.target.value as ProviderType)}>
              <option value="apify">apify</option><option value="http">http</option><option value="mock">mock</option>
            </select>
          </div>
          <button className="btn primary" onClick={add}>Add provider</button>
        </div>
        <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
          After adding, click Configure to enter the actor ID / token, then Set active.
        </p>
      </Card>
    </>
  );
}
