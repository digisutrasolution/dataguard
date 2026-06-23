import { useEffect, useState } from 'react';
import { api, type ProviderConfig, type ProviderType } from '../lib/api';

// Which settings fields each provider type exposes (secrets flagged).
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

  async function save() {
    setBusy(true);
    try { await api.providers.update(p.id, { settings: draft }); onChange(); } finally { setBusy(false); }
  }
  async function activate() { setBusy(true); try { await api.providers.activate(p.id); onChange(); } finally { setBusy(false); } }
  async function toggle() { setBusy(true); try { await api.providers.update(p.id, { enabled: !p.enabled }); onChange(); } finally { setBusy(false); } }
  async function remove() { setBusy(true); try { await api.providers.remove(p.id); onChange(); } catch { alert("Can't remove the active or mock provider"); } finally { setBusy(false); } }

  return (
    <div className="card" style={{ borderColor: p.isActive ? 'var(--brand)' : 'var(--border)', borderWidth: p.isActive ? 2 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 500 }}>
            {p.name} <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', marginLeft: 6 }}>{p.type}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
            {p.isActive ? <span className="pill ok">● active</span> : p.enabled ? <span className="pill run">enabled</span> : <span className="pill warn">disabled</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!p.isActive && <button className="btn primary" disabled={busy} onClick={activate}>Set active</button>}
          {p.type !== 'mock' && <button className="btn" disabled={busy} onClick={toggle}>{p.enabled ? 'Disable' : 'Enable'}</button>}
          {FIELDS[p.type].length > 0 && <button className="btn" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Configure'}</button>}
          {p.type !== 'mock' && !p.isActive && <button className="btn" disabled={busy} onClick={remove}>✕</button>}
        </div>
      </div>
      {open && FIELDS[p.type].length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {FIELDS[p.type].map((f) => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <label>{f.label}</label>
              <input
                type={f.secret ? 'password' : 'text'}
                placeholder={f.secret ? '(stored — leave masked to keep)' : ''}
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            </div>
          ))}
          <button className="btn primary" disabled={busy} onClick={save}>Save settings</button>
        </div>
      )}
    </div>
  );
}

export default function Providers() {
  const [list, setList] = useState<ProviderConfig[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<ProviderType>('apify');

  const load = () => api.providers.list().then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    await api.providers.add(name.trim(), type, {});
    setName('');
    load();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="h1">Detection providers</h1>
          <div className="sub">Manage third-party number-detection providers · one active at a time</div>
        </div>
      </div>

      <div className="grid" style={{ gap: 12, marginBottom: 18 }}>
        {list.map((p) => <ProviderCard key={p.id} p={p} onChange={load} />)}
      </div>

      <div className="card">
        <h3>Add provider</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apify Telegram checker" />
          </div>
          <div style={{ width: 160 }}>
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ProviderType)}>
              <option value="apify">apify</option>
              <option value="http">http</option>
              <option value="mock">mock</option>
            </select>
          </div>
          <button className="btn primary" onClick={add}>Add</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10 }}>
          After adding, click <b>Configure</b> to enter the actor ID / token, then <b>Set active</b>.
        </div>
      </div>
    </>
  );
}
