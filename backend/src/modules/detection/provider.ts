// Number Detection service — checks whether a number is registered on a network/
// service via a CUSTOM THIRD-PARTY provider. Returns: registered | unregistered | unknown.
//
// The provider is pluggable behind the DetectionProvider interface:
//   • HttpDetectionProvider  — calls your real third-party HTTP API (set env vars).
//   • MockDetectionProvider  — deterministic offline fallback so the demo runs.
// Selection is automatic: if DETECTION_API_URL is set, the HTTP provider is used.

export type Registration = 'registered' | 'unregistered' | 'unknown';

export interface DetectionResult {
  e164: string | null;
  registration: Registration;
  carrier: string | null;
  provider: string;
  checkedAt: string;
  reason?: string;
  raw?: unknown;
}

export interface DetectionProvider {
  readonly name: string;
  detect(e164: string): Promise<DetectionResult>;
}

// ---- Custom third-party HTTP adapter -------------------------------------
// Configure via env:
//   DETECTION_API_URL    e.g. https://api.your-provider.com/v1/lookup
//   DETECTION_API_KEY    sent as Authorization: Bearer <key>
//   DETECTION_API_FIELD  JSON field in the response holding the status (default: "status")
// Map your provider's status strings to our enum in mapRegistration().
export class HttpDetectionProvider implements DetectionProvider {
  readonly name = 'http-custom';
  constructor(
    private url: string,
    private apiKey?: string,
    private statusField = process.env.DETECTION_API_FIELD ?? 'status',
  ) {}

  async detect(e164: string): Promise<DetectionResult> {
    const checkedAt = new Date().toISOString();
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ number: e164 }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return { e164, registration: 'unknown', carrier: null, provider: this.name, checkedAt, reason: `provider_http_${res.status}` };
      }
      const data: any = await res.json();
      return {
        e164,
        registration: mapRegistration(data?.[this.statusField]),
        carrier: data?.carrier ?? data?.operator ?? null,
        provider: this.name,
        checkedAt,
        raw: data,
      };
    } catch (e) {
      return { e164, registration: 'unknown', carrier: null, provider: this.name, checkedAt, reason: 'provider_unreachable' };
    }
  }
}

// Normalize arbitrary third-party status values to our 3-state enum.
export function mapRegistration(value: unknown): Registration {
  const s = String(value ?? '').toLowerCase();
  if (['registered', 'active', 'valid', 'live', 'in_service', 'connected', 'true'].includes(s)) return 'registered';
  if (['unregistered', 'inactive', 'invalid', 'disconnected', 'not_in_service', 'unallocated', 'false'].includes(s)) return 'unregistered';
  return 'unknown';
}

// ---- Offline deterministic mock -----------------------------------------
export class MockDetectionProvider implements DetectionProvider {
  readonly name = 'mock';
  private carriers = ['Airtel', 'Jio', 'Vodafone', 'Verizon', 'AT&T', 'O2'];

  async detect(e164: string): Promise<DetectionResult> {
    const digits = e164.replace(/\D/g, '');
    const last = Number(digits.slice(-1)) || 0;
    // Stable mapping: 0-5 registered, 6-8 unregistered, 9 unknown.
    const registration: Registration = last <= 5 ? 'registered' : last <= 8 ? 'unregistered' : 'unknown';
    return {
      e164,
      registration,
      carrier: registration === 'registered' ? this.carriers[last % this.carriers.length] : null,
      provider: this.name,
      checkedAt: new Date().toISOString(),
    };
  }
}

// ---- Apify adapter -------------------------------------------------------
// Runs an Apify Actor synchronously and reads the first dataset item.
// Works with phone-checker actors (WhatsApp/Telegram registration, HLR, etc.).
//   actorId      e.g. "your-username~whatsapp-number-checker"
//   token        Apify API token
//   inputField   the actor's input array field (default "phoneNumbers")
//   resultField  dataset item field holding the status (default "status")
export class ApifyDetectionProvider implements DetectionProvider {
  readonly name = 'apify';
  constructor(
    private actorId: string,
    private token: string,
    private inputField = 'phoneNumbers',
    private resultField = 'status',
  ) {}

  async detect(e164: string): Promise<DetectionResult> {
    const checkedAt = new Date().toISOString();
    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(this.actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(this.token)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [this.inputField]: [e164] }),
        signal: AbortSignal.timeout(60000), // actor runs can be slow
      });
      if (!res.ok) {
        return { e164, registration: 'unknown', carrier: null, provider: this.name, checkedAt, reason: `apify_http_${res.status}` };
      }
      const items: any[] = await res.json();
      const item = Array.isArray(items) ? items[0] : items;
      if (!item) {
        return { e164, registration: 'unknown', carrier: null, provider: this.name, checkedAt, reason: 'apify_no_result' };
      }
      // Accept either an explicit status field or a boolean isRegistered/exists flag.
      const statusValue = item[this.resultField] ?? item.isRegistered ?? item.exists ?? item.registered;
      return {
        e164,
        registration: mapRegistration(statusValue),
        carrier: item.carrier ?? item.operator ?? null,
        provider: this.name,
        checkedAt,
        raw: item,
      };
    } catch {
      return { e164, registration: 'unknown', carrier: null, provider: this.name, checkedAt, reason: 'apify_unreachable' };
    }
  }
}

// Provider configuration (persisted in the registry / DB).
export type ProviderType = 'mock' | 'http' | 'apify';
export interface ProviderSettings {
  url?: string;
  apiKey?: string;
  statusField?: string;
  actorId?: string;
  token?: string;
  inputField?: string;
  resultField?: string;
}

// Construct a live provider instance from a stored config.
export function buildProvider(type: ProviderType, s: ProviderSettings): DetectionProvider {
  switch (type) {
    case 'http':
      return new HttpDetectionProvider(s.url ?? '', s.apiKey, s.statusField);
    case 'apify':
      return new ApifyDetectionProvider(s.actorId ?? '', s.token ?? '', s.inputField, s.resultField);
    case 'mock':
    default:
      return new MockDetectionProvider();
  }
}

// Batch with bounded concurrency (third-party calls are I/O bound + rate-limited).
export async function detectMany(
  provider: DetectionProvider,
  e164s: (string | null)[],
  concurrency = 10,
): Promise<DetectionResult[]> {
  const out: DetectionResult[] = new Array(e164s.length);
  let cursor = 0;
  async function worker() {
    while (cursor < e164s.length) {
      const i = cursor++;
      const num = e164s[i];
      out[i] = num
        ? await provider.detect(num)
        : { e164: null, registration: 'unknown', carrier: null, provider: provider.name, checkedAt: new Date().toISOString(), reason: 'invalid_number' };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, e164s.length || 1) }, worker));
  return out;
}
