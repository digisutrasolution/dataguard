// The actual work a worker runs: validate/detect numbers in chunks, updating
// progress after each chunk so the UI can show live %. Yields between chunks so
// the event loop stays responsive (important in the in-memory fallback).
import type { CountryCode } from 'libphonenumber-js';
import { validateOne } from '../modules/validation/engine.js';
import { detectMany } from '../modules/detection/provider.js';
import { getActiveProvider } from '../modules/detection/registry.js';
import { markRunning, updateProgress, finishJob, failJob } from '../modules/jobs/jobs.js';

export interface JobPayload {
  jobId: string;
  customerId: string;
  jobType: 'validation' | 'detection';
  service: string;
  numbers: string[];
  defaultCountry?: string;
}

const CHUNK = 5000;
const SAMPLE_MAX = 50;
const yield_ = () => new Promise((r) => setImmediate(r));

export async function processJob(payload: JobPayload): Promise<void> {
  const { jobId, jobType, numbers, defaultCountry } = payload;
  try {
    await markRunning(jobId);
    const opts = { defaultCountry: defaultCountry as CountryCode | undefined };
    const seen = new Set<string>();
    const sample: unknown[] = [];
    let valid = 0, invalid = 0, dup = 0, processed = 0;
    const provider = jobType === 'detection' ? await getActiveProvider() : null;

    for (let i = 0; i < numbers.length; i += CHUNK) {
      const slice = numbers.slice(i, i + CHUNK);

      if (jobType === 'detection') {
        const validated = slice.map((n) => validateOne(n, opts));
        const detections = await detectMany(provider!, validated.map((v) => (v.status === 'valid' ? v.e164 : null)));
        validated.forEach((v, k) => {
          const reg = detections[k].registration;
          if (reg === 'registered') valid++; else if (reg === 'unregistered') invalid++; else dup++;
          if (sample.length < SAMPLE_MAX) sample.push({ raw: v.raw, e164: v.e164, iso2: v.iso2, registration: reg, carrier: detections[k].carrier });
        });
      } else {
        for (const n of slice) {
          const r = validateOne(n, { ...opts, removeDuplicates: true }, seen);
          if (r.status === 'valid') valid++; else if (r.status === 'duplicate') dup++; else invalid++;
          if (sample.length < SAMPLE_MAX) sample.push({ raw: r.raw, e164: r.e164, iso2: r.iso2, numberType: r.numberType, status: r.status });
        }
      }

      processed += slice.length;
      await updateProgress(jobId, { processed, valid, invalid, dup });
      await yield_();
    }

    await finishJob(jobId, { valid, invalid, dup, processed, sample });
  } catch (e) {
    await failJob(jobId, (e as Error).message ?? 'processing_error');
  }
}
