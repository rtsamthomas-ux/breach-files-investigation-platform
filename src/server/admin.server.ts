import { getSupabaseAdminClient, isServerSupabaseReady } from "./supabase-server";

const PAGE_SIZE = 50;

type SerializableJson =
  string | number | boolean | null | SerializableJson[] | { [key: string]: SerializableJson };

export type AdminSubmissionsInput = {
  authToken?: string;
  offset?: number;
  stageId?: number | null;
  search?: string;
};

export type AdminSubmission = {
  id: string;
  username: string;
  stage_id: number;
  payload: SerializableJson;
  breakdown: SerializableJson;
  score: number;
  completion_status: boolean;
  submitted_at: string;
};

export type AdminSubmissionsResponse = {
  authorized: boolean;
  entries: AdminSubmission[];
  totalCount: number;
  message?: string;
};

const denied = (message: string): AdminSubmissionsResponse => ({
  authorized: false,
  entries: [],
  totalCount: 0,
  message,
});

export async function fetchAdminSubmissions(
  input: AdminSubmissionsInput,
): Promise<AdminSubmissionsResponse> {
  const admin = getSupabaseAdminClient();
  if (!admin || !isServerSupabaseReady()) {
    return denied(
      "Admin response review requires the server database credentials to be configured.",
    );
  }
  if (!input.authToken || input.authToken.length > 8192) {
    return denied("Sign in with an administrator account to view participant responses.");
  }

  const offset = Number.isInteger(input.offset) ? Math.max(0, input.offset as number) : 0;
  const stageId = input.stageId;
  if (stageId != null && (!Number.isInteger(stageId) || stageId < 1 || stageId > 5)) {
    return denied("Choose a valid investigation stage.");
  }
  const search = (input.search || "").trim().slice(0, 80);

  try {
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(input.authToken);
    if (authError || !user)
      return denied("Your session could not be verified. Please sign in again.");

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "admin") {
      return denied("Administrator access is required to review participant responses.");
    }

    let matchingUserIds: string[] | null = null;
    if (search) {
      const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
      const { data: profiles, error: searchError } = await admin
        .from("profiles")
        .select("id")
        .ilike("username", `%${escapedSearch}%`)
        .limit(200);
      if (searchError) throw searchError;
      matchingUserIds = (profiles || []).map((candidate) => candidate.id as string);
      if (matchingUserIds.length === 0) {
        return { authorized: true, entries: [], totalCount: 0 };
      }
    }

    let query = admin
      .from("stage_submissions")
      .select("id, user_id, stage_id, payload, breakdown, score, completion_status, submitted_at", {
        count: "exact",
      })
      .order("submitted_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (stageId != null) query = query.eq("stage_id", stageId);
    if (matchingUserIds) query = query.in("user_id", matchingUserIds);

    const { data: submissions, error: submissionsError, count } = await query;
    if (submissionsError) throw submissionsError;
    const userIds = [
      ...new Set((submissions || []).map((submission) => submission.user_id as string)),
    ];
    const { data: profiles, error: usernamesError } = userIds.length
      ? await admin.from("profiles").select("id, username").in("id", userIds)
      : { data: [], error: null };
    if (usernamesError) throw usernamesError;

    const usernameById = new Map(
      (profiles || []).map((profileRow) => [
        profileRow.id as string,
        profileRow.username as string,
      ]),
    );
    return {
      authorized: true,
      entries: (submissions || []).map((submission) => ({
        id: submission.id as string,
        username: usernameById.get(submission.user_id as string) || "Unknown investigator",
        stage_id: submission.stage_id as number,
        payload: submission.payload as SerializableJson,
        breakdown: submission.breakdown as SerializableJson,
        score: submission.score as number,
        completion_status: submission.completion_status as boolean,
        submitted_at: submission.submitted_at as string,
      })),
      totalCount: count || 0,
    };
  } catch (error) {
    console.error("Admin response fetch failed:", error);
    return denied("Could not load participant responses. Please retry.");
  }
}
