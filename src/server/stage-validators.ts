import {
  STAGE3_ARTIFACTS,
  INVESTIGATIVE_CLAIMS,
  type ArtifactClassification,
  type ClaimStatus,
} from "../lib/stage3-evidence";
import { calculateIncidentResponseScore, type IncidentResponseState } from "../lib/stage5-response";

// ============================================================================
// AUTHORITATIVE SERVER-SIDE VALIDATION & SCORING FOR STAGES 1 TO 5
//
// These algorithms run exclusively on the server to prevent client score tampering.
// Browser clients cannot submit raw score numbers or forge completed flags.
// ============================================================================

export type StageValidationResult = {
  stageId: number;
  score: number;
  maxScore: number;
  passed: boolean;
  breakdown: Record<string, SerializableValue>;
  remarks: string;
};

export type SerializableValue =
  string | number | boolean | null | SerializableValue[] | { [key: string]: SerializableValue };

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function uniqueIds(value: unknown): string[] {
  const ids = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : typeof value === "string"
      ? value.split(/[\s,;]+/)
      : [];
  return [...new Set(ids.map((id) => id.toUpperCase().trim()).filter(Boolean))];
}

// ----------------------------------------------------------------------------
// STAGE 1: Network Investigation
// ----------------------------------------------------------------------------
export type Stage1Payload = {
  finding?: string;
  evidenceIds?: string | string[];
  alternative?: string;
  nextEvidence?: string;
  reasoning?: string;
};

export function validateStage1(payload: Stage1Payload): StageValidationResult {
  const safePayload = asRecord(payload) as Stage1Payload;
  const finding = asText(safePayload.finding).trim();
  const submittedIds = uniqueIds(safePayload.evidenceIds);

  const alternative = asText(safePayload.alternative).trim();
  const nextEvidence = asText(safePayload.nextEvidence).trim();
  const reasoning = asText(safePayload.reasoning).trim();

  const supportedIds = ["SCH-01", "AUTH-05", "DOC-06", "EXP-09"];
  const usefulIds = submittedIds.filter((id) => supportedIds.includes(id));
  const hasStaging = submittedIds.includes("EXP-09");
  const hasRead = submittedIds.includes("DOC-06");
  const avoidsOverclaim =
    finding === "Access and staging are supported; external delivery is unconfirmed.";
  const includesAlternative = alternative.length >= 20;
  const includesNextStep = nextEvidence.length >= 20;
  const explainsReasoning = reasoning.length >= 40;

  const score = Math.min(
    100,
    usefulIds.length * 10 +
      (hasStaging ? 10 : 0) +
      (hasRead ? 10 : 0) +
      (avoidsOverclaim ? 20 : 0) +
      (includesAlternative ? 10 : 0) +
      (includesNextStep ? 10 : 0) +
      (explainsReasoning ? 10 : 0),
  );

  const reportComplete =
    finding.length > 0 &&
    submittedIds.length > 0 &&
    includesAlternative &&
    includesNextStep &&
    explainsReasoning;

  const passed = score >= 50 && reportComplete;

  return {
    stageId: 1,
    score,
    maxScore: 100,
    passed,
    breakdown: {
      usefulIdsCount: usefulIds.length,
      hasStaging,
      hasRead,
      avoidsOverclaim,
      includesAlternative,
      includesNextStep,
      explainsReasoning,
      reportComplete,
    },
    remarks: passed
      ? "Stage 01 Network report verified and defensible."
      : "Insufficient evidence citations or uncorroborated conclusion.",
  };
}

// ----------------------------------------------------------------------------
// STAGE 2: Access Investigation
// ----------------------------------------------------------------------------
export type Stage2Payload = {
  evidenceIds?: string | string[];
  finding?: string;
  timelineIds?: string[];
  establishedVsUnknown?: string;
  alternative?: string;
  nextEvidence?: string;
};

