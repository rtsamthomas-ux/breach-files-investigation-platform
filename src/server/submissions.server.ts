import {
  validateStage1,
  validateStage2,
  validateStage3,
  validateStage4,
  validateStage5,
  type StageValidationResult,
  type Stage1Payload,
  type Stage2Payload,
  type Stage3Payload,
  type Stage4Payload,
  type SerializableValue,
} from "./stage-validators";
import { getSupabaseAdminClient, isServerSupabaseReady } from "./supabase-server";
import type { IncidentResponseState } from "../lib/stage5-response";
import { getCompletedStagePrefix, normalizeStageScores, type StageId } from "../lib/stage-progress";

export type SubmitStageInput = {
  stageId: number;
  payload: unknown;
  authToken?: string;
};

export type SubmitStageResponse = {
  success: boolean;
  stageId: number;
  score: number;
  passed: boolean;
  remarks: string;
  breakdown: Record<string, SerializableValue>;
  persistedToSupabase: boolean;
  totalScore?: number;
  completedStages?: number[];
  caseConcluded?: boolean;
};

export async function executeStageSubmission(data: SubmitStageInput): Promise<SubmitStageResponse> {
  const { stageId, payload, authToken } = data;

  let result: StageValidationResult;
  switch (stageId) {
    case 1:
      result = validateStage1(payload as Stage1Payload);
      break;
    case 2:
      result = validateStage2(payload as Stage2Payload);
      break;
    case 3:
      result = validateStage3(payload as Stage3Payload);
      break;
    case 4:
      result = validateStage4(payload as Stage4Payload);
      break;
    case 5:
      result = validateStage5(payload as IncidentResponseState);
      break;
    default:
      throw new Error(`Invalid stageId: ${stageId}. Valid range is 1 to 5.`);
  }

  let persistedToSupabase = false;
  let totalScore = result.score;
  let completedStages = result.passed ? [stageId] : [];
  let caseConcluded = false;
  let submissionError: string | undefined;

  const admin = getSupabaseAdminClient();
  if (admin && authToken && isServerSupabaseReady()) {
    try {
      const {
        data: { user },
        error: authError,
      } = await admin.auth.getUser(authToken);

      if (authError || !user)
        throw new Error("Your session could not be verified. Please sign in again.");

      const { data: progress, error: progressError } = await admin
        .from("user_progress")
        .select("completed_stages, stage_scores, total_score, case_concluded")
        .eq("user_id", user.id)
        .maybeSingle();
      if (progressError) throw progressError;

      const existingCompleted = getCompletedStagePrefix(
        (progress?.completed_stages as number[]) || [],
      );
      const nextStage = existingCompleted.length + 1;
      if (stageId > nextStage) {
        throw new Error(`Complete stage ${nextStage} before submitting this stage.`);
      }

      const { error: insertError } = await admin.from("stage_submissions").insert({
        user_id: user.id,
        stage_id: stageId,
        payload: payload as Record<string, unknown>,
        score: result.score,
        breakdown: result.breakdown,
        completion_status: result.passed,
      });
      if (insertError) throw insertError;

      const existingScores = normalizeStageScores(
        progress?.stage_scores as Record<string, unknown> | null,
        existingCompleted,
        Number(progress?.total_score) || 0,
      );
      const prevScore = existingScores[String(stageId)] || 0;
      const updatedStageScore = Math.max(prevScore, result.score);
      const updatedScores = { ...existingScores, [String(stageId)]: updatedStageScore };

      const updatedCompleted = result.passed
        ? getCompletedStagePrefix([...existingCompleted, stageId as StageId])
        : existingCompleted;

      const updatedTotal = Object.values(updatedScores).reduce((acc, s) => acc + s, 0);
      const isCaseConcluded = updatedCompleted.length >= 5;

      const { error: saveProgressError } = await admin
        .from("user_progress")
        .upsert({
          user_id: user.id,
          completed_stages: updatedCompleted,
          current_stage: Math.min(5, updatedCompleted.length + 1),
          stage_scores: updatedScores,
          total_score: updatedTotal,
          case_concluded: isCaseConcluded,
          last_activity_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (saveProgressError) throw saveProgressError;

      persistedToSupabase = true;
      totalScore = updatedTotal;
      completedStages = updatedCompleted;
      caseConcluded = isCaseConcluded;
    } catch (err) {
      console.error("Failed to persist submission to Supabase:", err);
      submissionError = err instanceof Error ? err.message : "Failed to save submission.";
    }
  }

  return {
    success: !submissionError,
    stageId,
    score: result.score,
    passed: result.passed,
    remarks: submissionError || result.remarks,
    breakdown: result.breakdown,
    persistedToSupabase,
    totalScore,
    completedStages,
    caseConcluded,
  };
}

export async function fetchLeaderboard() {
  const admin = getSupabaseAdminClient();
  if (!admin || !isServerSupabaseReady()) {
    return {
      connected: false,
      entries: [],
      message: "Supabase not connected. Live leaderboard requires database configuration.",
    };
  }

  try {
    const { data, error } = await admin.from("leaderboard_view").select("*").limit(50);
    if (error) {
      return { connected: false, entries: [], message: error.message };
    }
    return { connected: true, entries: data || [], message: "Live leaderboard synchronized." };
  } catch (err) {
    return {
      connected: false,
      entries: [],
      message: err instanceof Error ? err.message : "Error fetching leaderboard",
    };
  }
}
