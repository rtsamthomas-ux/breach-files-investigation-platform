import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Send,
  ChevronRight,
  ChevronLeft,
  Info,
  Check,
} from "lucide-react";
import {
  CONTAINMENT_ACTIONS,
  PRESERVATION_SOURCES,
  SCOPE_QUESTIONS,
  FACT_HYPOTHESIS_ITEMS,
  RESPONSE_DECISION_OPTIONS,
  SAFE_RECOVERY_STEPS,
  calculateIncidentResponseScore,
} from "../lib/stage5-response";
import { submitStageServerFn } from "../api/submissions";

type Phase = 1 | 2 | 3 | 4 | "completion";

interface Phase1State {
  selectedActionIds: string[];
  actionPriorities: Record<string, "immediate" | "secondary">;
  justification: string;
}

interface Phase2State {
  selectedSourceIds: string[];
  sourcePriorities: Record<string, 1 | 2 | 3 | 4>;
  custodian: string;
  acquisitionMethod: string;
  evidenceLockerLocation: string;
  chainOfCustodyNotes: string;
}

interface Phase3State {
  scopeResponses: Record<string, string>;
  selectedRecoveryStepIds: string[];
  recoveryPlanRationale: string;
}

interface Phase4State {
  decisionId: string;
  classifications: Record<string, string>;
  decisionRationale: string;
  nextInvestigationSteps: string;
}

