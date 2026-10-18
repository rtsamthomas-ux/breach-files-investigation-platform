import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  CONTAINMENT_ACTIONS,
  PRESERVATION_SOURCES,
  SCOPE_QUESTIONS,
  SAFE_RECOVERY_STEPS,
  FACT_HYPOTHESIS_ITEMS,
  RESPONSE_DECISION_OPTIONS,
  calculateIncidentResponseScore,
  type IncidentResponseState,
} from "../lib/stage5-response";
import { IncidentResponse } from "../components/IncidentResponse";

vi.mock("../api/submissions", () => ({
  submitStageServerFn: vi.fn().mockResolvedValue({
    success: true,
    stageId: 5,
    score: 80,
    passed: true,
    remarks: "Response verified.",
    breakdown: {},
    persistedToSupabase: false,
  }),
}));

describe("Stage 5 — Incident Response Data & Technical Bounds", () => {
  it("provides at least 8 containment actions covering appropriate, disproportionate, and destructive categories", () => {
    expect(CONTAINMENT_ACTIONS.length).toBeGreaterThanOrEqual(8);

    const categories = new Set(CONTAINMENT_ACTIONS.map((a) => a.category));
    expect(categories.has("appropriate")).toBe(true);
    expect(categories.has("disproportionate")).toBe(true);
    expect(categories.has("destructive")).toBe(true);

    for (const action of CONTAINMENT_ACTIONS) {
      expect(action.id).toMatch(/^ACT-\d{2}$/);
      expect(action.title.length).toBeGreaterThan(10);
      expect(action.description.length).toBeGreaterThan(20);
      expect(action.riskAssessment.length).toBeGreaterThan(15);
      expect(action.forensicImpact.length).toBeGreaterThan(15);
    }

    // Verify destructive actions are flagged inappropriate
    const destructive = CONTAINMENT_ACTIONS.filter((a) => a.category === "destructive");
    expect(destructive.length).toBeGreaterThanOrEqual(2);
    for (const d of destructive) {
      expect(d.recommendedPriority).toBe("inappropriate");
    }

    // Disproportionate company-wide shutdown
    const disprop = CONTAINMENT_ACTIONS.find((a) => a.id === "ACT-06")!;
    expect(disprop.category).toBe("disproportionate");
    expect(disprop.recommendedPriority).toBe("inappropriate");
  });

  it("provides 10 preservation sources with distinct priority tiers", () => {
    expect(PRESERVATION_SOURCES.length).toBe(10);

    const critical = PRESERVATION_SOURCES.filter((s) => s.category === "critical");
    const high = PRESERVATION_SOURCES.filter((s) => s.category === "high");
    const distractor = PRESERVATION_SOURCES.filter((s) => s.category === "distractor");

    expect(critical.length).toBe(4);
    expect(high.length).toBe(3);
    expect(distractor.length).toBe(3);

    for (const src of PRESERVATION_SOURCES) {
      expect(src.id).toMatch(/^SRC-\d{2}$/);
      expect(src.sourceName.length).toBeGreaterThan(5);
      expect(src.system.length).toBeGreaterThan(5);
      expect(src.description.length).toBeGreaterThan(20);
      expect(src.acquisitionMethod.length).toBeGreaterThan(15);
    }

    // Critical sources have priority 1
    for (const c of critical) {
      expect(c.recommendedPriority).toBe(1);
    }
    // Distractor sources have priority 4
    for (const d of distractor) {
      expect(d.recommendedPriority).toBe(4);
    }
  });

  it("defines 6 blast-radius scope questions and 6 recovery steps", () => {
    expect(SCOPE_QUESTIONS.length).toBe(6);
    for (const q of SCOPE_QUESTIONS) {
      expect(q.id).toMatch(/^SCP-\d{2}$/);
      expect(q.topic.length).toBeGreaterThan(5);
      expect(q.question.length).toBeGreaterThan(15);
      expect(q.guidance.length).toBeGreaterThan(20);
      expect(q.keyConcerns.length).toBeGreaterThanOrEqual(2);
    }

    expect(SAFE_RECOVERY_STEPS.length).toBe(6);
    const recommended = SAFE_RECOVERY_STEPS.filter((s) => s.recommended);
    const dangerous = SAFE_RECOVERY_STEPS.filter((s) => !s.recommended);

    expect(recommended.length).toBe(5);
    expect(dangerous.length).toBe(1);
    expect(dangerous[0]!.id).toBe("REC-06"); // Re-enabling cron unverified
  });

  it("classifies facts vs hypotheses objectively without overclaiming external exfiltration", () => {
    expect(FACT_HYPOTHESIS_ITEMS.length).toBe(10);

    const facts = FACT_HYPOTHESIS_ITEMS.filter((i) => i.correctCategory === "confirmed_fact");
    const hypotheses = FACT_HYPOTHESIS_ITEMS.filter(
      (i) => i.correctCategory === "reasonable_hypothesis",
    );
    const unresolved = FACT_HYPOTHESIS_ITEMS.filter(
      (i) => i.correctCategory === "unresolved_question",
    );
    const unsupported = FACT_HYPOTHESIS_ITEMS.filter(
      (i) => i.correctCategory === "unsupported_claim",
    );

    expect(facts.length).toBe(3);
    expect(hypotheses.length).toBe(2);
    expect(unresolved.length).toBe(2);
    expect(unsupported.length).toBe(3);

    // External exfiltration is NOT a confirmed fact
    const exfilStatement = FACT_HYPOTHESIS_ITEMS.find((i) => i.id === "FH-08")!;
    expect(exfilStatement.correctCategory).toBe("unsupported_claim");

    const thirdPartyReceipt = FACT_HYPOTHESIS_ITEMS.find((i) => i.id === "FH-06")!;
    expect(thirdPartyReceipt.correctCategory).toBe("unresolved_question");

    // Intent is unverified
    const intentStatement = FACT_HYPOTHESIS_ITEMS.find((i) => i.id === "FH-07")!;
    expect(intentStatement.correctCategory).toBe("unresolved_question");
  });

  it("designates proportionate response as optimal and flags exfiltration disclosure as overreactive", () => {
    expect(RESPONSE_DECISION_OPTIONS.length).toBe(3);

    const optimal = RESPONSE_DECISION_OPTIONS.find((o) => o.isOptimal)!;
    expect(optimal).toBeDefined();
    expect(optimal.id).toBe("DEC-OPT-01");
    expect(optimal.verdict).toBe("proportionate");
    expect(optimal.label).toContain("Investigate Potential Egress as Unconfirmed");

    const overreactive = RESPONSE_DECISION_OPTIONS.find((o) => o.id === "DEC-OPT-02")!;
    expect(overreactive.verdict).toBe("overreactive");
    expect(overreactive.isOptimal).toBe(false);

    const negligent = RESPONSE_DECISION_OPTIONS.find((o) => o.id === "DEC-OPT-03")!;
    expect(negligent.verdict).toBe("negligent");
    expect(negligent.isOptimal).toBe(false);
  });
});

