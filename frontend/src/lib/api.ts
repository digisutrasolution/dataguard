const API_KEY = 'demo-key';
const base = '/api';

let authToken: string | null = localStorage.getItem('dg_token');
export function setAuthToken(t: string | null) {
  authToken = t;
  if (t) localStorage.setItem('dg_token', t);
  else localStorage.removeItem('dg_token');
}

// Every request carries the API key (for data routes) and, when present, the
// JWT (for portal/admin routes). Each route picks the one it needs.
function headers(json = true): Record<string, string> {
  const h: Record<string, string> = { 'x-api-key': API_KEY };
  if (json) h['content-type'] = 'application/json';
  if (authToken) h['authorization'] = `Bearer ${authToken}`;
  return h;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(base + path, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(base + path, { headers: headers(false) });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(base + path, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(base + path, { method: 'DELETE', headers: headers(false) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

export interface ValidationResult {
  raw: string;
  e164: string | null;
  national: string | null;
  international: string | null;
  iso2: string | null;
  numberType: string | null;
  status: 'valid' | 'invalid' | 'duplicate';
  reason?: string;
}

export interface BulkResponse {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  results: ValidationResult[];
  creditsUsed: number;
  balance: number;
}

export type Registration = 'registered' | 'unregistered' | 'unknown';

export interface DetectRow {
  raw: string;
  e164: string | null;
  iso2: string | null;
  registration: Registration;
  carrier: string | null;
}

export interface DetectResponse {
  total: number;
  registered: number;
  unregistered: number;
  unknown: number;
  provider: string;
  results: DetectRow[];
  creditsUsed: number;
  balance: number;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  customerId: string | null;
  twofaEnabled: boolean;
}

export interface AdminStats {
  customers: number;
  activeUsers: number;
  creditsSold: number;
  revenueUsd: number;
  numbersValidated: number;
  jobs: number;
  successRate: number;
  dailyUsage: { d: string; n: number }[];
  monthlyRevenue: { m: string; usd: number }[];
  topCountries: { country: string; n: number }[];
  servicePerformance: { service: string; jobs: number; n: number }[];
}

export interface CustomerRow {
  id: string;
  company: string;
  balance: number;
  numbers: number;
  spent: number;
  jobs: number;
  lastActivity: string | null;
}

export interface MyStats {
  numbersThisMonth: number;
  successRate: number;
  creditsSpent: number;
  jobs: number;
}

export interface JobRow {
  id: string;
  service: string;
  total_records: number | string;
  valid_count: number | string;
  invalid_count: number | string;
  dup_count: number | string;
  status: string;
  created_at: string;
  country?: string;
}

export interface AuditRow {
  id: number;
  actor: string | null;
  customer_id: string | null;
  action: string;
  target: string | null;
  ip: string | null;
  device: string | null;
  created_at: string;
}

export type ProviderType = 'mock' | 'http' | 'apify';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  isActive: boolean;
  settings: Record<string, string>;
}

export const api = {
  validate: (number: string, defaultCountry?: string) =>
    post<ValidationResult>('/validate', { number, defaultCountry }),
  bulk: (numbers: string[], defaultCountry: string, service: string) =>
    post<BulkResponse>('/bulk-validation', { numbers, defaultCountry, service }),
  detect: (numbers: string[], defaultCountry: string) =>
    post<DetectResponse>('/detect-bulk', { numbers, defaultCountry }),
  generate: (country: string, quantity: number, format: string) =>
    post<{ count: number; numbers: string[] }>('/generate', { country, quantity, format }),
  balance: () => get<{ customerId: string; balance: number }>('/balance'),
  history: () => get<JobRow[]>('/history'),
  myStats: () => get<MyStats>('/my/stats'),

  admin: {
    stats: () => get<AdminStats>('/admin/stats'),
    customers: () => get<CustomerRow[]>('/admin/customers'),
    audit: (limit = 50) => get<AuditRow[]>(`/admin/audit?limit=${limit}`),
  },

  auth: {
    login: (email: string, password: string, totp?: string) =>
      post<{ token?: string; user?: AuthUser; error?: string }>('/auth/login', { email, password, totp }),
    register: (email: string, password: string) =>
      post<{ token: string; user: AuthUser }>('/auth/register', { email, password }),
    me: () => get<AuthUser>('/auth/me'),
    setup2fa: () => post<{ secret: string; otpauth: string }>('/auth/2fa/setup', {}),
    enable2fa: (totp: string) => post<{ enabled: boolean }>('/auth/2fa/enable', { totp }),
    disable2fa: () => post<{ enabled: boolean }>('/auth/2fa/disable', {}),
  },

  providers: {
    list: () => get<ProviderConfig[]>('/admin/detection-providers'),
    add: (name: string, type: ProviderType, settings: Record<string, string>) =>
      post<ProviderConfig>('/admin/detection-providers', { name, type, settings }),
    update: (id: string, patchBody: { name?: string; enabled?: boolean; settings?: Record<string, string> }) =>
      patch<ProviderConfig>(`/admin/detection-providers/${id}`, patchBody),
    activate: (id: string) => post<ProviderConfig>(`/admin/detection-providers/${id}/activate`, {}),
    remove: (id: string) => del<{ ok: boolean }>(`/admin/detection-providers/${id}`),
  },
};
