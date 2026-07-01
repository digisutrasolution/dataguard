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

// Fetch a file (with auth headers) and trigger a browser download.
export async function downloadBlob(path: string, filename: string): Promise<void> {
  const res = await fetch(base + path, { headers: headers(false) });
  if (!res.ok) throw new Error('download_failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
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

export interface JobSample {
  raw: string; e164: string | null; iso2: string | null;
  numberType?: string | null; status?: string;
  registration?: string; carrier?: string | null;
}

export interface JobDetail {
  id: string;
  job_type: 'validation' | 'detection';
  service: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total_records: number;
  processed: number;
  valid_count: number;
  invalid_count: number;
  dup_count: number;
  credits_used: number;
  sample: JobSample[] | null;
  error: string | null;
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

export interface ApiKey {
  id: string;
  label: string | null;
  key_prefix: string;
  rate_limit: number;
  is_active: boolean;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
}
export interface ApiLog { id: number; method: string; path: string; status: number; created_at: string }

export interface PricingRule {
  id: string;
  service: string;
  iso2: string | null;
  customer_id: string | null;
  min_qty: number;
  credits_per_number: number;
  active: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  payment_id: string | null;
  coin: string | null;
  amount_usd: number;
  credits: number;
  status: string;
  created_at: string;
}

export type Coin = 'USDT' | 'BTC' | 'ETH' | 'TRX';
export interface Payment {
  id: string;
  coin: Coin;
  address: string;
  amount: number;
  amount_usd: number;
  credits: number;
  confirmations: number;
  required_confirmations: number;
  status: 'pending' | 'confirming' | 'confirmed' | 'completed' | 'failed' | 'expired';
  tx_hash: string | null;
  provider: string;
  expires_at: string | null;
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
  submitJob: (numbers: string[], defaultCountry: string, service: string, priority: 'normal' | 'high' = 'normal') =>
    post<{ jobId: string; status: string; total: number; creditsUsed: number; queue: string }>('/jobs', { numbers, defaultCountry, service, priority }),
  job: (id: string) => get<JobDetail>(`/jobs/${id}`),

  payments: {
    create: (coin: Coin, credits: number) => post<Payment>('/payments', { coin, credits }),
    get: (id: string) => get<Payment>(`/payments/${id}`),
    list: () => get<Payment[]>('/payments'),
  },

  admin: {
    stats: () => get<AdminStats>('/admin/stats'),
    customers: () => get<CustomerRow[]>('/admin/customers'),
    audit: (limit = 50) => get<AuditRow[]>(`/admin/audit?limit=${limit}`),
    pricing: {
      list: () => get<PricingRule[]>('/admin/pricing'),
      create: (body: { service: string; iso2?: string; customerId?: string; minQty?: number; creditsPerNumber: number }) =>
        post<PricingRule>('/admin/pricing', body),
      update: (id: string, body: { creditsPerNumber?: number; minQty?: number; active?: boolean }) =>
        patch<PricingRule>(`/admin/pricing/${id}`, body),
      remove: (id: string) => del<{ ok: boolean }>(`/admin/pricing/${id}`),
    },
  },

  apiKeys: {
    list: () => get<ApiKey[]>('/keys'),
    create: (label: string, rateLimit: number) => post<ApiKey & { key: string }>('/keys', { label, rateLimit }),
    revoke: (id: string) => del<{ ok: boolean }>(`/keys/${id}`),
    logs: () => get<ApiLog[]>('/logs'),
  },

  invoices: {
    list: () => get<Invoice[]>('/invoices'),
    download: (id: string, number: string) => downloadBlob(`/invoices/${id}/pdf`, `${number}.pdf`),
  },

  // Report exports: path is the /export/... route, format appended.
  exportReport: (path: string, name: string, format: 'csv' | 'xlsx' | 'pdf') =>
    downloadBlob(`${path}?format=${format}`, `${name}.${format}`),

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