describe("Stage 5 — Deterministic Scoring Engine", () => {
  const perfectState: IncidentResponseState = {
    phase1: {
      selectedActionIds: ["ACT-01", "ACT-02", "ACT-03", "ACT-04", "ACT-05"],
      actionPriorities: {
        "ACT-01": "immediate",
        "ACT-02": "immediate",
        "ACT-03": "immediate",
        "ACT-04": "immediate",
        "ACT-05": "secondary",
      },
      justification:
        "Comprehensive non-destructive containment halting the workflow while preserving all forensic records and active tokens.",
    },
    phase2: {
      selectedSourceIds: ["SRC-01", "SRC-02", "SRC-03", "SRC-04", "SRC-05", "SRC-06", "SRC-07"],
      sourcePriorities: {
        "SRC-01": 1,
        "SRC-02": 1,
        "SRC-03": 1,
        "SRC-04": 1,
        "SRC-05": 2,
        "SRC-06": 2,
        "SRC-07": 2,
      },
      custodian: "Lead Forensic Investigator",
      acquisitionMethod: "Read-only disk snapshot with SHA-256 seal",
      evidenceLockerLocation: "Secure enclave storage",
      chainOfCustodyNotes:
        "Full cryptographic bitstream image with hardware write blocking and independent hash logging.",
    },
    phase3: {
      scopeResponses: {
        "SCP-01": "Audit all access logs for /projects/* across deployment.",
        "SCP-02": "Inspect full IAM role definition for wildcard S3 permissions.",
        "SCP-03": "Verify export-worker-03 was solitary executor.",
        "SCP-04": "Audit STS temporary token lifespans and rotate.",
        "SCP-05": "Request external partner SFTP transfer server records.",
        "SCP-06": "Attribute incident to lack of peer review on commit a94f2b1.",
      },
      selectedRecoveryStepIds: ["REC-01", "REC-02", "REC-03", "REC-04", "REC-05"],
      recoveryPlanRationale:
        "Restricted whitelist configuration deployed to staging VPC with canary monitoring prior to production cron.",
    },
    phase4: {
      decisionId: "DEC-OPT-01",
      classifications: {
        "FH-01": "confirmed_fact",
        "FH-02": "confirmed_fact",
        "FH-03": "confirmed_fact",
        "FH-04": "reasonable_hypothesis",
        "FH-05": "reasonable_hypothesis",
        "FH-06": "unresolved_question",
        "FH-07": "unresolved_question",
        "FH-08": "unsupported_claim",
        "FH-09": "unsupported_claim",
        "FH-10": "unsupported_claim",
      },
      decisionRationale:
        "External network flows showed no transmission and artifact remained in internal staging; external breach is unproven.",
      nextInvestigationSteps:
        "Reconcile partner SFTP transfer logs and perform upstream ISP flow correlations.",
    },
  };

  it("calculates maximum score (100 pts) for a perfect defensible response", () => {
    const score = calculateIncidentResponseScore(perfectState);
    expect(score.containmentScore).toBe(20);
    expect(score.preservationScore).toBe(20);
    expect(score.scopeScore).toBe(20);
    expect(score.decisionScore).toBe(20);
    expect(score.reportScore).toBe(20);
    expect(score.total).toBe(100);
    expect(score.hasDestructiveActions).toBe(false);
    expect(score.hasDisproportionateShutdown).toBe(false);
    expect(score.hasUnsafeRecovery).toBe(false);
    expect(score.declaredPrematureBreach).toBe(false);
  });

  it("penalizes destructive containment actions and flags evidence spoliation", () => {
    const stateWithDestruction: IncidentResponseState = {
      ...perfectState,
      phase1: {
        ...perfectState.phase1,
        selectedActionIds: ["ACT-01", "ACT-07", "ACT-08"], // Deleting artifact + wiping host
      },
    };

    const score = calculateIncidentResponseScore(stateWithDestruction);
    expect(score.hasDestructiveActions).toBe(true);
    // ACT-01 = +4, ACT-07 = -10, ACT-08 = -10 => 0 (clamped)
    expect(score.containmentScore).toBe(0);
    expect(score.total).toBe(80);
  });

  it("penalizes disproportionate company-wide shutdown", () => {
    const stateWithDisprop: IncidentResponseState = {
      ...perfectState,
      phase1: {
        ...perfectState.phase1,
        selectedActionIds: ["ACT-01", "ACT-02", "ACT-06"], // Disproportionate shutdown
      },
    };

    const score = calculateIncidentResponseScore(stateWithDisprop);
    expect(score.hasDisproportionateShutdown).toBe(true);
    // Appropriate = 2 * 4 = 8, ACT-06 = -6 => 2
    expect(score.containmentScore).toBe(2);
  });

  it("penalizes unsafe recovery step REC-06", () => {
    const stateWithUnsafeRecovery: IncidentResponseState = {
      ...perfectState,
      phase3: {
        ...perfectState.phase3,
        selectedRecoveryStepIds: ["REC-01", "REC-02", "REC-06"],
      },
    };

    const score = calculateIncidentResponseScore(stateWithUnsafeRecovery);
    expect(score.hasUnsafeRecovery).toBe(true);
    // REC-06 deducts 6 points
    expect(score.scopeScore).toBeLessThan(20);
  });

  it("deducts points when declaring confirmed external data exfiltration without evidence", () => {
    const stateWithPrematureBreach: IncidentResponseState = {
      ...perfectState,
      phase4: {
        ...perfectState.phase4,
        decisionId: "DEC-OPT-02", // False external theft claim
      },
    };

    const score = calculateIncidentResponseScore(stateWithPrematureBreach);
    expect(score.declaredPrematureBreach).toBe(true);
    expect(score.decisionScore).toBe(10); // Misses optimal decision +10 pts
  });
});

