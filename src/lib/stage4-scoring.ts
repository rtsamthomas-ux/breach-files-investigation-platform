import { CASE_WALL_CLAIMS, WITNESS_PROFILES } from "./stage4-witnesses";

export type Stage4ScoringPayload = {
  claimEvaluations?: Record<
    string,
    { status?: string; citedEvidenceIds?: string[]; justification?: string }
  >;
  flaggedStatementIds?: string[];
  witnessNotes?: Record<string, { established?: string; disputed?: string; unknowns?: string }>;
  credibilityLedger?: Record<string, { reliability?: string; motive?: string; rationale?: string }>;
  accountPreference?: string;
  conferenceUnresolvedId?: string;
  conferenceExplainedId?: string;
  conferenceNextInquiryId?: string;
  conferenceFollowupStatementId?: string;
  followupRationale?: string;
};

const CORRELATION_CITATIONS = [
  "CFG-AUD-202",
  "DOC-WEB-205",
  "ART-PRX-312",
  "STS-ISS-208",
  "ART-LOG-306",
] as const;

const VALID_RELIABILITY = new Set(["high", "moderate", "low"]);
const VALID_MOTIVE = new Set(["benign", "unverified", "malicious"]);

function hasText(value: unknown, minLength = 1): value is string {
  return typeof value === "string" && value.trim().length >= minLength;
}

export function calculateStage4Score(payload: Stage4ScoringPayload) {
  const claims = payload.claimEvaluations ?? {};
  const notes = payload.witnessNotes ?? {};
  const ledger = payload.credibilityLedger ?? {};

  let claimScore = 0;
  for (const claim of CASE_WALL_CLAIMS) {
    if (claims[claim.id]?.status === claim.expectedStatus) claimScore += 5;
  }

  const flaggedIds = new Set(payload.flaggedStatementIds ?? []);
  let correlationScore = 0;
  if (claims["CW-03"]?.status === "contradicted") correlationScore += 5;
  if (claims["CW-02"]?.status === "contradicted") correlationScore += 5;
  if (claims["CW-05"]?.status === "contradicted") correlationScore += 5;
  if (flaggedIds.size >= 2) correlationScore += 5;

  const citedIds = new Set(
    Object.values(claims).flatMap((claim) =>
      Array.isArray(claim?.citedEvidenceIds)
        ? claim.citedEvidenceIds.filter((id): id is string => typeof id === "string")
        : [],
    ),
  );
  const evidenceCitationScore = Math.min(
    10,
    CORRELATION_CITATIONS.filter((id) => citedIds.has(id)).length * 2,
  );

  const rationalePoints = CASE_WALL_CLAIMS.filter((claim) =>
    hasText(claims[claim.id]?.justification, 25),
  ).length;
  const justificationScore = Math.min(10, Math.round((rationalePoints / 6) * 10));
  const citationScore = evidenceCitationScore + justificationScore;

  let credibilityScore = 0;
  const mira = ledger["WIT-MV"];
  if (
    mira &&
    (mira.reliability === "high" || mira.reliability === "moderate") &&
    mira.motive === "unverified"
  ) {
    credibilityScore += 5;
  }
  const jonah = ledger["WIT-JP"];
  if (jonah?.reliability === "moderate" && jonah.motive === "benign") credibilityScore += 5;
  if (hasText(ledger["WIT-ER"]?.reliability) && hasText(ledger["WIT-RS"]?.reliability)) {
    credibilityScore += 5;
  }

  let conferenceScore = 0;
  if (payload.accountPreference === "CONF-ACC-1") conferenceScore += 4;
  if (payload.conferenceUnresolvedId === "CONF-UNRES-1") conferenceScore += 4;
  if (payload.conferenceExplainedId === "CONF-EXP-1") conferenceScore += 3;
  if (payload.conferenceNextInquiryId === "CONF-INQ-1") conferenceScore += 4;

  const noteCount = WITNESS_PROFILES.filter((witness) => {
    const note = notes[witness.id];
    return note && [note.established, note.disputed, note.unknowns].some((value) => hasText(value));
  }).length;
  const claimsComplete = CASE_WALL_CLAIMS.every((claim) => {
    const evaluation = claims[claim.id];
    return Boolean(
      evaluation?.status &&
      Array.isArray(evaluation.citedEvidenceIds) &&
      evaluation.citedEvidenceIds.length > 0 &&
      hasText(evaluation.justification, 25),
    );
  });
  const credibilityComplete = WITNESS_PROFILES.every((witness) => {
    const entry = ledger[witness.id];
    return Boolean(
      entry &&
      VALID_RELIABILITY.has(entry.reliability ?? "") &&
      VALID_MOTIVE.has(entry.motive ?? "") &&
      hasText(entry.rationale, 15),
    );
  });
  const statementIds = new Set(
    WITNESS_PROFILES.flatMap((witness) => witness.statements.map((s) => s.id)),
  );
  const conferenceComplete = Boolean(
    payload.accountPreference &&
    payload.conferenceUnresolvedId &&
    payload.conferenceExplainedId &&
    payload.conferenceNextInquiryId &&
    statementIds.has(payload.conferenceFollowupStatementId ?? "") &&
    hasText(payload.followupRationale, 25),
  );
  const notesComplete = noteCount === WITNESS_PROFILES.length;
  const score = Math.min(
    100,
    claimScore +
      correlationScore +
      citationScore +
      justificationScore +
      credibilityScore +
      conferenceScore,
  );

  return {
    score,
    breakdown: {
      claimScore,
      correlationScore,
      citationScore,
      evidenceCitationScore,
      justificationScore,
      credibilityScore,
      conferenceScore,
    },
    requirements: {
      notesComplete,
      claimsComplete,
      credibilityComplete,
      conferenceComplete,
    },
    passed:
      score >= 50 && notesComplete && claimsComplete && credibilityComplete && conferenceComplete,
  };
}