export function validateStage2(payload: Stage2Payload): StageValidationResult {
  const safePayload = asRecord(payload) as Stage2Payload;
  const submittedIds = uniqueIds(safePayload.evidenceIds);

  const finding = asText(safePayload.finding).trim();
  const timelineIds = uniqueIds(safePayload.timelineIds);
  const establishedVsUnknown = asText(safePayload.establishedVsUnknown).trim();
  const alternative = asText(safePayload.alternative).trim();
  const nextEvidence = asText(safePayload.nextEvidence).trim();

  const keySupportedIds = [
    "IAM-POL-201",
    "CFG-AUD-202",
    "CFG-DEP-203",
    "ACL-CHK-206",
    "STS-ISS-208",
    "SCH-LOG-209",
    "WKR-CFG-210",
    "API-VAL-211",
    "AUTH-EVAL-212",
    "OBJ-RET-213",
    "KEY-ROT-215",
  ];
  const distractionIds = ["AUTH-LOG-204", "DOC-WEB-205", "SEC-ALR-207"];

  const matchedKeyIds = submittedIds.filter((id) => keySupportedIds.includes(id));
  const matchedDistractions = submittedIds.filter((id) => distractionIds.includes(id));

  const evidenceScore = Math.min(30, matchedKeyIds.length * 5);
  const distractionScore =
    matchedDistractions.length === 0 ? 10 : matchedDistractions.length === 1 ? 5 : 0;

  const optimalFindingString =
    "svc-exportbridge accessed the roadmap via a legitimate automated STS token and overprivileged inherited permissions triggered by Config v17; external delivery and human motive remain unestablished.";
  const isOptimalFinding = finding === optimalFindingString;
  const findingScore = isOptimalFinding ? 15 : 0;

  const timelineCount = timelineIds.length;
  const hasPreAccessEvents = timelineIds.some((id) =>
    ["IAM-POL-201", "CFG-AUD-202", "ACL-CHK-206"].includes(id),
  );
  const hasExecutionEvents = timelineIds.some((id) =>
    ["STS-ISS-208", "AUTH-EVAL-212", "OBJ-RET-213"].includes(id),
  );
  const timelineOrderBonus = hasPreAccessEvents && hasExecutionEvents ? 5 : 0;
  const timelineCountScore = timelineCount >= 5 ? 10 : timelineCount >= 3 ? 6 : timelineCount * 2;
  const timelineScore = Math.min(15, timelineCountScore + timelineOrderBonus);

  const establishedScore = establishedVsUnknown.length >= 40 ? 10 : 0;
  const alternativeScore = alternative.length >= 30 ? 10 : 0;
  const nextEvidenceScore = nextEvidence.length >= 30 ? 10 : 0;

  const score = Math.min(
    100,
    evidenceScore +
      distractionScore +
      findingScore +
      timelineScore +
      establishedScore +
      alternativeScore +
      nextEvidenceScore,
  );

  const passed = score >= 50;

  return {
    stageId: 2,
    score,
    maxScore: 100,
    passed,
    breakdown: {
      evidenceScore,
      distractionScore,
      findingScore,
      timelineScore,
      establishedScore,
      alternativeScore,
      nextEvidenceScore,
      matchedKeyIds,
      matchedDistractions,
    },
    remarks: passed
      ? "Stage 02 Access Analysis verified."
      : "Insufficient analysis of overprivileged role or container ACLs.",
  };
}

// ----------------------------------------------------------------------------
// STAGE 3: Evidence Analysis (The Evidence Lab)
// ----------------------------------------------------------------------------
export type Stage3Payload = {
  classifications?: Record<string, ArtifactClassification>;
  comparisonsLedger?: Array<{ artifactA: string; artifactB: string; relation: string }>;
  claimAssessments?: Record<string, { status: ClaimStatus; citedArtifacts?: string[] }>;
  selectedFindingId?: string;
  selectedLimitationId?: string;
  selectedNextStepId?: string;
  alternativeTheory?: string;
};

