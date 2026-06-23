// Detection provider registry — admin-managed list, one active.
// Postgres (detection_providers table) when active, in-memory otherwise.
import {
  buildProvider,
  type DetectionProvider,
  type ProviderType,
  type ProviderSettings,
} from './provider.js';
import { dbActive, q } from '../../db/pool.js';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  isActive: boolean;
  settings: ProviderSettings;
}

const SECRET_KEYS: (keyof ProviderSettings)[] = ['apiKey', 'token'];

// ---- in-memory fallback ----
let mem: ProviderConfig[] = [
  { id: 'mock', name: 'Built-in mock (offline)', type: 'mock', enabled: true, isActive: true, settings: {} },
  { id: 'apify', name: 'Apify actor', type: 'apify', enabled: false, isActive: false,
    settings: { actorId: 'your-username~whatsapp-number-checker', token: '', inputField: 'phoneNumbers', resultField: 'status' } },
  { id: 'http-custom', name: 'Custom HTTP API', type: 'http', enabled: false, isActive: false,
    settings: { url: '', apiKey: '', statusField: 'status' } },
];

function rowToCfg(r: any): ProviderConfig {
  return { id: r.id, name: r.name, type: r.type, enabled: r.enabled, isActive: r.is_active, settings: r.settings ?? {} };
}
function maskSecret(v?: string): string {
  if (!v) return '';
  return v.length <= 4 ? '••••' : `••••${v.slice(-4)}`;
}
function toPublic(p: ProviderConfig): ProviderConfig {
  const settings = { ...p.settings };
  for (const k of SECRET_KEYS) if (settings[k]) settings[k] = maskSecret(settings[k] as string);
  return { ...p, settings };
}

async function rawList(): Promise<ProviderConfig[]> {
  if (dbActive()) {
    const { rows } = await q('SELECT * FROM detection_providers ORDER BY id');
    return rows.map(rowToCfg);
  }
  return mem;
}

export async function listProviders(): Promise<ProviderConfig[]> {
  return (await rawList()).map(toPublic);
}

export async function getActiveConfig(): Promise<ProviderConfig> {
  const all = await rawList();
  return all.find((p) => p.isActive && p.enabled) ?? all[0];
}

export async function getActiveProvider(): Promise<DetectionProvider> {
  const cfg = await getActiveConfig();
  return buildProvider(cfg.type, cfg.settings);
}

export async function addProvider(input: { name: string; type: ProviderType; settings?: ProviderSettings }): Promise<ProviderConfig> {
  const id = `${input.type}-${Date.now().toString(36)}`;
  const cfg: ProviderConfig = { id, name: input.name, type: input.type, enabled: false, isActive: false, settings: input.settings ?? {} };
  if (dbActive()) {
    await q(
      'INSERT INTO detection_providers (id,name,type,enabled,is_active,settings) VALUES ($1,$2,$3,false,false,$4)',
      [id, cfg.name, cfg.type, JSON.stringify(cfg.settings)],
    );
  } else {
    mem.push(cfg);
  }
  return toPublic(cfg);
}

export async function updateProvider(
  id: string,
  patch: Partial<Pick<ProviderConfig, 'name' | 'enabled' | 'settings'>>,
): Promise<ProviderConfig | null> {
  const all = await rawList();
  const current = all.find((x) => x.id === id);
  if (!current) return null;

  const name = patch.name ?? current.name;
  const enabled = patch.enabled ?? current.enabled;
  const settings = { ...current.settings };
  if (patch.settings) {
    for (const [k, v] of Object.entries(patch.settings)) {
      // Ignore masked secret values so we never overwrite a real secret with dots.
      if (SECRET_KEYS.includes(k as keyof ProviderSettings) && typeof v === 'string' && v.startsWith('••')) continue;
      (settings as any)[k] = v;
    }
  }

  if (dbActive()) {
    await q('UPDATE detection_providers SET name=$2, enabled=$3, settings=$4 WHERE id=$1',
      [id, name, enabled, JSON.stringify(settings)]);
  } else {
    Object.assign(current, { name, enabled, settings });
  }
  return toPublic({ ...current, name, enabled, settings });
}

// Activate one provider (exclusive) — enabled automatically.
export async function activateProvider(id: string): Promise<ProviderConfig | null> {
  const all = await rawList();
  const target = all.find((x) => x.id === id);
  if (!target) return null;
  if (dbActive()) {
    await q('UPDATE detection_providers SET is_active = (id = $1), enabled = (enabled OR id = $1)', [id]);
  } else {
    mem.forEach((p) => (p.isActive = false));
    target.isActive = true;
    target.enabled = true;
  }
  return toPublic({ ...target, isActive: true, enabled: true });
}

export async function removeProvider(id: string): Promise<boolean> {
  const all = await rawList();
  const p = all.find((x) => x.id === id);
  if (!p || p.isActive || p.type === 'mock') return false; // keep an active + mock fallback
  if (dbActive()) {
    await q('DELETE FROM detection_providers WHERE id = $1 AND is_active = false', [id]);
  } else {
    mem = mem.filter((x) => x.id !== id);
  }
  return true;
}
