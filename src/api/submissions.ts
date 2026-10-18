import { createServerFn } from "@tanstack/react-start";
import type { SubmitStageInput, SubmitStageResponse } from "../server/submissions.server";
import type { AdminSubmissionsInput, AdminSubmissionsResponse } from "../server/admin.server";

export type { SubmitStageInput, SubmitStageResponse };

export const submitStageServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as SubmitStageInput)
  .handler(async ({ data }): Promise<SubmitStageResponse> => {
    const { executeStageSubmission } = await import("../server/submissions.server");
    return executeStageSubmission(data);
  });

export const getLeaderboardServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchLeaderboard } = await import("../server/submissions.server");
  return fetchLeaderboard();
});

export const getAdminSubmissionsServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown): AdminSubmissionsInput => data as AdminSubmissionsInput)
  .handler(async ({ data }): Promise<AdminSubmissionsResponse> => {
    const { fetchAdminSubmissions } = await import("../server/admin.server");
    return fetchAdminSubmissions(data);
  });