export function validateStage3(payload: Stage3Payload): StageValidationResult {
  const safePayload = asRecord(payload) as Stage3Payload;
  const classifications = asRecord(safePayload.classifications) as NonNullable<
    Stage3Payload["classifications"]
  >;
  const knownArtifactIds = new Set(STAGE3_ARTIFACTS.map((artifact) => artifact.id));
  const comparisonsLedger = Array.isArray(safePayload.comparisonsLedger)
    ? safePayload.comparisonsLedger.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          knownArtifactIds.has(item.artifactA) &&
          knownArtifactIds.has(item.artifactB) &&
          item.artifactA !== item.artifactB &&
          ["identical", "altered_metadata", "incomparable"].includes(item.relation),
      )
    : [];
  const uniqueComparisons = Array.from(
    new Map(
      comparisonsLedger.map((comparison) => {
        const pair = [comparison.artifactA, comparison.artifactB].sort().join(":");
        return [pair, comparison] as const;
      }),
    ).values(),
  );
  const claimAssessments = asRecord(safePayload.claimAssessments) as NonNullable<
    Stage3Payload["claimAssessments"]
  >;
  const selectedFindingId = asText(safePayload.selectedFindingId);
  const selectedLimitationId = asText(safePayload.selectedLimitationId);
  const selectedNextStepId = asText(safePayload.selectedNextStepId);
  const alternativeTheory = asText(safePayload.alternativeTheory).trim();

  // 1. Provenance Score (up to 25 pts)
  let provenanceScore = 0;
  const totalArtifacts = STAGE3_ARTIFACTS.length;
  let correctClassifications = 0;
  for (const artifact of STAGE3_ARTIFACTS) {
    if (classifications[artifact.id] === artifact.expectedClassification) {
      correctClassifications += 1;
    }
  }
  provenanceScore = Math.round((correctClassifications / totalArtifacts) * 25);

  // 2. Hash Integrity Score (up to 25 pts)
  let integrityScore = 0;
  const hasBitstreamIdentity = comparisonsLedger.some(
    (c) =>
      ((c.artifactA === "ART-ACQ-301" && c.artifactB === "ART-EXP-302") ||
        (c.artifactA === "ART-EXP-302" && c.artifactB === "ART-ACQ-301")) &&
      c.relation === "identical",
  );
  const hasWorkingCopyDifference = comparisonsLedger.some(
    (c) =>
      ((c.artifactA === "ART-ACQ-301" && c.artifactB === "ART-WRK-304") ||
        (c.artifactA === "ART-WRK-304" && c.artifactB === "ART-ACQ-301")) &&
      c.relation === "altered_metadata",
  );
  const hasIncomparableOrDecoy = comparisonsLedger.some(
    (c) =>
      (c.artifactA === "ART-DUP-305" || c.artifactB === "ART-DUP-305") &&
      c.relation === "incomparable",
  );

  if (hasBitstreamIdentity) integrityScore += 10;
  if (hasWorkingCopyDifference) integrityScore += 10;
  if (hasIncomparableOrDecoy || uniqueComparisons.length >= 3) integrityScore += 5;
  integrityScore = Math.min(25, integrityScore);

  // 3. Claims Score (up to 20 pts: 5 each)
  let claimScore = 0;
  for (const claim of INVESTIGATIVE_CLAIMS) {
    const assessment = claimAssessments[claim.id];
    if (assessment && assessment.status === claim.expectedStatus) {
      claimScore += 5;
    }
  }

  // 4. Citation Quality (up to 15 pts)
  let citationScore = 0;
  const claim1Cites = claimAssessments["CLAIM-1"]?.citedArtifacts || [];
  if (claim1Cites.includes("ART-ACQ-301") || claim1Cites.includes("ART-EXP-302")) {
    citationScore += 4;
  }
  const claim2Cites = claimAssessments["CLAIM-2"]?.citedArtifacts || [];
  if (claim2Cites.includes("ART-WRK-304")) {
    citationScore += 3;
  }
  const claim3Cites = claimAssessments["CLAIM-3"]?.citedArtifacts || [];
  if (claim3Cites.includes("ART-LOG-306")) {
    citationScore += 4;
  }
  citationScore = Math.min(15, citationScore);

  // 5. Verdict Uncertainty & Next Steps (up to 15 pts)
  let uncertaintyScore = 0;
  if (selectedFindingId === "V-FIND-1") uncertaintyScore += 5;
  if (selectedLimitationId === "V-LIM-1") uncertaintyScore += 4;
  if (selectedNextStepId === "V-STEP-1") uncertaintyScore += 3;
  if (alternativeTheory.length >= 30) uncertaintyScore += 3;
  uncertaintyScore = Math.min(15, uncertaintyScore);

  const score = Math.min(
    100,
    provenanceScore + integrityScore + claimScore + citationScore + uncertaintyScore,
  );
  const passed = score >= 50;

  return {
    stageId: 3,
    score,
    maxScore: 100,
    passed,
    breakdown: {
      provenanceScore,
      integrityScore,
      claimScore,
      citationScore,
      uncertaintyScore,
    },
    remarks: passed
      ? "Stage 03 Evidence analysis verified."
      : "Artifact integrity or provenance validation incomplete.",
  };
}

// ----------------------------------------------------------------------------
// STAGE 4: Witness Investigation
// ----------------------------------------------------------------------------
export type Stage4Payload = {
  claimEvaluations?: Record<
    string,
    { status: string; citedEvidenceIds?: string[]; justification?: string }
  >;
  accountPreference?: string;
  conferenceUnresolvedId?: string;
  conferenceExplainedId?: string;
  conferenceNextInquiryId?: string;
};

