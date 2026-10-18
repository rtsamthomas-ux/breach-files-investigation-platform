import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Database Schema & Security RLS Integrity", () => {
  const schemaPath = path.resolve(__dirname, "../../supabase/schema.sql");
  const migrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20261018000000_breach_files_schema.sql",
  );

  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  it("ensures schema.sql and migration SQL are synchronized", () => {
    expect(schemaSql.trim()).toEqual(migrationSql.trim());
  });

  it("enforces Row Level Security on all core application tables", () => {
    expect(schemaSql).toContain("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;");
    expect(schemaSql).toContain("ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;");
    expect(schemaSql).toContain("ALTER TABLE public.stage_submissions ENABLE ROW LEVEL SECURITY;");
  });

  it("restricts profile reads to own profile and denies global public listing", () => {
    expect(schemaSql).toContain('CREATE POLICY "Users can view own profile"');
    expect(schemaSql).toContain("auth.uid() = id");
    // Verifies removal of old permissive public policy
    expect(schemaSql).not.toContain(
      'CREATE POLICY "Public and authenticated users can view profiles"',
    );
  });

  it("checks admin access through a non-recursive, locked-down helper", () => {
    expect(schemaSql).toContain("CREATE OR REPLACE FUNCTION public.is_admin()");
    expect(schemaSql).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    expect(schemaSql).toContain("REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC");
    expect(schemaSql).toContain("GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated");

    const profilesReadPolicy = schemaSql
      .split('CREATE POLICY "Users can view own profile"')[1]
      ?.split('DROP POLICY IF EXISTS "Users can update own username only"')[0];
    expect(profilesReadPolicy).toContain("public.is_admin()");
    expect(profilesReadPolicy).not.toContain("SELECT 1 FROM public.profiles");

    expect(schemaSql).toContain("CREATE OR REPLACE FUNCTION public.current_profile_role()");
    expect(schemaSql).toContain("role = public.current_profile_role()");
  });

  it("strictly denies client-side writes to progress and submissions", () => {
    expect(schemaSql).toContain('CREATE POLICY "Deny direct client progress insertion"');
    expect(schemaSql).toContain('CREATE POLICY "Deny direct client progress update"');
    expect(schemaSql).toContain('CREATE POLICY "Deny direct client progress deletion"');
    expect(schemaSql).toContain('CREATE POLICY "Deny direct client submission insert"');
    expect(schemaSql).toContain('CREATE POLICY "Deny direct client submission update"');
    expect(schemaSql).toContain('CREATE POLICY "Deny direct client submission deletion"');
  });

  it("uses valid USING clauses for deny-all DELETE policies", () => {
    const deletePolicies = Array.from(
      schemaSql.matchAll(/ON public\.\w+ FOR DELETE\s+([\s\S]*?);/g),
      (match) => match[1] || "",
    );

    expect(deletePolicies).toHaveLength(3);
    for (const policy of deletePolicies) {
      expect(policy).toContain("USING (false)");
      expect(policy).not.toContain("WITH CHECK");
    }
  });

  it("hardens leaderboard_view against leaking user UUIDs, roles, or email addresses", () => {
    const viewMatch = schemaSql.match(
      /CREATE VIEW public\.leaderboard_view AS([\s\S]*?)FROM public\.profiles/,
    );
    expect(viewMatch).toBeTruthy();
    const selectClause = viewMatch![1];

    expect(selectClause).toContain("p.username");
    expect(selectClause).toContain("total_score");
    expect(selectClause).toContain("stages_completed");
    expect(selectClause).toContain("case_concluded");
    expect(selectClause).toContain("last_activity_at");

    // Strictly ensure sensitive identifiers are NOT exposed in public leaderboard
    expect(selectClause).not.toContain("p.id");
    expect(selectClause).not.toContain("user_id");
    expect(selectClause).not.toContain("p.role");
    expect(selectClause).not.toContain("email");
  });

  it("counts only consecutive stages as completed in the leaderboard", () => {
    expect(schemaSql).toContain(
      "COALESCE(public.completed_stage_prefix(up.completed_stages), 0) AS stages_completed",
    );
    expect(schemaSql).toContain(
      "CREATE OR REPLACE FUNCTION public.completed_stage_prefix(stage_ids INTEGER[])",
    );
  });

  it("adds progress columns when upgrading an existing database", () => {
    expect(schemaSql).toContain("ADD COLUMN IF NOT EXISTS stage_scores JSONB");
    expect(schemaSql).toContain("ADD COLUMN IF NOT EXISTS case_concluded BOOLEAN");
  });

  it("supports modern Supabase sb_secret_ key and database execution context in role-protection trigger", () => {
    expect(schemaSql).toContain("FUNCTION public.prevent_role_tampering()");
    expect(schemaSql).toContain("is_privileged :=");
    expect(schemaSql).toContain("session_user IN ('service_role', 'postgres', 'supabase_admin')");
    expect(schemaSql).toContain("auth.jwt()->>'role'");
    expect(schemaSql).not.toContain(
      "current_user IN ('service_role', 'postgres', 'supabase_admin')",
    );
  });

  it("pins search_path on all SECURITY DEFINER functions to mitigate search-path injection", () => {
    const definerMatches = schemaSql.matchAll(/SECURITY DEFINER SET search_path = public, auth;/g);
    const count = Array.from(definerMatches).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
