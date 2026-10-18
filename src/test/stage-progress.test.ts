import { describe, expect, it } from "vitest";
import { getCompletedStagePrefix, normalizeStageScores } from "../lib/stage-progress";

describe("stage progress consistency", () => {
  it("counts only the uninterrupted completed-stage prefix", () => {
    expect(getCompletedStagePrefix([1, 2])).toEqual([1, 2]);
    expect(getCompletedStagePrefix([1, 3])).toEqual([1]);
    expect(getCompletedStagePrefix([2, 3])).toEqual([]);
    expect(getCompletedStagePrefix([1, 2, 3, 4, 5, 6, 2.5])).toEqual([1, 2, 3, 4, 5]);
  });

  it("preserves legacy aggregate scores when per-stage scores are missing", () => {
    expect(normalizeStageScores({}, [1], 100)).toEqual({ "1": 100 });
    expect(normalizeStageScores({}, [1, 2], 150)).toEqual({ "1": 100, "2": 50 });
  });

  it("clamps malformed per-stage score data to the supported range", () => {
    expect(normalizeStageScores({ "1": 125, "2": -5, "6": 30 }, [1, 2], 100)).toEqual({
      "1": 100,
      "2": 0,
    });
  });
});