export function validateStage4(payload: Stage4Payload): StageValidationResult {
  const safePayload = asRecord(payload) as Stage4Payload;
  const claimEvaluations = asRecord(safePayload.claimEvaluations) as NonNullable<
    Stage4Payload["claimEvaluations"]
  >;
  const accountPreference = asText(safePayload.accountPreference);
  const conferenceUnresolvedId = asText(safePayload.conferenceUnresolvedId);
  const conferenceExplainedId = asText(safePayload.conferenceExplainedId);
  const conferenceNextInquiryId = asText(safePayload.conferenceNextInquiryId);

  // 1. Claims checks (max 30)
  const expectedClaimStatuses: Record<string, string> = {
    "CW-01": "corroborated",
    "CW-02": "contradicted",
    "CW-03": "contradicted",
    "CW-04": "corroborated",
    "CW-05": "corroborated",
    "CW-06": "contradicted",
  };

  let claimScore = 0;
  for (const [id, expected] of Object.entries(expectedClaimStatuses)) {
    if (claimEvaluations[id]?.status === expected) {
      claimScore += 5;
    }
  }

  // 2. Correlation Score (max 20)
  let correlationScore = 0;
  const cw1Evidence = claimEvaluations["CW-01"]?.citedEvidenceIds || [];
  if (cw1Evidence.includes("CFG-AUD-202")) correlationScore += 5;

  const cw2Evidence = claimEvaluations["CW-02"]?.citedEvidenceIds || [];
  if (cw2Evidence.includes("SCH-LOG-209") || cw2Evidence.includes("DOC-WEB-205")) {
    correlationScore += 5;
  }

  const cw3Evidence = claimEvaluations["CW-03"]?.citedEvidenceIds || [];
  if (cw3Evidence.includes("ART-PRX-312") || cw3Evidence.includes("NET-13")) {
    correlationScore += 5;
  }

  const cw5Evidence = claimEvaluations["CW-05"]?.citedEvidenceIds || [];
  if (cw5Evidence.includes("ART-LOG-306")) correlationScore += 5;

  correlationScore = Math.min(20, correlationScore);

  // 3. Citations & Justifications (max 20)
  let citationScore = 0;
  for (const id of Object.keys(expectedClaimStatuses)) {
    const evaluation = claimEvaluations[id];
    if (
      typeof evaluation?.justification === "string" &&
      evaluation.justification.trim().length >= 25
    ) {
      citationScore += 3.5;
    }
  }
  citationScore = Math.min(20, Math.round(citationScore));

  // 4. Credibility & Account Preference (max 15)
  let credibilityScore = 0;
  if (accountPreference === "ACCT-01") credibilityScore += 15;
  else if (accountPreference === "ACCT-02") credibilityScore += 6;

  // 5. Conference Next Steps (max 15)
  let conferenceScore = 0;
  if (conferenceUnresolvedId === "CONF-UNRES-1") conferenceScore += 5;
  if (conferenceExplainedId === "CONF-EXP-1") conferenceScore += 5;
  if (conferenceNextInquiryId === "CONF-INQ-1") conferenceScore += 5;

  const score = Math.min(
    100,
    claimScore + correlationScore + citationScore + credibilityScore + conferenceScore,
  );
  const passed = score >= 50;

  return {
    stageId: 4,
    score,
    maxScore: 100,
    passed,
    breakdown: {
      claimScore,
      correlationScore,
      citationScore,
      credibilityScore,
      conferenceScore,
    },
    remarks: passed
      ? "Stage 04 Witness statement evaluation corroborated."
      : "Incomplete corroboration of witness claims.",
  };
}

// ----------------------------------------------------------------------------
// STAGE 5: Incident Response
// ----------------------------------------------------------------------------
export function validateStage5(payload: IncidentResponseState): StageValidationResult {
  let scoreResult: ReturnType<typeof calculateIncidentResponseScore>;
  try {
    scoreResult = calculateIncidentResponseScore(payload);
  } catch {
    return {
      stageId: 5,
      score: 0,
      maxScore: 100,
      passed: false,
      breakdown: { invalidPayload: true },
      remarks: "Invalid incident response submission. Review the form and try again.",
    };
  }
  const passed = scoreResult.total >= 50 && !scoreResult.hasDestructiveActions;

  return {
    stageId: 5,
    score: scoreResult.total,
    maxScore: 100,
    passed,
    breakdown: { ...scoreResult },
    remarks: passed
      ? "Stage 05 Incident Response response validated: Defensible, proportionate action."
      : scoreResult.hasDestructiveActions
        ? "Response rejected due to destructive evidence alteration or unsafe recovery."
        : "Incident response plan scored below passing threshold.",
  };
}