export function IncidentResponse({
  done,
  authToken,
  onComplete,
  initialPhase = 1,
}: {
  done: boolean;
  authToken?: string | undefined;
  onComplete: () => void;
  initialPhase?: Phase | 5;
}) {
  const normalizedInitial: Phase = initialPhase === 5 ? "completion" : initialPhase;
  const [currentPhase, setCurrentPhase] = useState<Phase>(normalizedInitial);
  const [highestVisitedPhase, setHighestVisitedPhase] = useState<number>(
    done ? 5 : normalizedInitial === "completion" ? 5 : normalizedInitial,
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(done);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phase 1 State
  const [phase1, setPhase1] = useState<Phase1State>({
    selectedActionIds: ["ACT-01", "ACT-02"],
    actionPriorities: {
      "ACT-01": "immediate",
      "ACT-02": "immediate",
    },
    justification: "",
  });

  // Phase 2 State
  const [phase2, setPhase2] = useState<Phase2State>({
    selectedSourceIds: ["SRC-01", "SRC-02", "SRC-03", "SRC-04"],
    sourcePriorities: {
      "SRC-01": 1,
      "SRC-02": 1,
      "SRC-03": 1,
      "SRC-04": 1,
    },
    custodian: "Incident Response Lead (SecOps)",
    acquisitionMethod: "Read-only snapshot with SHA-256 verification and container log freeze",
    evidenceLockerLocation: "Forensic Storage Vault / S3 read-only legal-hold enclave",
    chainOfCustodyNotes: "",
  });

  // Phase 3 State
  const [phase3, setPhase3] = useState<Phase3State>({
    scopeResponses: {
      "SCP-01": "Audit all access under /projects/* during config v17 deployment window.",
      "SCP-02": "Enforce container-level IAM boundaries and remove broad S3 permissions.",
      "SCP-03": "Verify export-worker-03 was the solitary container executing job EB-2041.",
      "SCP-04": "Confirm STS instance profile used; rotate temporary session credentials.",
      "SCP-05": "Correlate border gateway flow logs and request partner SFTP transfer records.",
      "SCP-06":
        "Attribute incident to lack of peer review on commit a94f2b1 and overly broad wildcard.",
    },
    selectedRecoveryStepIds: ["REC-01", "REC-02", "REC-03", "REC-04", "REC-05"],
    recoveryPlanRationale: "",
  });

  // Phase 4 State
  const [phase4, setPhase4] = useState<Phase4State>({
    decisionId: "DEC-OPT-01",
    classifications: {},
    decisionRationale: "",
    nextInvestigationSteps: "",
  });

  // Validation checks per phase
  const isPhase1Valid = useMemo(() => {
    return phase1.selectedActionIds.length >= 2 && phase1.justification.trim().length >= 20;
  }, [phase1]);

  const isPhase2Valid = useMemo(() => {
    return (
      phase2.selectedSourceIds.length >= 3 &&
      phase2.custodian.trim().length >= 3 &&
      phase2.chainOfCustodyNotes.trim().length >= 15
    );
  }, [phase2]);

  const isPhase3Valid = useMemo(() => {
    const answeredCount = Object.values(phase3.scopeResponses).filter(
      (v) => v && v.trim().length >= 10,
    ).length;
    return (
      answeredCount >= 4 &&
      phase3.selectedRecoveryStepIds.length >= 2 &&
      phase3.recoveryPlanRationale.trim().length >= 15
    );
  }, [phase3]);

  const isPhase4Valid = useMemo(() => {
    const classifiedCount = Object.values(phase4.classifications).filter(Boolean).length;
    return (
      Boolean(phase4.decisionId) &&
      classifiedCount >= 8 &&
      phase4.decisionRationale.trim().length >= 15 &&
      phase4.nextInvestigationSteps.trim().length >= 10
    );
  }, [phase4]);

  const isPhaseValid = (phaseNum: number) => {
    if (phaseNum === 1) return isPhase1Valid;
    if (phaseNum === 2) return isPhase2Valid;
    if (phaseNum === 3) return isPhase3Valid;
    if (phaseNum === 4) return isPhase4Valid;
    return true;
  };

  const getPhaseNumber = (phase: Phase): number => {
    return phase === "completion" ? 5 : phase;
  };

  // Navigate to phase with unlocked rules
  const navigateToPhase = (target: Phase) => {
    const targetNum = getPhaseNumber(target);
    const currentNum = getPhaseNumber(currentPhase);
    const canAdvance = targetNum === currentNum + 1 && isPhaseValid(currentNum);
    if (done || isSubmitted || targetNum <= highestVisitedPhase || canAdvance) {
      setCurrentPhase(target);
      if (targetNum > highestVisitedPhase) {
        setHighestVisitedPhase(targetNum);
      }
    }
  };

  // Scoring calculation (Max 100)
  const scoreBreakdown = useMemo(() => {
    return calculateIncidentResponseScore({ phase1, phase2, phase3, phase4 });
  }, [phase1, phase2, phase3, phase4]);

  const submitResponse = async () => {
    if (!isPhase4Valid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionMessage("");
    try {
      const result = await submitStageServerFn({
        data: {
          stageId: 5,
          authToken,
          payload: { phase1, phase2, phase3, phase4 },
        },
      });
      setSubmissionMessage(
        !result.success
          ? result.remarks
          : result.persistedToSupabase
            ? `Response verified and saved (${result.score}/100).`
            : `Response verified (${result.score}/100). Sign in and configure Supabase to save progress.`,
      );
      if (result.success && result.passed) {
        setIsSubmitted(true);
        setHighestVisitedPhase(5);
        setCurrentPhase("completion");
        onComplete();
      } else if (result.success) {
        setSubmissionMessage(
          `Response did not meet the server pass threshold (${result.score}/100). Revise and submit again.`,
        );
      }
    } catch {
      setSubmissionMessage("Server verification failed. Please retry your response.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAll = () => {
    setPhase1({
      selectedActionIds: [],
      actionPriorities: {},
      justification: "",
    });
    setPhase2({
      selectedSourceIds: [],
      sourcePriorities: {},
      custodian: "",
      acquisitionMethod: "",
      evidenceLockerLocation: "",
      chainOfCustodyNotes: "",
    });
    setPhase3({
      scopeResponses: {},
      selectedRecoveryStepIds: [],
      recoveryPlanRationale: "",
    });
    setPhase4({
      decisionId: "",
      classifications: {},
      decisionRationale: "",
      nextInvestigationSteps: "",
    });
    setCurrentPhase(1);
    setHighestVisitedPhase(1);
    setIsSubmitted(false);
    setShowResetConfirm(false);
  };

  const phases = [
    { num: 1 as const, label: "Immediate Containment", short: "01 Containment" },
    { num: 2 as const, label: "Evidence Preservation", short: "02 Preservation" },
    { num: 3 as const, label: "Scope & Recovery", short: "03 Scope & Recovery" },
    { num: 4 as const, label: "Response Decision", short: "04 Response Decision" },
    ...(isSubmitted || done || currentPhase === "completion"
      ? [{ num: 5 as const, label: "Score & Completion", short: "05 Results" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-400">
                CASE 07 - STAGE 05
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                INCIDENT RESPONSE & REMEDIATION
              </span>
            </div>
            <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
              THE GLASSHOUSE RESPONSE WORKSPACE
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-zinc-700 hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              RESET STAGE
            </button>
            {done && (
              <span className="flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                CASE CONCLUDED
              </span>
            )}
          </div>
        </div>

        {/* Established Findings Banner */}
        <div className="mt-4 border-l-2 border-emerald-500 bg-emerald-950/20 p-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="font-mono text-xs leading-relaxed text-muted-foreground">
              <span className="font-bold text-foreground">Established Case Findings: </span>
              The service identity <code className="text-emerald-300">svc-exportbridge</code> was
              overprivileged under configuration v17. The automated job accessed the Glasshouse
              roadmap and staged package <code className="text-emerald-300">PKG-8842</code>. Staged
              hash matches acquired artifact. Working copy hash differences were proven to be benign
              tar metadata.{" "}
              <span className="font-bold text-amber-300">
                External egress and deliberate human intent have NOT been established.
              </span>
            </div>
          </div>
        </div>

        {/* Phase Stepper Bar */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {phases.map((p) => {
            const isCurrent =
              currentPhase === p.num || (p.num === 5 && currentPhase === "completion");
            const isCompleted = getPhaseNumber(currentPhase) > p.num;
            const isClickable =
              done ||
              isSubmitted ||
              p.num <= highestVisitedPhase ||
              (p.num === getPhaseNumber(currentPhase) + 1 &&
                isPhaseValid(getPhaseNumber(currentPhase)));

            return (
              <button
                key={p.num}
                onClick={() =>
                  isClickable && navigateToPhase(p.num === 5 ? "completion" : (p.num as Phase))
                }
                disabled={!isClickable}
                className={`flex items-center gap-2 border p-2.5 text-left transition-all ${
                  isCurrent
                    ? "border-emerald-500 bg-emerald-950/30 text-emerald-300"
                    : isCompleted
                      ? "border-emerald-500/40 bg-zinc-900/60 text-zinc-300 hover:border-emerald-500/70"
                      : isClickable
                        ? "border-zinc-800 bg-zinc-900/30 text-muted-foreground hover:border-zinc-700 hover:text-foreground"
                        : "cursor-not-allowed border-zinc-900 bg-black/40 text-zinc-600 opacity-60"
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center font-mono text-xs font-bold ${
                    isCurrent
                      ? "bg-emerald-500 text-black"
                      : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : p.num}
                </div>
                <div className="truncate">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Phase 0{p.num}
                  </div>
                  <div className="truncate font-mono text-xs font-bold">{p.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-md border border-red-500/50 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
                Confirm Stage 5 Reset
              </h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Are you sure you want to reset all responses, selections, and drafts in Stage 5? This
              will revert all five phases to an empty draft state.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="border border-zinc-800 bg-zinc-900 px-4 py-2 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                CANCEL
              </button>
              <button
                onClick={resetAll}
                className="bg-red-600 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-red-500"
              >
                CONFIRM RESET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHASE 1: IMMEDIATE CONTAINMENT */}
      {/* ========================================================= */}
      {currentPhase === 1 && (
        <div className="space-y-6">
          <div className="border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
                  PHASE 01 — IMMEDIATE CONTAINMENT
                </span>
                <h2 className="mt-1 font-mono text-xl font-bold tracking-tight text-foreground">
                  CONTAINMENT ACTION SELECTION & PRIORITIZATION
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Select and prioritize immediate tactical actions. Forensic containment must halt
                  ongoing risk without destroying critical evidence or inflicting disproportionate
                  damage on legitimate business operations.
                </p>
              </div>

              {/* Status pill */}
              <div
                className={`rounded border px-3 py-1 font-mono text-xs ${
                  isPhase1Valid
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                }`}
              >
                {isPhase1Valid ? "Phase 1 Complete" : "Requirements Incomplete"}
              </div>
            </div>

            {/* Warning if destructive or disproportionate actions selected */}
            {(phase1.selectedActionIds.includes("ACT-07") ||
              phase1.selectedActionIds.includes("ACT-08")) && (
              <div className="mt-4 border-l-2 border-red-500 bg-red-950/30 p-3">
                <div className="flex items-start gap-2 text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="font-mono text-xs">
                    <span className="font-bold">CRITICAL FORENSIC WARNING:</span> You have selected
                    one or more destructive actions (e.g. deleting the staged package or wiping the
                    worker host). In digital forensics, deleting artifacts or formatting running
                    systems causes irrevocable evidence spoliation and will severely penalize your
                    incident response assessment.
                  </div>
                </div>
              </div>
            )}

            {phase1.selectedActionIds.includes("ACT-06") && (
              <div className="mt-3 border-l-2 border-amber-500 bg-amber-950/30 p-3">
                <div className="flex items-start gap-2 text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="font-mono text-xs">
                    <span className="font-bold">DISPROPORTIONATE IMPACT WARNING:</span> Shutting
                    down all corporate exports across every division creates massive commercial
                    injury unsupported by the evidence, which isolates the issue specifically to
                    ExportBridge configuration v17.
                  </div>
                </div>
              </div>
            )}

            {/* Action Cards Grid */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {CONTAINMENT_ACTIONS.map((action) => {
                const isSelected = phase1.selectedActionIds.includes(action.id);
                const priority = phase1.actionPriorities[action.id] || "immediate";

                return (
                  <div
                    key={action.id}
                    onClick={() => {
                      setPhase1((prev) => {
                        const exists = prev.selectedActionIds.includes(action.id);
                        const nextIds = exists
                          ? prev.selectedActionIds.filter((id) => id !== action.id)
                          : [...prev.selectedActionIds, action.id];

                        const nextPriorities = { ...prev.actionPriorities };
                        if (!exists && !nextPriorities[action.id]) {
                          nextPriorities[action.id] = "immediate";
                        }

                        return {
                          ...prev,
                          selectedActionIds: nextIds,
                          actionPriorities: nextPriorities,
                        };
                      });
                    }}
                    className={`cursor-pointer border p-4 transition-all ${
                      isSelected
                        ? action.category === "destructive"
                          ? "border-red-500 bg-red-950/20"
                          : action.category === "disproportionate"
                            ? "border-amber-500 bg-amber-950/20"
                            : "border-emerald-500 bg-emerald-950/20"
                        : "border-border bg-card/60 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-5 w-5 items-center justify-center border font-mono text-[10px] ${
                            isSelected
                              ? action.category === "destructive"
                                ? "border-red-500 bg-red-500 text-white"
                                : action.category === "disproportionate"
                                  ? "border-amber-500 bg-amber-500 text-black"
                                  : "border-emerald-500 bg-emerald-500 text-black"
                              : "border-zinc-700 text-transparent"
                          }`}
                        >
                          ✓
                        </div>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {action.id}
                        </span>
                      </div>

                      <span
                        className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                          action.category === "appropriate"
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : action.category === "disproportionate"
                              ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                              : "border-red-500/30 text-red-400 bg-red-500/10"
                        }`}
                      >
                        {action.category}
                      </span>
                    </div>

                    <h3 className="mt-2.5 font-mono text-sm font-bold text-foreground">
                      {action.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {action.description}
                    </p>

                    <div className="mt-3 border-t border-border/60 pt-2.5 font-mono text-[11px] text-zinc-400">
                      <span className="text-zinc-500">Forensic Impact: </span>
                      {action.forensicImpact}
                    </div>

                    {/* Priority selection if selected */}
                    {isSelected && (
                      <div
                        className="mt-3 flex items-center justify-between border-t border-border/80 pt-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Execution Priority:
                        </span>
                        <div className="flex gap-1.5">
                          {(["immediate", "secondary"] as const).map((pVal) => (
                            <button
                              key={pVal}
                              onClick={() => {
                                setPhase1((prev) => ({
                                  ...prev,
                                  actionPriorities: {
                                    ...prev.actionPriorities,
                                    [action.id]: pVal,
                                  },
                                }));
                              }}
                              className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider border ${
                                priority === pVal
                                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold"
                                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              {pVal}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Justification Text Area */}
            <div className="mt-6">
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Containment Justification & Tactical Rationale{" "}
                <span className="text-emerald-400">*</span>
              </label>
              <textarea
                value={phase1.justification}
                onChange={(e) => setPhase1((prev) => ({ ...prev, justification: e.target.value }))}
                placeholder="Explain why your selected containment actions protect the environment, prevent evidence spoliation, and maintain operational stability..."
                rows={3}
                className="mt-2 w-full border border-border bg-black/50 p-3 font-mono text-xs text-foreground placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>Minimum 20 characters required.</span>
                <span>{phase1.justification.trim().length} chars</span>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <div className="font-mono text-xs text-muted-foreground">
                Selected: <span className="text-foreground">{phase1.selectedActionIds.length}</span>{" "}
                actions
              </div>
              <button
                onClick={() => navigateToPhase(2)}
                disabled={!isPhase1Valid}
                className="flex items-center gap-2 bg-emerald-600 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                PROCEED TO EVIDENCE PRESERVATION
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHASE 2: EVIDENCE PRESERVATION */}
      {/* ========================================================= */}
      {currentPhase === 2 && (
        <div className="space-y-6">
          <div className="border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
                  PHASE 02 — EVIDENCE PRESERVATION
                </span>
                <h2 className="mt-1 font-mono text-xl font-bold tracking-tight text-foreground">
                  FORENSIC DATA PRESERVATION & CHAIN OF CUSTODY
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Identify and prioritize the technical sources that must be preserved before any
                  configuration changes or system cleanups occur. Record chain-of-custody metadata
                  including acquisition methods and cryptographic hashes.
                </p>
              </div>

              <div
                className={`rounded border px-3 py-1 font-mono text-xs ${
                  isPhase2Valid
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                }`}
              >
                {isPhase2Valid ? "Phase 2 Complete" : "Requirements Incomplete"}
              </div>
            </div>

            {/* Preservation Sources Grid */}
            <div className="mt-6 space-y-3">
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Select Evidence Sources to Preserve & Assign Collection Priority:
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {PRESERVATION_SOURCES.map((source) => {
                  const isSelected = phase2.selectedSourceIds.includes(source.id);
                  const priority = phase2.sourcePriorities[source.id] || 2;

                  return (
                    <div
                      key={source.id}
                      onClick={() => {
                        setPhase2((prev) => {
                          const exists = prev.selectedSourceIds.includes(source.id);
                          const nextIds = exists
                            ? prev.selectedSourceIds.filter((id) => id !== source.id)
                            : [...prev.selectedSourceIds, source.id];

                          const nextPriorities = { ...prev.sourcePriorities };
                          if (!exists && !nextPriorities[source.id]) {
                            nextPriorities[source.id] = source.recommendedPriority;
                          }

                          return {
                            ...prev,
                            selectedSourceIds: nextIds,
                            sourcePriorities: nextPriorities,
                          };
                        });
                      }}
                      className={`cursor-pointer border p-3.5 transition-all ${
                        isSelected
                          ? source.category === "distractor"
                            ? "border-amber-500/70 bg-amber-950/20"
                            : "border-emerald-500 bg-emerald-950/20"
                          : "border-border bg-card/60 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-4 w-4 items-center justify-center border font-mono text-[9px] ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-500 text-black font-bold"
                                : "border-zinc-700 text-transparent"
                            }`}
                          >
                            ✓
                          </div>
                          <span className="font-mono text-xs font-bold text-foreground">
                            {source.id}
                          </span>
                        </div>

                        <span
                          className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${
                            source.category === "critical"
                              ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                              : source.category === "high"
                                ? "border-cyan-500/40 text-cyan-300 bg-cyan-500/10"
                                : "border-zinc-700 text-zinc-500 bg-zinc-900"
                          }`}
                        >
                          {source.category}
                        </span>
                      </div>

                      <h4 className="mt-2 font-mono text-xs font-bold text-foreground">
                        {source.sourceName}
                      </h4>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                        {source.description}
                      </p>

                      <div className="mt-2 text-[10px] font-mono text-zinc-400">
                        <span className="text-zinc-500">Host/System: </span>
                        {source.system}
                      </div>

                      {/* Priority Selector */}
                      {isSelected && (
                        <div
                          className="mt-3 flex items-center justify-between border-t border-border/80 pt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Priority:
                          </span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((pNum) => (
                              <button
                                key={pNum}
                                onClick={() => {
                                  setPhase2((prev) => ({
                                    ...prev,
                                    sourcePriorities: {
                                      ...prev.sourcePriorities,
                                      [source.id]: pNum as 1 | 2 | 3 | 4,
                                    },
                                  }));
                                }}
                                className={`px-2 py-0.5 font-mono text-[10px] border ${
                                  priority === pNum
                                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold"
                                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                                }`}
                              >
                                P{pNum}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chain of Custody Form */}
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Chain of Custody Protocol & Evidence Integrity Log
              </h3>

              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Evidence Custodian / Lead
                  </label>
                  <input
                    type="text"
                    value={phase2.custodian}
                    onChange={(e) => setPhase2((prev) => ({ ...prev, custodian: e.target.value }))}
                    className="mt-1.5 w-full border border-border bg-black/50 p-2 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. Lead IR Investigator"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Acquisition & Hash Method
                  </label>
                  <input
                    type="text"
                    value={phase2.acquisitionMethod}
                    onChange={(e) =>
                      setPhase2((prev) => ({ ...prev, acquisitionMethod: e.target.value }))
                    }
                    className="mt-1.5 w-full border border-border bg-black/50 p-2 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. Bitstream image, SHA-256 seal"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Secure Storage / Evidence Locker
                  </label>
                  <input
                    type="text"
                    value={phase2.evidenceLockerLocation}
                    onChange={(e) =>
                      setPhase2((prev) => ({
                        ...prev,
                        evidenceLockerLocation: e.target.value,
                      }))
                    }
                    className="mt-1.5 w-full border border-border bg-black/50 p-2 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. Forensic Vault S3 read-only legal hold"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Chain-of-Custody Considerations & Integrity Measures{" "}
                  <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  value={phase2.chainOfCustodyNotes}
                  onChange={(e) =>
                    setPhase2((prev) => ({ ...prev, chainOfCustodyNotes: e.target.value }))
                  }
                  placeholder="Record timestamping, write-blocking mechanisms, pre/post acquisition hashes, and access restrictions to ensure court/audit admissibility..."
                  rows={3}
                  className="mt-1.5 w-full border border-border bg-black/50 p-3 font-mono text-xs text-foreground placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>Minimum 15 characters required.</span>
                  <span>{phase2.chainOfCustodyNotes.trim().length} chars</span>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <button
                onClick={() => navigateToPhase(1)}
                className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> BACK TO CONTAINMENT
              </button>

              <button
                onClick={() => navigateToPhase(3)}
                disabled={!isPhase2Valid}
                className="flex items-center gap-2 bg-emerald-600 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                PROCEED TO SCOPE & RECOVERY
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHASE 3: SCOPE & RECOVERY */}
      {/* ========================================================= */}
      {currentPhase === 3 && (
        <div className="space-y-6">
          <div className="border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
                  PHASE 03 — SCOPE & RECOVERY
                </span>
                <h2 className="mt-1 font-mono text-xl font-bold tracking-tight text-foreground">
                  BLAST RADIUS DETERMINATION & RECOVERY PLAN
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Determine what systems and repositories require scoping before recovery can be
                  approved. Formulate a validated recovery plan enforcing least-privilege policies.
                </p>
              </div>

              <div
                className={`rounded border px-3 py-1 font-mono text-xs ${
                  isPhase3Valid
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                }`}
              >
                {isPhase3Valid ? "Phase 3 Complete" : "Requirements Incomplete"}
              </div>
            </div>

            {/* Scope Questions */}
            <div className="mt-6 space-y-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Investigative Scope Assessment (Address Key Blast-Radius Dimensions)
              </h3>

              <div className="space-y-3">
                {SCOPE_QUESTIONS.map((item) => (
                  <div key={item.id} className="border border-border bg-card/60 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {item.id}: {item.topic}
                      </span>
                    </div>

                    <p className="mt-1 font-mono text-xs text-foreground font-semibold">
                      {item.question}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{item.guidance}</p>

                    <div className="mt-2">
                      <input
                        type="text"
                        value={phase3.scopeResponses[item.id] || ""}
                        onChange={(e) =>
                          setPhase3((prev) => ({
                            ...prev,
                            scopeResponses: {
                              ...prev.scopeResponses,
                              [item.id]: e.target.value,
                            },
                          }))
                        }
                        placeholder="Detail specific scoping steps, log filters, or audit queries..."
                        className="w-full border border-border bg-black/60 p-2 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Safe Recovery Plan Steps */}
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Safe Recovery Plan Formulation
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Select the technical controls and validation procedures that must be verified prior
                to restoring the export workflow:
              </p>

              {phase3.selectedRecoveryStepIds.includes("REC-06") && (
                <div className="mt-3 border-l-2 border-red-500 bg-red-950/30 p-2.5 font-mono text-xs text-red-400">
                  <span className="font-bold">DANGEROUS RECOVERY STEP:</span> Resuming scheduled
                  cron jobs before permissions are tested and validated re-exposes sensitive
                  projects to automated staging.
                </div>
              )}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {SAFE_RECOVERY_STEPS.map((step) => {
                  const isSelected = phase3.selectedRecoveryStepIds.includes(step.id);

                  return (
                    <div
                      key={step.id}
                      onClick={() => {
                        setPhase3((prev) => {
                          const exists = prev.selectedRecoveryStepIds.includes(step.id);
                          return {
                            ...prev,
                            selectedRecoveryStepIds: exists
                              ? prev.selectedRecoveryStepIds.filter((id) => id !== step.id)
                              : [...prev.selectedRecoveryStepIds, step.id],
                          };
                        });
                      }}
                      className={`cursor-pointer border p-3 transition-all ${
                        isSelected
                          ? !step.recommended
                            ? "border-red-500 bg-red-950/20"
                            : "border-emerald-500 bg-emerald-950/20"
                          : "border-border bg-card/60 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-4 w-4 items-center justify-center border font-mono text-[9px] ${
                            isSelected
                              ? !step.recommended
                                ? "border-red-500 bg-red-500 text-white font-bold"
                                : "border-emerald-500 bg-emerald-500 text-black font-bold"
                              : "border-zinc-700 text-transparent"
                          }`}
                        >
                          ✓
                        </div>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {step.title}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Recovery Validation Rationale & Phased Rollout Plan{" "}
                  <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  value={phase3.recoveryPlanRationale}
                  onChange={(e) =>
                    setPhase3((prev) => ({
                      ...prev,
                      recoveryPlanRationale: e.target.value,
                    }))
                  }
                  placeholder="Outline the staged re-enablement plan, synthetic testing criteria, and SIEM monitoring alarms..."
                  rows={3}
                  className="mt-1.5 w-full border border-border bg-black/50 p-3 font-mono text-xs text-foreground placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>Minimum 15 characters required.</span>
                  <span>{phase3.recoveryPlanRationale.trim().length} chars</span>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <button
                onClick={() => navigateToPhase(2)}
                className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> BACK TO PRESERVATION
              </button>

              <button
                onClick={() => navigateToPhase(4)}
                disabled={!isPhase3Valid}
                className="flex items-center gap-2 bg-emerald-600 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                PROCEED TO RESPONSE DECISION
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHASE 4: RESPONSE DECISION */}
      {/* ========================================================= */}
      {currentPhase === 4 && (
        <div className="space-y-6">
          <div className="border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
                  PHASE 04 — RESPONSE DECISION
                </span>
                <h2 className="mt-1 font-mono text-xl font-bold tracking-tight text-foreground">
                  EXFILTRATION DETERMINATION & FACTUAL BOUNDARIES
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Make the core incident response decision: Should NovaCorp publicly declare
                  confirmed external data exfiltration? Distinguish verified facts from hypotheses,
                  unresolved questions, and unsupported claims.
                </p>
              </div>

              <div
                className={`rounded border px-3 py-1 font-mono text-xs ${
                  isPhase4Valid
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                }`}
              >
                {isPhase4Valid ? "Phase 4 Complete" : "Requirements Incomplete"}
              </div>
            </div>

            {/* Core Decision Point */}
            <div className="mt-6 space-y-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Critical Incident Declaration Decision:
              </h3>

              <div className="space-y-3">
                {RESPONSE_DECISION_OPTIONS.map((opt) => {
                  const isSelected = phase4.decisionId === opt.id;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => setPhase4((prev) => ({ ...prev, decisionId: opt.id }))}
                      className={`cursor-pointer border p-4 transition-all ${
                        isSelected
                          ? opt.isOptimal
                            ? "border-emerald-500 bg-emerald-950/30"
                            : "border-amber-500 bg-amber-950/30"
                          : "border-border bg-card/60 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-4 w-4 rounded-full border items-center justify-center ${
                              isSelected ? "border-emerald-400 bg-emerald-500" : "border-zinc-700"
                            }`}
                          >
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                          </div>
                          <span className="font-mono text-xs font-bold text-foreground">
                            {opt.label}
                          </span>
                        </div>

                        {opt.isOptimal && (
                          <span className="border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
                            Recommended Stance
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        {opt.description}
                      </p>

                      <div className="mt-2 text-[11px] font-mono text-zinc-400">
                        <span className="text-zinc-500">Legal & Operational Implications: </span>
                        {opt.implications}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Facts vs Hypotheses Matrix */}
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Distinguish Confirmed Facts, Hypotheses, Unknowns & Unsupported Claims
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Classify each of the following statements into its defensible evidentiary category:
              </p>

              <div className="mt-4 space-y-3">
                {FACT_HYPOTHESIS_ITEMS.map((item) => {
                  const currentClass = phase4.classifications[item.id] || "";

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 border border-border bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1 font-mono text-xs text-foreground">
                        <span className="text-muted-foreground mr-2">[{item.id}]</span>
                        {item.statement}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {[
                          { key: "confirmed_fact", label: "Fact", color: "emerald" },
                          { key: "reasonable_hypothesis", label: "Hypothesis", color: "cyan" },
                          { key: "unresolved_question", label: "Unresolved", color: "amber" },
                          { key: "unsupported_claim", label: "Unsupported", color: "red" },
                        ].map((cat) => {
                          const isSelected = currentClass === cat.key;
                          return (
                            <button
                              key={cat.key}
                              onClick={() => {
                                setPhase4((prev) => ({
                                  ...prev,
                                  classifications: {
                                    ...prev.classifications,
                                    [item.id]: cat.key,
                                  },
                                }));
                              }}
                              className={`px-2 py-1 font-mono text-[10px] uppercase tracking-wider border transition-colors ${
                                isSelected
                                  ? cat.color === "emerald"
                                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold"
                                    : cat.color === "cyan"
                                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold"
                                      : cat.color === "amber"
                                        ? "border-amber-500 bg-amber-500/20 text-amber-300 font-bold"
                                        : "border-red-500 bg-red-500/20 text-red-300 font-bold"
                                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rationale and Next Steps */}
            <div className="mt-6 grid gap-4 md:grid-cols-2 border-t border-border pt-5">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Decision Rationale & Legal/Forensic Justification{" "}
                  <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  value={phase4.decisionRationale}
                  onChange={(e) =>
                    setPhase4((prev) => ({
                      ...prev,
                      decisionRationale: e.target.value,
                    }))
                  }
                  placeholder="Explain why declaring external breach is premature or what evidence sets the boundaries of certainty..."
                  rows={3}
                  className="mt-1.5 w-full border border-border bg-black/50 p-2.5 font-mono text-xs text-foreground placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Highest-Priority Next Investigation Steps{" "}
                  <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  value={phase4.nextInvestigationSteps}
                  onChange={(e) =>
                    setPhase4((prev) => ({
                      ...prev,
                      nextInvestigationSteps: e.target.value,
                    }))
                  }
                  placeholder="Specify external partner log requests, ISP netflow queries, or container memory artifact inspections..."
                  rows={3}
                  className="mt-1.5 w-full border border-border bg-black/50 p-2.5 font-mono text-xs text-foreground placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <button
                onClick={() => navigateToPhase(3)}
                className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> BACK TO SCOPE & RECOVERY
              </button>

              <button
                onClick={() => void submitResponse()}
                disabled={!isPhase4Valid || isSubmitting}
                className="flex items-center gap-2 bg-emerald-500 px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-400 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {isSubmitting
                  ? "VERIFYING RESPONSE..."
                  : "COMPLETE INVESTIGATION & SUBMIT RESPONSE"}
              </button>
            </div>
            {submissionMessage && (
              <div className="mt-3 font-mono text-xs text-muted-foreground" role="status">
                {submissionMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* COMPLETION SCREEN: SCORE BREAKDOWN & CASE RESOLUTION */}
      {/* ========================================================= */}
      {currentPhase === "completion" && (
        <div className="space-y-6">
          {submissionMessage && (
            <div
              className="border border-emerald-500/30 bg-emerald-500/5 p-3 font-mono text-xs text-muted-foreground"
              role="status"
            >
              {submissionMessage}
            </div>
          )}
          {/* Completion Victory / Conclusion Banner */}
          <div className="relative overflow-hidden border border-emerald-500/40 bg-card p-6 md:p-8">
            <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-10">
              <CheckCircle2 className="h-40 w-40 text-emerald-400" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
                    INVESTIGATION CONCLUDED — CASE 07
                  </span>
                </div>
                <h1 className="mt-2 font-mono text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  THE GLASSHOUSE INCIDENT — RESPONSE COMPLETE
                </h1>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  REF: IR-2026-BF007-FINAL // CLASSIFICATION: CONFIDENTIAL // NOVACORP IR
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 border border-emerald-500/60 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  CASE CONCLUDED
                </span>
              </div>
            </div>

            {/* Score Assessment Card */}
            <div className="mt-6 border border-border bg-black/40 p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-400">
                    INCIDENT RESPONSE SCORE BREAKDOWN
                  </span>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-bold tracking-tight text-foreground">
                      {scoreBreakdown.total}
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">/ 100 PTS</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                      scoreBreakdown.total >= 85
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                        : scoreBreakdown.total >= 70
                          ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
                          : "border-amber-500 bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {scoreBreakdown.total >= 85
                      ? "EXEMPLARY FORENSIC RIGOR"
                      : scoreBreakdown.total >= 70
                        ? "DEFENSIBLE RESPONSE"
                        : "DEFICIENT IN PARTS"}
                  </span>
                </div>
              </div>

              {/* Score Category Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="border border-border bg-card/60 p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Containment
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                    {scoreBreakdown.containmentScore} / 20
                  </div>
                </div>
                <div className="border border-border bg-card/60 p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Preservation
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                    {scoreBreakdown.preservationScore} / 20
                  </div>
                </div>
                <div className="border border-border bg-card/60 p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Scope & Recovery
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                    {scoreBreakdown.scopeScore} / 20
                  </div>
                </div>
                <div className="border border-border bg-card/60 p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Decision Rigor
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                    {scoreBreakdown.decisionScore} / 20
                  </div>
                </div>
                <div className="border border-border bg-card/60 p-3">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    Report Quality
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                    {scoreBreakdown.reportScore} / 20
                  </div>
                </div>
              </div>

              {/* Specific feedback callouts */}
              <div className="mt-4 space-y-1.5 border-t border-border/80 pt-4 font-mono text-xs">
                {scoreBreakdown.hasDestructiveActions && (
                  <div className="text-red-400">
                    • Penalty applied: Destructive containment actions selected that cause evidence
                    spoliation.
                  </div>
                )}
                {scoreBreakdown.hasDisproportionateShutdown && (
                  <div className="text-amber-400">
                    • Penalty applied: Company-wide export shutdown was disproportionate to the
                    isolated configuration issue.
                  </div>
                )}
                {scoreBreakdown.hasUnsafeRecovery && (
                  <div className="text-red-400">
                    • Penalty applied: Re-enabling cron jobs unverified risks repeating exposure.
                  </div>
                )}
                {scoreBreakdown.declaredPrematureBreach && (
                  <div className="text-amber-400">
                    • Deducted points: Declaring confirmed external breach contradicts evidence
                    showing external transmission is unproven.
                  </div>
                )}
                {!scoreBreakdown.hasDestructiveActions &&
                  !scoreBreakdown.hasDisproportionateShutdown &&
                  !scoreBreakdown.declaredPrematureBreach && (
                    <div className="text-emerald-400">
                      ✓ Strong forensic discipline: Avoided destructive actions, respected
                      evidentiary boundaries, and properly prioritized non-destructive containment.
                    </div>
                  )}
              </div>
            </div>

            {/* Evidence-Based Case Conclusions */}
            <div className="mt-6 space-y-4">
              <div className="border-l-4 border-emerald-500 bg-emerald-950/30 p-4">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                  CRITICAL FORENSIC BOUNDARY STATEMENT
                </h3>
                <p className="mt-1 font-mono text-xs leading-relaxed text-zinc-200">
                  Based on all technical evidence collected across network flows, identity tokens,
                  cryptographic artifact analyses, and witness depositions:{" "}
                  <strong className="text-emerald-300">
                    External exfiltration across the Internet perimeter and deliberate human malice
                    have NOT been established.
                  </strong>{" "}
                  The incident represents an overprivileged automated workflow execution that
                  accessed and staged confidential roadmap data within internal infrastructure.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 border border-border bg-card p-4">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                    1. Confirmed Technical Facts
                  </h4>
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    <li>
                      <strong className="text-foreground">Overprivileged Role:</strong> Service
                      account <code>svc-exportbridge</code> inherited wildcard{" "}
                      <code>/projects/*</code> read access in config v17 (commit{" "}
                      <code>a94f2b1</code>).
                    </li>
                    <li>
                      <strong className="text-foreground">Internal Staging Verified:</strong>{" "}
                      Workflow job EB-2041 accessed <code>/projects/glasshouse/roadmap</code> and
                      created archive <code>PKG-8842</code> in internal storage.
                    </li>
                    <li>
                      <strong className="text-foreground">Cryptographic Match:</strong> Acquired
                      evidence artifact <code>EVD-RAW-001</code> SHA-256 strictly matches the staged
                      vault package.
                    </li>
                    <li>
                      <strong className="text-foreground">Working Copy Variance:</strong> Binary
                      comparison proved hash differences in working copies stem solely from standard
                      tar header creation timestamps.
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 border border-border bg-card p-4">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
                    2. Evidentiary Bounds & Unconfirmed Claims
                  </h4>
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    <li>
                      <strong className="text-foreground">External Exfiltration:</strong> Perimeter
                      NetFlow (NET-10) and egress proxy logs recorded zero outbound transmission of
                      archive PKG-8842.
                    </li>
                    <li>
                      <strong className="text-foreground">Third-Party Receipt:</strong> Partner SFTP
                      confirmation logs have not recorded delivery of Glasshouse files.
                    </li>
                    <li>
                      <strong className="text-foreground">Insider Malice Unproven:</strong>{" "}
                      Technical and witness records show Elena Rostova and Mira Vance did not
                      intentionally exfiltrate corporate assets.
                    </li>
                    <li>
                      <strong className="text-foreground">Governance Failure:</strong> The incident
                      stemmed from deficient PR policy enforcement, missing configuration linters,
                      and insufficient IAM scoping.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Incident Response Summary */}
            <div className="mt-6 space-y-4 border border-border bg-card p-5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                PARTICIPANT RESPONSE SUMMARY
              </h3>
              <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground md:grid-cols-2">
                <div className="space-y-1.5">
                  <p>
                    <strong className="text-foreground">Containment Actions: </strong>
                    {phase1.selectedActionIds
                      .map((id) => CONTAINMENT_ACTIONS.find((a) => a.id === id)?.title)
                      .join("; ") || "None"}
                  </p>
                  <p>
                    <strong className="text-foreground">Tactical Justification: </strong>
                    {phase1.justification || "None recorded."}
                  </p>
                  <p>
                    <strong className="text-foreground">Preserved Sources: </strong>
                    {phase2.selectedSourceIds
                      .map((id) => PRESERVATION_SOURCES.find((s) => s.id === id)?.sourceName)
                      .join("; ") || "None"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p>
                    <strong className="text-foreground">Evidence Custodian: </strong>{" "}
                    {phase2.custodian || "Lead Forensic Investigator"}
                  </p>
                  <p>
                    <strong className="text-foreground">Approved Recovery Steps: </strong>
                    {phase3.selectedRecoveryStepIds
                      .map((id) => SAFE_RECOVERY_STEPS.find((s) => s.id === id)?.title)
                      .join("; ") || "None"}
                  </p>
                  <p>
                    <strong className="text-foreground">Response Decision Posture: </strong>
                    {RESPONSE_DECISION_OPTIONS.find((o) => o.id === phase4.decisionId)?.label ||
                      "Proportionate"}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation and Completion Status */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
              <button
                onClick={() => navigateToPhase(4)}
                className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> BACK TO DECISION
              </button>

              <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                CASE 07 INVESTIGATION & RESPONSE COMPLETE
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
