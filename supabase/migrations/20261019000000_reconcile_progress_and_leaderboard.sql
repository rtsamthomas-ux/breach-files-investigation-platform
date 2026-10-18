-- Keep leaderboard progress in sync with the app's sequential stage progression.
-- CREATE TABLE IF NOT EXISTS does not add columns to a table created by an older schema.
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS completed_stages INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_stage INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stage_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS case_concluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE OR REPLACE FUNCTION public.completed_stage_prefix(stage_ids INTEGER[])
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    (SELECT MIN(candidate.stage_id) - 1
     FROM generate_series(1, 5) AS candidate(stage_id)
     WHERE NOT (candidate.stage_id = ANY(COALESCE(stage_ids, '{}'::INTEGER[])))),
    5
  );
$$;

DROP VIEW IF EXISTS public.leaderboard_view CASCADE;
CREATE VIEW public.leaderboard_view AS
SELECT
  p.username,
  COALESCE(up.total_score, 0) AS total_score,
  COALESCE(public.completed_stage_prefix(up.completed_stages), 0) AS stages_completed,
  COALESCE(up.case_concluded, false) AS case_concluded,
  up.last_activity_at
FROM public.profiles p
LEFT JOIN public.user_progress up ON p.id = up.user_id
WHERE p.role != 'admin'
ORDER BY total_score DESC, stages_completed DESC, up.last_activity_at ASC;

GRANT SELECT ON public.leaderboard_view TO anon, authenticated;
