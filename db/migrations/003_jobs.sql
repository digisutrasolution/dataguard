-- Async job processing: progress tracking, result sample, error, priority.
ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS job_type   TEXT NOT NULL DEFAULT 'validation';
ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS processed  BIGINT NOT NULL DEFAULT 0;
ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS sample     JSONB;
ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS error      TEXT;
ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS priority   INT NOT NULL DEFAULT 0;
ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
-- status values: queued | running | completed | failed
