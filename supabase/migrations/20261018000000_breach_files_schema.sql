-- ============================================================================
-- THE BREACH FILES: DATABASE SCHEMA & ROW LEVEL SECURITY
-- ============================================================================
-- Compatible with the Supabase SQL Editor and automated migrations.
-- Safe to run on fresh projects as well as re-run on existing databases.
--
-- Security Guarantees:
--  1. Strict participant vs admin roles. Participants CANNOT alter their own role.
--  2. Role protection supports modern 'sb_secret_' keys, postgres/service_role
--     database roles, and legacy JWT claims.
--  3. Scores, stages, and completion claims are ONLY writable by server / secret role.
--  4. Profile reads are strictly private: participants can only inspect their own profile.
--  5. Public leaderboard exposes strictly minimal metadata:
--     (username, total_score, stages_completed, case_concluded, last_activity_at).
--     Never exposes emails, roles, or internal user UUIDs.
--  6. SECURITY DEFINER triggers use pinned search_path to prevent search-path injection.
--  7. Signup trigger safely provisions profiles with collision handling.
-- ============================================================================

-- Ensure pgcrypto extension for UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('participant', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER avoids recursively applying profiles RLS while checking admin access.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

-- Profiles RLS:
-- Participants may only view their OWN profile. Admins may view any profile.
-- Public/anonymous access to the profiles table is strictly denied.
DROP POLICY IF EXISTS "Public and authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_admin()
  );

-- Users can only update their own username. Role modifications are strictly rejected.
DROP POLICY IF EXISTS "Users can update own username only" ON public.profiles;
CREATE POLICY "Users can update own username only"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.current_profile_role()
  );

-- Direct client inserts into profiles are disallowed; handled exclusively via auth trigger or secret role.
DROP POLICY IF EXISTS "Deny direct profile insertion" ON public.profiles;
CREATE POLICY "Deny direct profile insertion"
  ON public.profiles FOR INSERT
  WITH CHECK (false);

-- Direct client deletions of profiles are disallowed.
DROP POLICY IF EXISTS "Deny direct profile deletion" ON public.profiles;
CREATE POLICY "Deny direct profile deletion"
  ON public.profiles FOR DELETE
  USING (false);

-- ----------------------------------------------------------------------------
-- 2. USER PROGRESS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_stages INTEGER[] NOT NULL DEFAULT '{}',
  current_stage INTEGER NOT NULL DEFAULT 1 CHECK (current_stage >= 1 AND current_stage <= 5),
  stage_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 500),
  case_concluded BOOLEAN NOT NULL DEFAULT false,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- CREATE TABLE IF NOT EXISTS does not add columns to tables from older deployments.
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS completed_stages INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_stage INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stage_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS case_concluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Progress RLS:
-- Users can inspect their own progress. Admins can view all progress.
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;
CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- Direct client modifications to scores or stage completion are strictly DENIED.
-- Only the server (via secret role / service role) may write progress records.
DROP POLICY IF EXISTS "Deny direct client progress insertion" ON public.user_progress;
CREATE POLICY "Deny direct client progress insertion"
  ON public.user_progress FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client progress update" ON public.user_progress;
CREATE POLICY "Deny direct client progress update"
  ON public.user_progress FOR UPDATE
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client progress deletion" ON public.user_progress;
CREATE POLICY "Deny direct client progress deletion"
  ON public.user_progress FOR DELETE
  USING (false);

