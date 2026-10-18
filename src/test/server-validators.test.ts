import { describe, expect, it } from "vitest";
import {
  validateStage1,
  validateStage2,
  validateStage3,
  validateStage4,
  validateStage5,
} from "../server/stage-validators";
import { INITIAL_RESPONSE_STATE } from "../lib/stage5-response";

describe("Authoritative Server-side Stage Validators", () => {
  describe("Stage 1 - Network Investigation", () => {
    it("rejects incomplete submissions", () => {
      const result = validateStage1({});
      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
    });

    it("awards full points and passes a robust evidence-backed finding", () => {
      const result = validateStage1({
        finding: "Access and staging are supported; external delivery is unconfirmed.",
        evidenceIds: "SCH-01, AUTH-05, DOC-06, EXP-09",
        alternative: "Decoy traffic or scheduled batch job without external egress.",
        nextEvidence: "Request partner B2B SFTP logs and border firewall PCAP records.",
        reasoning:
          "Internal storage document read was successful and package was staged internally, but no external flow matches.",
      });

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.breakdown["avoidsOverclaim"]).toBe(true);
    });

    it("does not award extra evidence points for duplicate IDs", () => {
      const payload = {
        finding: "Access and staging are supported; external delivery is unconfirmed.",
        alternative: "A routine scheduled export could explain the staging activity.",
        nextEvidence: "Request recipient-side transfer logs for the relevant time window.",
        reasoning: "The read and staging records are present, while no delivery is confirmed.",
      };

      const single = validateStage1({ ...payload, evidenceIds: "EXP-09" });
      const repeated = validateStage1({ ...payload, evidenceIds: "EXP-09 EXP-09 EXP-09" });
      expect(repeated.score).toBe(single.score);
    });
  });

  describe("Stage 2 - Access Investigation", () => {
    it("penalizes distractions and rewards key supported access records", () => {
      const cleanResult = validateStage2({
        finding:
          "svc-exportbridge accessed the roadmap via a legitimate automated STS token and overprivileged inherited permissions triggered by Config v17; external delivery and human motive remain unestablished.",
        evidenceIds: ["IAM-POL-201", "CFG-AUD-202", "ACL-CHK-206", "STS-ISS-208", "AUTH-EVAL-212"],
        timelineIds: ["IAM-POL-201", "CFG-AUD-202", "STS-ISS-208", "AUTH-EVAL-212", "OBJ-RET-213"],
        establishedVsUnknown:
          "Machine auth was legitimate; human motive and post-staging transmission remain unproven.",
        alternative: "Configuration change oversight during routine quarterly updates.",
        nextEvidence: "GitLab commit review telemetry and SEC-5519 ticket logs.",
      });

      expect(cleanResult.score).toBeGreaterThanOrEqual(75);
      expect(cleanResult.passed).toBe(true);
    });

    it("counts only distinct evidence and timeline IDs", () => {
      const payload = {
        evidenceIds: ["IAM-POL-201"],
        timelineIds: ["IAM-POL-201", "STS-ISS-208", "OBJ-RET-213"],
        establishedVsUnknown:
          "Machine authentication is established; external delivery is unknown.",
        alternative: "A routine configuration change may explain the policy state.",
        nextEvidence: "Request the full change review and deployment records.",
      };
      const unique = validateStage2(payload);
      const repeated = validateStage2({
        ...payload,
        evidenceIds: ["IAM-POL-201", "IAM-POL-201", "IAM-POL-201"],
        timelineIds: [...payload.timelineIds, ...payload.timelineIds],
      });
      expect(repeated.score).toBe(unique.score);
    });
  });

  describe("Stage 3 - Evidence Analysis", () => {
    it("correctly calculates provenance, hash integrity, and claims", () => {
      const result = validateStage3({
        selectedFindingId: "V-FIND-1",
        selectedLimitationId: "V-LIM-1",
        selectedNextStepId: "V-STEP-1",
        alternativeTheory:
          "Analyst working copy hash diff caused by local pax headers, not tampering.",
        claimAssessments: {
          "CLAIM-1": { status: "supported", citedArtifacts: ["ART-ACQ-301", "ART-EXP-302"] },
          "CLAIM-2": { status: "contradicted", citedArtifacts: ["ART-WRK-304"] },
          "CLAIM-3": { status: "supported", citedArtifacts: ["ART-LOG-306"] },
          "CLAIM-4": { status: "unresolved", citedArtifacts: ["ART-EGR-309", "ART-RES-313"] },
        },
        comparisonsLedger: [
          { artifactA: "ART-ACQ-301", artifactB: "ART-EXP-302", relation: "identical" },
          { artifactA: "ART-ACQ-301", artifactB: "ART-WRK-304", relation: "altered_metadata" },
        ],
      });

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.passed).toBe(true);
    });

    it("does not award integrity points for duplicate or unknown artifact comparisons", () => {
      const result = validateStage3({
        comparisonsLedger: [
          { artifactA: "ART-UNKNOWN-1", artifactB: "ART-UNKNOWN-2", relation: "identical" },
          { artifactA: "ART-UNKNOWN-1", artifactB: "ART-UNKNOWN-2", relation: "identical" },
          { artifactA: "ART-UNKNOWN-3", artifactB: "ART-UNKNOWN-4", relation: "identical" },
        ],
      });
      expect(result.breakdown["integrityScore"]).toBe(0);
    });
  });

  describe("Stage 4 - Witness Investigation", () => {
    it("validates witness claim corroboration against physical evidence", () => {
      const result = validateStage4({
        claimEvaluations: {
          "CW-01": { status: "corroborated", citedEvidenceIds: ["CFG-AUD-202"] },
          "CW-02": { status: "contradicted", citedEvidenceIds: ["SCH-LOG-209"] },
          "CW-03": { status: "contradicted", citedEvidenceIds: ["ART-PRX-312"] },
          "CW-04": { status: "corroborated" },
          "CW-05": { status: "corroborated", citedEvidenceIds: ["ART-LOG-306"] },
          "CW-06": { status: "contradicted" },
        },
        accountPreference: "ACCT-01",
        conferenceUnresolvedId: "CONF-UNRES-1",
        conferenceExplainedId: "CONF-EXP-1",
        conferenceNextInquiryId: "CONF-INQ-1",
      });

      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.passed).toBe(true);
    });

    it("does not award citation points for unrecognized claim keys", () => {
      const payload = {
        claimEvaluations: {
          EXTRA_1: {
            status: "corroborated",
            justification: "A sufficiently long fabricated claim justification.",
          },
          EXTRA_2: {
            status: "corroborated",
            justification: "Another sufficiently long fabricated justification.",
          },
        },
      };
      const result = validateStage4(payload);
      expect(result.breakdown["citationScore"]).toBe(0);
      expect(result.passed).toBe(false);
    });
  });

  describe("Stage 5 - Incident Response", () => {
    it("rejects destructive actions on the server", () => {
      const destructiveState = {
        ...INITIAL_RESPONSE_STATE,
        phase1: {
          ...INITIAL_RESPONSE_STATE.phase1,
          selectedActionIds: ["ACT-07"], // deleting staged package
        },
      };

      const result = validateStage5(destructiveState);
      expect(result.passed).toBe(false);
      expect(result.breakdown["hasDestructiveActions"]).toBe(true);
    });

    it("returns a failed validation for malformed payloads instead of throwing", () => {
      const result = validateStage5(null as never);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe("TanStack Start submitStageServerFn integration", () => {
    it("rejects invalid stage IDs", async () => {
      const { executeStageSubmission } = await import("../server/submissions.server");
      await expect(
        executeStageSubmission({
          stageId: 99,
          payload: {},
        }),
      ).rejects.toThrow(/Invalid stageId/);
    });

    it("evaluates Stage 1 via server function handler", async () => {
      const { executeStageSubmission } = await import("../server/submissions.server");
      const res = await executeStageSubmission({
        stageId: 1,
        payload: {
          finding: "Access and staging are supported; external delivery is unconfirmed.",
          evidenceIds: "SCH-01, AUTH-05, DOC-06, EXP-09",
          alternative: "Decoy traffic or scheduled batch job without external egress.",
          nextEvidence: "Request partner B2B SFTP logs and border firewall PCAP records.",
          reasoning:
            "Internal storage document read was successful and package was staged internally, but no external flow matches.",
        },
      });

      expect(res.success).toBe(true);
      expect(res.score).toBe(100);
      expect(res.passed).toBe(true);
      expect(res.completedStages).toContain(1);
    });
  });
});
