// Core phone validation + generation engine.
// Wraps libphonenumber-js and adds the service-tier checks DataGuard exposes.
import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  AsYouType,
  type CountryCode,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import { getExampleNumber } from 'libphonenumber-js';

export type ValidationStatus = 'valid' | 'invalid' | 'duplicate';

export interface ValidationResult {
  raw: string;
  e164: string | null;
  national: string | null;
  international: string | null;
  iso2: string | null;
  countryCallingCode: string | null;
  numberType: string | null; // MOBILE | FIXED_LINE | ...
  status: ValidationStatus;
  reason?: string;
}

export interface ValidateOptions {
  defaultCountry?: CountryCode; // e.g. 'IN' applied when input has no '+'
  removeDuplicates?: boolean;
}

// Validate a single number. The seen-set lets bulk callers flag duplicates.
export function validateOne(
  raw: string,
  opts: ValidateOptions = {},
  seen?: Set<string>,
): ValidationResult {
  const cleaned = raw.trim();
  const base: ValidationResult = {
    raw: cleaned,
    e164: null,
    national: null,
    international: null,
    iso2: null,
    countryCallingCode: null,
    numberType: null,
    status: 'invalid',
  };

  if (!cleaned) return { ...base, reason: 'empty' };

  const phone = parsePhoneNumberFromString(cleaned, opts.defaultCountry);
  if (!phone) return { ...base, reason: 'unparseable' };
  if (!phone.isValid()) {
    return {
      ...base,
      iso2: phone.country ?? null,
      countryCallingCode: phone.countryCallingCode ?? null,
      reason: 'failed_format_or_length',
    };
  }

  const e164 = phone.number;
  if (opts.removeDuplicates && seen) {
    if (seen.has(e164)) {
      return {
        ...base,
        e164,
        iso2: phone.country ?? null,
        status: 'duplicate',
        reason: 'duplicate',
      };
    }
    seen.add(e164);
  }

  return {
    raw: cleaned,
    e164,
    national: phone.formatNational(),
    international: phone.formatInternational(),
    iso2: phone.country ?? null,
    countryCallingCode: phone.countryCallingCode ?? null,
    numberType: phone.getType() ?? 'UNKNOWN',
    status: 'valid',
  };
}

export interface BulkSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  results: ValidationResult[];
}

export function validateBulk(
  inputs: string[],
  opts: ValidateOptions = {},
): BulkSummary {
  const seen = new Set<string>();
  const results = inputs.map((n) => validateOne(n, opts, seen));
  return {
    total: results.length,
    valid: results.filter((r) => r.status === 'valid').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    duplicate: results.filter((r) => r.status === 'duplicate').length,
    results,
  };
}

export type OutFormat = 'e164' | 'national' | 'international';

// Generate plausible numbers for a country by perturbing the example number.
export function generate(
  iso2: CountryCode,
  quantity: number,
  format: OutFormat = 'e164',
): string[] {
  const out: string[] = [];
  const example = getExampleNumber(iso2, examples);
  if (!example) return out;

  const cc = getCountryCallingCode(iso2);
  const nsn = example.nationalNumber; // national significant number
  const len = nsn.length;
  const prefixLen = Math.min(3, len - 4 > 0 ? len - 4 : 1);
  const fixed = nsn.slice(0, prefixLen);

  const cap = Math.min(quantity, 100000);
  const made = new Set<string>();
  let guard = 0;
  while (made.size < cap && guard < cap * 5) {
    guard++;
    let tail = '';
    for (let i = 0; i < len - prefixLen; i++) {
      tail += Math.floor(Math.random() * 10).toString();
    }
    const candidate = `+${cc}${fixed}${tail}`;
    const phone = parsePhoneNumberFromString(candidate);
    if (phone && phone.isValid() && !made.has(phone.number)) {
      made.add(phone.number);
      if (format === 'national') out.push(phone.formatNational());
      else if (format === 'international') out.push(phone.formatInternational());
      else out.push(phone.number);
    }
  }
  return out;
}

export function liveFormat(partial: string, country: CountryCode): string {
  return new AsYouType(country).input(partial);
}