-- ----------------------------------------------------------------------------
-- 3. STAGE SUBMISSIONS TABLE (Authoritative Audit Log of Evaluated Attempts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stage_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL CHECK (stage_id >= 1 AND stage_id <= 5),
  payload JSONB NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  completion_status BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_stage ON public.stage_submissions(user_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON public.stage_submissions(submitted_at DESC);

ALTER TABLE public.stage_submissions ENABLE ROW LEVEL SECURITY;

-- Submissions RLS:
-- Users can only read their own past submissions; admins can read all submissions.
DROP POLICY IF EXISTS "Users can view own submissions" ON public.stage_submissions;
CREATE POLICY "Users can view own submissions"
  ON public.stage_submissions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- Direct client inserts/updates/deletions are completely DENIED.
-- Submissions must originate from verified server functions.
DROP POLICY IF EXISTS "Deny direct client submission insert" ON public.stage_submissions;
CREATE POLICY "Deny direct client submission insert"
  ON public.stage_submissions FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client submission update" ON public.stage_submissions;
CREATE POLICY "Deny direct client submission update"
  ON public.stage_submissions FOR UPDATE
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client submission deletion" ON public.stage_submissions;
CREATE POLICY "Deny direct client submission deletion"
  ON public.stage_submissions FOR DELETE
  USING (false);

-- ----------------------------------------------------------------------------
-- 4. PRIVACY-HARDENED LEADERBOARD VIEW
-- ----------------------------------------------------------------------------
-- Exposes ONLY public ranking data:
--  - username
--  - total_score
--  - stages_completed
--  - case_concluded
--  - last_activity_at
-- Never exposes internal user UUIDs, emails, roles, or raw submission payloads.
-- DROP VIEW CASCADE guarantees safe re-runs when altering column structure.
DROP VIEW IF EXISTS public.leaderboard_view CASCADE;
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

-- Grant read access on leaderboard view to public and authenticated roles
GRANT SELECT ON public.leaderboard_view TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. NEW USER SIGNUP TRIGGER (Safely provisions profile & progress)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_username TEXT;
BEGIN
  -- Extract username from user metadata, falling back to email handle or ID
  assigned_username := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'username'), ''),
    NULLIF(split_part(new.email, '@', 1), ''),
    'investigator_' || substr(new.id::text, 1, 8)
  );

  -- Resolve collision if username is already taken by another account
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = assigned_username AND id != new.id) THEN
    assigned_username := assigned_username || '_' || substr(new.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (id, username, role)
  VALUES (new.id, assigned_username, 'participant')
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username
    WHERE profiles.username IS NULL OR profiles.username = '';

  INSERT INTO public.user_progress (user_id, completed_stages, current_stage, total_score)
  VALUES (new.id, '{}', 1, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. IMMUTABLE ROLE ENFORCEMENT TRIGGER (Prevents privilege escalation)
-- ----------------------------------------------------------------------------
-- Handles modern Supabase 'sb_secret_' connections, database-level service roles,
-- SQL editor sessions, as well as legacy JWT claims.
CREATE OR REPLACE FUNCTION public.prevent_role_tampering()
RETURNS trigger AS $$
DECLARE
  is_privileged BOOLEAN;
BEGIN
  -- Check whether the current execution context has administrative authorization:
  -- 1. Database role is service_role, postgres, or supabase_admin (standard for sb_secret_)
  -- 2. Session user is service_role, postgres, or supabase_admin
  -- 3. Legacy JWT claim role is service_role
  -- 4. Modern auth.jwt() claim role is service_role
  is_privileged := (
    session_user IN ('service_role', 'postgres', 'supabase_admin')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR COALESCE(auth.jwt()->>'role', '') = 'service_role'
  );

  IF NEW.role != OLD.role AND NOT is_privileged THEN
    RAISE EXCEPTION 'Privilege escalation violation: Participants cannot alter user roles.';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS enforce_profile_immutability ON public.profiles;
CREATE TRIGGER enforce_profile_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_tampering();

-- ----------------------------------------------------------------------------
-- 7. IDEMPOTENT BACKFILL (Safe for existing users before trigger was active)
-- ----------------------------------------------------------------------------
INSERT INTO public.profiles (id, username, role)
SELECT
  u.id,
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'username'), ''),
    NULLIF(split_part(u.email, '@', 1), ''),
    'investigator_' || substr(u.id::text, 1, 8)
  ),
  'participant'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_progress (user_id, completed_stages, current_stage, total_score)
SELECT u.id, '{}', 1, 0
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;
