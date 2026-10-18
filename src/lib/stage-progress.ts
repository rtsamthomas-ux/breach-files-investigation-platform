export const STAGE_COUNT = 5;
export type StageId = 1 | 2 | 3 | 4 | 5;

/** Return only the completed stages in the uninterrupted sequence starting at stage 1. */
export function getCompletedStagePrefix(completedStages: readonly number[]): StageId[] {
  const completed = new Set(
    completedStages.filter(
      (stage) => Number.isInteger(stage) && stage >= 1 && stage <= STAGE_COUNT,
    ),
  );

  const prefix: StageId[] = [];
  for (let stage = 1; stage <= STAGE_COUNT && completed.has(stage); stage += 1) {
    prefix.push(stage as StageId);
  }
  return prefix;
}

/** Keep the stored aggregate score stable when older rows predate per-stage scores. */
export function normalizeStageScores(
  rawScores: Record<string, unknown> | null | undefined,
  completedStages: readonly number[],
  legacyTotal: number,
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [stage, rawScore] of Object.entries(rawScores ?? {})) {
    const stageId = Number(stage);
    if (
      Number.isInteger(stageId) &&
      stageId >= 1 &&
      stageId <= STAGE_COUNT &&
      typeof rawScore === "number" &&
      Number.isFinite(rawScore)
    ) {
      scores[String(stageId)] = Math.max(0, Math.min(100, Math.round(rawScore)));
    }
  }

  let missingScore = Math.max(0, Math.min(STAGE_COUNT * 100, Math.round(legacyTotal)));
  missingScore -= Object.values(scores).reduce((sum, score) => sum + score, 0);

  for (const stageId of completedStages) {
    if (missingScore <= 0) break;
    const key = String(stageId);
    const currentScore = scores[key] ?? 0;
    const recoveredScore = Math.min(100 - currentScore, missingScore);
    if (recoveredScore > 0) {
      scores[key] = currentScore + recoveredScore;
      missingScore -= recoveredScore;
    }
  }

  return scores;
}