describe("Stage 5 — IncidentResponse UI & Interaction", () => {
  it("renders Phase 1 and enforces validation before advancing", () => {
    const onComplete = vi.fn();
    render(<IncidentResponse done={false} onComplete={onComplete} />);

    // Header check
    expect(screen.getByText("THE GLASSHOUSE RESPONSE WORKSPACE")).toBeInTheDocument();
    expect(screen.getByText("PHASE 01 — IMMEDIATE CONTAINMENT")).toBeInTheDocument();

    const proceedButton = screen.getByRole("button", {
      name: /PROCEED TO EVIDENCE PRESERVATION/i,
    });
    // Initially justification is empty so button is disabled
    expect(proceedButton).toBeDisabled();

    // Type sufficient justification
    const textarea = screen.getByPlaceholderText(
      /Explain why your selected containment actions protect the environment/i,
    );
    fireEvent.change(textarea, {
      target: {
        value: "Targeted suspension of ExportBridge cron and wildcard IAM scoping.",
      },
    });

    // Button should now be enabled
    expect(proceedButton).not.toBeDisabled();
  });

  it("navigates through phases and retains user responses across transitions", async () => {
    const onComplete = vi.fn();
    render(<IncidentResponse done={false} onComplete={onComplete} />);

    // --- Phase 1 ---
    const p1Textarea = screen.getByPlaceholderText(
      /Explain why your selected containment actions protect the environment/i,
    );
    fireEvent.change(p1Textarea, {
      target: { value: "Carefully calibrated containment preventing job execution." },
    });
    fireEvent.click(screen.getByRole("button", { name: /PROCEED TO EVIDENCE PRESERVATION/i }));

    // --- Phase 2 ---
    expect(screen.getByText("PHASE 02 — EVIDENCE PRESERVATION")).toBeInTheDocument();
    const p2Textarea = screen.getByPlaceholderText(/Record timestamping, write-blocking/i);
    fireEvent.change(p2Textarea, {
      target: { value: "Full SHA-256 cryptographic verification of vault storage and auth logs." },
    });
    fireEvent.click(screen.getByRole("button", { name: /PROCEED TO SCOPE & RECOVERY/i }));

    // --- Phase 3 ---
    expect(screen.getByText("PHASE 03 — SCOPE & RECOVERY")).toBeInTheDocument();
    const p3Textarea = screen.getByPlaceholderText(/Outline the staged re-enablement plan/i);
    fireEvent.change(p3Textarea, {
      target: { value: "Enforce explicit path whitelist and canary monitoring before production." },
    });
    fireEvent.click(screen.getByRole("button", { name: /PROCEED TO RESPONSE DECISION/i }));

    // --- Phase 4 ---
    expect(screen.getByText("PHASE 04 — RESPONSE DECISION")).toBeInTheDocument();

    // Classify at least 8 items
    const factButtons = screen.getAllByRole("button", { name: /^Fact$/i });
    for (let i = 0; i < 8; i++) {
      fireEvent.click(factButtons[i]!);
    }

    const p4Decision = screen.getByPlaceholderText(
      /Explain why declaring external breach is premature/i,
    );
    fireEvent.change(p4Decision, {
      target: { value: "Internal staging established; zero egress flow corroboration." },
    });
    const p4Steps = screen.getByPlaceholderText(/Specify external partner log requests/i);
    fireEvent.change(p4Steps, {
      target: { value: "Request partner SFTP transmission logs." },
    });

    // Submit response from Phase 4 directly to completion
    fireEvent.click(
      screen.getByRole("button", { name: /COMPLETE INVESTIGATION & SUBMIT RESPONSE/i }),
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));

    // --- Completion Screen ---
    expect(screen.getByText(/INCIDENT RESPONSE SCORE BREAKDOWN/i)).toBeInTheDocument();
    expect(screen.getByText(/THE GLASSHOUSE INCIDENT — RESPONSE COMPLETE/i)).toBeInTheDocument();
    expect(screen.getByText(/REF: IR-2026-BF007-FINAL/i)).toBeInTheDocument();
    expect(screen.getByText(/CASE 07 INVESTIGATION & RESPONSE COMPLETE/i)).toBeInTheDocument();

    // Verify navigating backwards preserves inputs
    fireEvent.click(screen.getByRole("button", { name: /BACK TO DECISION/i }));
    expect(screen.getByText("PHASE 04 — RESPONSE DECISION")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Request partner SFTP transmission logs.")).toBeInTheDocument();
  });

  it("supports initialPhase prop for direct review of completion results", () => {
    const onComplete = vi.fn();
    render(<IncidentResponse done={true} onComplete={onComplete} initialPhase={5} />);

    expect(screen.getByText(/THE GLASSHOUSE INCIDENT — RESPONSE COMPLETE/i)).toBeInTheDocument();
    expect(screen.getAllByText(/CASE CONCLUDED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/CASE 07 INVESTIGATION & RESPONSE COMPLETE/i)).toBeInTheDocument();
  });

  it("handles reset stage confirmation workflow", () => {
    const onComplete = vi.fn();
    render(<IncidentResponse done={false} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: /RESET STAGE/i }));
    expect(screen.getByText("Confirm Stage 5 Reset")).toBeInTheDocument();

    // Cancel reset
    fireEvent.click(screen.getByRole("button", { name: /CANCEL/i }));
    expect(screen.queryByText("Confirm Stage 5 Reset")).not.toBeInTheDocument();

    // Trigger reset and confirm
    fireEvent.click(screen.getByRole("button", { name: /RESET STAGE/i }));
    fireEvent.click(screen.getByRole("button", { name: /CONFIRM RESET/i }));

    expect(screen.queryByText("Confirm Stage 5 Reset")).not.toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Selected: 0 actions"),
    ).toBeInTheDocument();
  });
});
