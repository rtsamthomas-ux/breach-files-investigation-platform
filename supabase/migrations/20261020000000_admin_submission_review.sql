-- Keep newest-first administrator submission paging efficient as the audit log grows.
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
  ON public.stage_submissions(submitted_at DESC);
