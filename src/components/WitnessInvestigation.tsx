import { useMemo, useState, type ComponentType } from "react";
import {
  Users,
  UserCheck,
  UserX,
  MessageSquare,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Send,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Flag,
  ShieldAlert,
  Clock3,
  Layers,
  Search,
  Check,
  Info,
} from "lucide-react";
import {
  type WitnessProfile,
  type StatementStatus,
  type CaseWallClaim,
  WITNESS_PROFILES,
  CASE_WALL_CLAIMS,
  CONFERENCE_ACCOUNTS,
  CONFERENCE_UNRESOLVED,
  CONFERENCE_EXPLAINED_CONTRADICTIONS,
  CONFERENCE_NEXT_INQUIRIES,
} from "../lib/stage4-witnesses";
import { submitStageServerFn } from "../api/submissions";

type WitnessTab = "transcripts" | "casewall" | "credibility" | "conference";

type WitnessNote = {
  established: string;
  disputed: string;
  unknowns: string;
};

type ClaimEvaluation = {
  status: StatementStatus | "";
  citedEvidenceIds: string[];
  justification: string;
};

type CredibilityEntry = {
  reliability: "high" | "moderate" | "low" | "";
  motive: "benign" | "unverified" | "malicious" | "";
  rationale: string;
};

const COMMON_EVIDENCE_CHIPS = [
  "CFG-AUD-202",
  "CFG-DEP-203",
  "DOC-WEB-205",
  "ACL-CHK-206",
  "STS-ISS-208",
  "SCH-LOG-209",
  "ADM-SES-214",
  "AUTH-11",
  "AUTH-14",
  "AUTH-LOG-204",
  "SEC-ALR-207",
  "ART-ACQ-301",
  "ART-EXP-302",
  "ART-LOG-306",
  "ART-PRX-312",
  "ART-RES-313",
  "ART-DUP-305",
  "ART-SAN-314",
];

export function WitnessInvestigation({
  done,
  authToken,
  onComplete,
}: {
  done: boolean;
  authToken?: string | undefined;
  onComplete: () => void;
}) {
  // Navigation
  const [activeTab, setActiveTab] = useState<WitnessTab>("transcripts");
  const [selectedWitnessId, setSelectedWitnessId] = useState<string>("WIT-MV");

  // Transcripts & Follow-up flags
  const [flaggedStatementIds, setFlaggedStatementIds] = useState<string[]>([]);
  const [witnessNotes, setWitnessNotes] = useState<Record<string, WitnessNote>>({
    "WIT-MV": { established: "", disputed: "", unknowns: "" },
    "WIT-ER": { established: "", disputed: "", unknowns: "" },
    "WIT-JP": { established: "", disputed: "", unknowns: "" },
    "WIT-RS": { established: "", disputed: "", unknowns: "" },
  });

  // Case Wall Claim Evaluations
  const [claimEvaluations, setClaimEvaluations] = useState<Record<string, ClaimEvaluation>>({
    "CW-01": { status: "", citedEvidenceIds: [], justification: "" },
    "CW-02": { status: "", citedEvidenceIds: [], justification: "" },
    "CW-03": { status: "", citedEvidenceIds: [], justification: "" },
    "CW-04": { status: "", citedEvidenceIds: [], justification: "" },
    "CW-05": { status: "", citedEvidenceIds: [], justification: "" },
    "CW-06": { status: "", citedEvidenceIds: [], justification: "" },
  });

  // Credibility Ledger
  const [credibilityLedger, setCredibilityLedger] = useState<Record<string, CredibilityEntry>>({
    "WIT-MV": { reliability: "", motive: "", rationale: "" },
    "WIT-ER": { reliability: "", motive: "", rationale: "" },
    "WIT-JP": { reliability: "", motive: "", rationale: "" },
    "WIT-RS": { reliability: "", motive: "", rationale: "" },
  });

  // Final Case Conference
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedUnresolved, setSelectedUnresolved] = useState<string>("");
  const [selectedExplained, setSelectedExplained] = useState<string>("");
  const [followupStatementId, setFollowupStatementId] = useState<string>("");
  const [followupRationale, setFollowupRationale] = useState<string>("");
  const [selectedInquiry, setSelectedInquiry] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submissionMessage, setSubmissionMessage] = useState("");

  // Active witness
  const selectedWitness =
    WITNESS_PROFILES.find((w) => w.id === selectedWitnessId) ?? WITNESS_PROFILES[0]!;

  // Toggle flagged statements
  const toggleFlag = (statementId: string) => {
    setFlaggedStatementIds((prev) =>
      prev.includes(statementId) ? prev.filter((id) => id !== statementId) : [...prev, statementId],
    );
  };

  // Toggle evidence citation in claims
  const toggleClaimEvidence = (claimId: string, evId: string) => {
    setClaimEvaluations((prev) => {
      const current = prev[claimId]?.citedEvidenceIds || [];
      const updated = current.includes(evId)
        ? current.filter((id) => id !== evId)
        : [...current, evId];
      return {
        ...prev,
        [claimId]: {
          ...prev[claimId]!,
          citedEvidenceIds: updated,
        },
      };
    });
  };

  // Readiness calculations
  const totalNotesRecorded = Object.values(witnessNotes).filter(
    (n) => n.established.trim() || n.disputed.trim() || n.unknowns.trim(),
  ).length;

  const totalClaimsEvaluated = Object.values(claimEvaluations).filter(
    (c) => c.status !== "" && c.citedEvidenceIds.length > 0 && c.justification.trim().length >= 15,
  ).length;

  const totalCredibilityEvaluated = Object.values(credibilityLedger).filter(
    (c) => c.reliability !== "" && c.motive !== "" && c.rationale.trim().length >= 15,
  ).length;

  const isConferenceReady =
    selectedAccount !== "" &&
    selectedUnresolved !== "" &&
    selectedExplained !== "" &&
    followupStatementId !== "" &&
    followupRationale.trim().length >= 25 &&
    selectedInquiry !== "";

  const submitConference = async () => {
    if (!isConferenceReady) return;
    setSubmitted(false);
    setSubmissionMessage("");
    try {
      const result = await submitStageServerFn({
        data: {
          stageId: 4,
          authToken,
          payload: {
            claimEvaluations,
            accountPreference: selectedAccount,
            conferenceUnresolvedId: selectedUnresolved,
            conferenceExplainedId: selectedExplained,
            conferenceNextInquiryId: selectedInquiry,
          },
        },
      });
      setSubmissionMessage(
        !result.success
          ? result.remarks
          : result.persistedToSupabase
            ? `Verified and saved (${result.score}/100).`
            : `Verified (${result.score}/100). Sign in and configure Supabase to save progress.`,
      );
      setSubmitted(result.success && result.passed);
    } catch {
      setSubmissionMessage("Server verification failed. Please retry your submission.");
    }
  };

  // Scoring engine (100 points total)
  const evaluation = useMemo(() => {
    // 1. Evidence-Grounded Claim Assessments (30 pts: 5 pts each for 6 claims)
    let claimScore = 0;
    for (const claim of CASE_WALL_CLAIMS) {
      const userEval = claimEvaluations[claim.id];
      if (userEval && userEval.status === claim.expectedStatus) {
        claimScore += 5;
      }
    }

    // 2. Cross-Witness Correlation & Discrepancy Spotting (20 pts)
    let correlationScore = 0;
    // CW-03 correctly identifies Jonah Pike's proxy mistake
    if (claimEvaluations["CW-03"]?.status === "contradicted") correlationScore += 5;
    // CW-02 correctly decouples Elena's web review from export batch
    if (claimEvaluations["CW-02"]?.status === "contradicted") correlationScore += 5;
    // CW-05 correctly resolves the clock skew discrepancy
    if (claimEvaluations["CW-05"]?.status === "contradicted") correlationScore += 5;
    // Flagged at least 2 statements for follow-up
    if (flaggedStatementIds.length >= 2) correlationScore += 5;
    correlationScore = Math.min(20, correlationScore);

    // 3. Technical Evidence ID Citations (20 pts)
    let citationScore = 0;
    const allCitations = Object.values(claimEvaluations).flatMap((c) => c.citedEvidenceIds);
    if (allCitations.includes("CFG-AUD-202")) citationScore += 4;
    if (allCitations.includes("DOC-WEB-205")) citationScore += 4;
    if (allCitations.includes("ART-PRX-312")) citationScore += 4;
    if (allCitations.includes("STS-ISS-208")) citationScore += 4;
    if (allCitations.includes("ART-LOG-306")) citationScore += 4;
    citationScore = Math.min(20, citationScore);

    // 4. Responsible Credibility and Intent Assessment (15 pts)
    let credibilityScore = 0;
    // Vance: reliability high/moderate, motive unverified (not malicious without proof)
    const mv = credibilityLedger["WIT-MV"];
    if (
      mv &&
      (mv.reliability === "high" || mv.reliability === "moderate") &&
      mv.motive === "unverified"
    ) {
      credibilityScore += 5;
    }
    // Pike: reliability moderate (due to proxy claim error), motive benign
    const jp = credibilityLedger["WIT-JP"];
    if (jp && jp.reliability === "moderate" && jp.motive === "benign") {
      credibilityScore += 5;
    }
    // Rostova & Sen assessed
    const er = credibilityLedger["WIT-ER"];
    const rs = credibilityLedger["WIT-RS"];
    if (er && er.reliability && rs && rs.reliability) {
      credibilityScore += 5;
    }
    credibilityScore = Math.min(15, credibilityScore);

    // 5. Case Conference & Next-Step Justification (15 pts)
    let conferenceScore = 0;
    if (selectedAccount === "CONF-ACC-1") conferenceScore += 4;
    if (selectedUnresolved === "CONF-UNRES-1") conferenceScore += 4;
    if (selectedExplained === "CONF-EXP-1") conferenceScore += 3;
    if (selectedInquiry === "CONF-INQ-1") conferenceScore += 4;
    conferenceScore = Math.min(15, conferenceScore);

    const totalScore = Math.min(
      100,
      claimScore + correlationScore + citationScore + credibilityScore + conferenceScore,
    );

    return {
      totalScore,
      claimScore,
      correlationScore,
      citationScore,
      credibilityScore,
      conferenceScore,
      isOptimalAccount: selectedAccount === "CONF-ACC-1",
      isOptimalUnresolved: selectedUnresolved === "CONF-UNRES-1",
      isOptimalExplained: selectedExplained === "CONF-EXP-1",
      isOptimalInquiry: selectedInquiry === "CONF-INQ-1",
    };
  }, [
    claimEvaluations,
    flaggedStatementIds,
    credibilityLedger,
    selectedAccount,
    selectedUnresolved,
    selectedExplained,
    selectedInquiry,
  ]);

  const resetAll = () => {
    setFlaggedStatementIds([]);
    setWitnessNotes({
      "WIT-MV": { established: "", disputed: "", unknowns: "" },
      "WIT-ER": { established: "", disputed: "", unknowns: "" },
      "WIT-JP": { established: "", disputed: "", unknowns: "" },
      "WIT-RS": { established: "", disputed: "", unknowns: "" },
    });
    setClaimEvaluations({
      "CW-01": { status: "", citedEvidenceIds: [], justification: "" },
      "CW-02": { status: "", citedEvidenceIds: [], justification: "" },
      "CW-03": { status: "", citedEvidenceIds: [], justification: "" },
      "CW-04": { status: "", citedEvidenceIds: [], justification: "" },
      "CW-05": { status: "", citedEvidenceIds: [], justification: "" },
      "CW-06": { status: "", citedEvidenceIds: [], justification: "" },
    });
    setCredibilityLedger({
      "WIT-MV": { reliability: "", motive: "", rationale: "" },
      "WIT-ER": { reliability: "", motive: "", rationale: "" },
      "WIT-JP": { reliability: "", motive: "", rationale: "" },
      "WIT-RS": { reliability: "", motive: "", rationale: "" },
    });
    setSelectedAccount("");
    setSelectedUnresolved("");
    setSelectedExplained("");
    setFollowupStatementId("");
    setFollowupRationale("");
    setSelectedInquiry("");
    setSubmitted(false);
  };

  return (
    <div className="space-y-6">
      {/* Witness Room Station Header */}
      <div className="border border-violet-500/30 bg-zinc-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-violet-500/40 bg-violet-950/40 text-violet-400">
              <Users className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
                DIGITAL INTERVIEW ROOM // CASE BF-007
              </div>
              <h2 className="font-mono text-xl font-bold tracking-wide text-foreground">
                STAGE 04 — WITNESS & INTENT INVESTIGATION
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-zinc-800 bg-black/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              4 WITNESS SESSIONS
            </span>
            <span className="border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 font-mono text-[11px] text-violet-400">
              CORROBORATION ACTIVE
            </span>
            {flaggedStatementIds.length > 0 && (
              <span className="flex items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] text-amber-400">
                <Flag className="h-3 w-3" /> {flaggedStatementIds.length} FLAGGED
              </span>
            )}
            {done && (
              <span className="flex items-center gap-1 border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> STAGE VERIFIED
              </span>
            )}
          </div>
        </div>

        {/* 4-Tab Stepper */}
        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-4 md:grid-cols-4">
          {[
            {
              id: "transcripts" as WitnessTab,
              label: "01 Transcripts & Notes",
              count: `${totalNotesRecorded}/4 Noted`,
              done: totalNotesRecorded >= 2,
            },
            {
              id: "casewall" as WitnessTab,
              label: "02 Case Wall Matrix",
              count: `${totalClaimsEvaluated}/6 Assessed`,
              done: totalClaimsEvaluated >= 5,
            },
            {
              id: "credibility" as WitnessTab,
              label: "03 Credibility Ledger",
              count: `${totalCredibilityEvaluated}/4 Evaluated`,
              done: totalCredibilityEvaluated >= 3,
            },
            {
              id: "conference" as WitnessTab,
              label: "04 Case Conference",
              count: submitted ? `${evaluation.totalScore}/100 Pts` : "Findings Board",
              done: isConferenceReady,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col border p-3 text-left transition-all ${
                  isActive
                    ? "border-violet-400 bg-violet-950/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                    : "border-zinc-800 bg-black/30 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-xs font-bold ${
                      isActive ? "text-violet-300" : "text-zinc-400"
                    }`}
                  >
                    {tab.label}
                  </span>
                  {tab.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <span className="h-2 w-2 rounded-full border border-zinc-600" />
                  )}
                </div>
                <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: WITNESS ROSTER & TRANSCRIPTS */}
      {activeTab === "transcripts" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-violet-400">
              Interrogation Transcripts & Witness Debriefing
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Review witness statements, identify technical contradictions, record interview notes,
              and flag critical claims for follow-up. Do not treat witness confidence or suspicion
              as proof of criminal malice.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left: Witness Profiles Roster */}
            <div className="space-y-2 lg:col-span-4">
              {WITNESS_PROFILES.map((w) => {
                const isSelected = w.id === selectedWitnessId;
                const flagsCount = w.statements.filter((s) =>
                  flaggedStatementIds.includes(s.id),
                ).length;
                const hasNotes = Boolean(
                  witnessNotes[w.id]?.established ||
                  witnessNotes[w.id]?.disputed ||
                  witnessNotes[w.id]?.unknowns,
                );

                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWitnessId(w.id)}
                    className={`w-full border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-violet-400 bg-violet-950/30 shadow-[0_0_12px_rgba(139,92,246,0.12)]"
                        : "border-zinc-800 bg-zinc-950/80 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-sm font-bold text-foreground">{w.name}</div>
                        <div className="text-xs text-violet-400 font-mono">{w.role}</div>
                        <div className="text-[10px] text-muted-foreground">{w.department}</div>
                      </div>

                      <div className="flex flex-col items-end gap-1 font-mono text-[9px]">
                        <span className="border border-zinc-700 bg-black/40 px-1.5 py-0.5 text-muted-foreground">
                          {w.clearanceLevel}
                        </span>
                        {flagsCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-400">
                            <Flag className="h-2.5 w-2.5" /> {flagsCount} Flagged
                          </span>
                        )}
                        {hasNotes && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Check className="h-2.5 w-2.5" /> Notes Logged
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Scope of Knowledge Card */}
              <div className="mt-4 border border-zinc-800 bg-zinc-950 p-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Scope of Knowledge: {selectedWitness.name}
                </span>
                <ul className="mt-2 space-y-1.5 text-xs text-zinc-300">
                  {selectedWitness.scopeOfKnowledge.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-violet-400">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: Interview Transcript Stream */}
            <div className="space-y-4 lg:col-span-8">
              <div className="border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-violet-400" />
                    <span className="font-mono text-xs font-bold text-foreground">
                      RECORDED INTERVIEW LOG // {selectedWitness.name.toUpperCase()}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    6 Recorded Statements (UTC Certified)
                  </span>
                </div>

                {/* Q&A Dialog Feed */}
                <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1">
                  {selectedWitness.statements.map((stmt) => {
                    const isFlagged = flaggedStatementIds.includes(stmt.id);
                    return (
                      <div
                        key={stmt.id}
                        className={`border p-3.5 transition-all ${
                          isFlagged
                            ? "border-amber-500/50 bg-amber-950/10"
                            : "border-zinc-800 bg-black/40 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-violet-400">
                              {stmt.id}
                            </span>
                            <span className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                              {stmt.topic}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-500">
                              {stmt.timestamp}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleFlag(stmt.id)}
                              className={`flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] transition-colors ${
                                isFlagged
                                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                                  : "border-zinc-800 text-muted-foreground hover:border-zinc-600"
                              }`}
                            >
                              <Flag className="h-2.5 w-2.5" />
                              {isFlagged ? "FLAGGED" : "FLAG"}
                            </button>
                          </div>
                        </div>

                        {/* Interviewer Question */}
                        <div className="mt-1 rounded bg-zinc-900/50 p-2 text-xs text-zinc-300">
                          <span className="font-mono text-[10px] font-bold text-muted-foreground">
                            INVESTIGATOR:{" "}
                          </span>
                          {stmt.question}
                        </div>

                        {/* Witness Response */}
                        <div className="mt-2 rounded border-l-2 border-violet-500 bg-violet-950/10 p-2.5 text-xs text-foreground leading-relaxed">
                          <span className="font-mono text-[10px] font-bold text-violet-400">
                            {selectedWitness.name.toUpperCase()}:{" "}
                          </span>
                          "{stmt.answer}"
                        </div>

                        {/* Evidence Linkage Chips */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            Related Case Evidence:
                          </span>
                          {stmt.linkedEvidenceIds.map((ev) => (
                            <span
                              key={ev}
                              className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.2 font-mono text-[9px] text-cyan-300"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Investigator's Notebook Drawer for Selected Witness */}
              <div className="border border-zinc-800 bg-zinc-950 p-4">
                <span className="font-mono text-xs font-bold text-foreground">
                  INVESTIGATOR NOTEBOOK // {selectedWitness.name.toUpperCase()}
                </span>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Record what this testimony establishes, what remains disputed, and what requires
                  further subpoena or logs.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-mono text-[9px] uppercase text-emerald-400">
                      Established by Testimony & Logs
                    </label>
                    <textarea
                      value={witnessNotes[selectedWitness.id]?.established || ""}
                      onChange={(e) =>
                        setWitnessNotes((prev) => ({
                          ...prev,
                          [selectedWitness.id]: {
                            ...prev[selectedWitness.id]!,
                            established: e.target.value,
                          },
                        }))
                      }
                      rows={2}
                      placeholder="What facts are confirmed..."
                      className="mt-1 w-full border border-zinc-800 bg-black/60 p-2 font-mono text-xs text-foreground outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] uppercase text-amber-400">
                      Disputed Claims / Tensions
                    </label>
                    <textarea
                      value={witnessNotes[selectedWitness.id]?.disputed || ""}
                      onChange={(e) =>
                        setWitnessNotes((prev) => ({
                          ...prev,
                          [selectedWitness.id]: {
                            ...prev[selectedWitness.id]!,
                            disputed: e.target.value,
                          },
                        }))
                      }
                      rows={2}
                      placeholder="Where testimony conflicts with logs..."
                      className="mt-1 w-full border border-zinc-800 bg-black/60 p-2 font-mono text-xs text-foreground outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] uppercase text-cyan-400">
                      Unknowns & Follow-Up Questions
                    </label>
                    <textarea
                      value={witnessNotes[selectedWitness.id]?.unknowns || ""}
                      onChange={(e) =>
                        setWitnessNotes((prev) => ({
                          ...prev,
                          [selectedWitness.id]: {
                            ...prev[selectedWitness.id]!,
                            unknowns: e.target.value,
                          },
                        }))
                      }
                      rows={2}
                      placeholder="What remains unproven..."
                      className="mt-1 w-full border border-zinc-800 bg-black/60 p-2 font-mono text-xs text-foreground outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>

              {/* Phase Navigation */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveTab("casewall")}
                  className="flex items-center gap-2 border border-violet-500 bg-violet-950/40 px-4 py-2.5 font-mono text-xs font-bold text-violet-300 transition-colors hover:bg-violet-900/50"
                >
                  PROCEED TO TAB 02: CASE WALL MATRIX
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CASE WALL & CLAIM COMPARISON MATRIX */}
      {activeTab === "casewall" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-violet-400">
              Phase 2 — Case Wall & Claim Comparison Matrix
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cross-examine witness testimonies against technical artifacts from Stages 1–3.
              Classify each claim as Corroborated, Contradicted, or Unverified. Cite the relevant
              technical evidence IDs to justify your evaluation.
            </p>
          </div>

          {/* Claims Grid */}
          <div className="space-y-4">
            {CASE_WALL_CLAIMS.map((claim) => {
              const current = claimEvaluations[claim.id] || {
                status: "",
                citedEvidenceIds: [],
                justification: "",
              };

              return (
                <div
                  key={claim.id}
                  className="border border-zinc-800 bg-zinc-950 p-4 transition-all hover:border-zinc-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="max-w-2xl">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-violet-400">
                        <span>{claim.id} // CASE WALL CLAIM</span>
                        <span className="border border-zinc-800 bg-black/50 px-1.5 py-0.5 text-[9px] text-zinc-400">
                          Source: {claim.sourceWitness}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-bold text-foreground">
                        {claim.claimText}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">{claim.description}</p>
                    </div>

                    {/* Status Selector */}
                    <div className="flex gap-1.5">
                      {(["corroborated", "contradicted", "unverified"] as StatementStatus[]).map(
                        (status) => {
                          const isActive = current.status === status;
                          return (
                            <button
                              key={status}
                              onClick={() =>
                                setClaimEvaluations((prev) => ({
                                  ...prev,
                                  [claim.id]: {
                                    ...prev[claim.id]!,
                                    status,
                                  },
                                }))
                              }
                              className={`border px-3 py-1.5 font-mono text-[11px] font-bold uppercase transition-all ${
                                isActive
                                  ? status === "corroborated"
                                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                                    : status === "contradicted"
                                      ? "border-rose-500 bg-rose-500/20 text-rose-300"
                                      : "border-amber-500 bg-amber-500/20 text-amber-300"
                                  : "border-zinc-800 bg-black/40 text-muted-foreground hover:border-zinc-700"
                              }`}
                            >
                              {status}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>

                  {/* Supporting Evidence Tag Selector */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                      <span>ATTACH TECHNICAL EVIDENCE IDS:</span>
                      <span className="text-violet-400">
                        {current.citedEvidenceIds.length} Selected
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {COMMON_EVIDENCE_CHIPS.map((ev) => {
                        const isCited = current.citedEvidenceIds.includes(ev);
                        return (
                          <button
                            key={ev}
                            onClick={() => toggleClaimEvidence(claim.id, ev)}
                            className={`border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                              isCited
                                ? "border-violet-400 bg-violet-950 text-violet-300 font-bold"
                                : "border-zinc-800 bg-zinc-900/60 text-muted-foreground hover:border-zinc-700"
                            }`}
                          >
                            {ev}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Justification Textarea */}
                  <div className="mt-3">
                    <textarea
                      value={current.justification}
                      onChange={(e) =>
                        setClaimEvaluations((prev) => ({
                          ...prev,
                          [claim.id]: {
                            ...prev[claim.id]!,
                            justification: e.target.value,
                          },
                        }))
                      }
                      rows={2}
                      placeholder="Forensic justification: explain why the cited records corroborate, contradict, or leave this statement unverified..."
                      className="w-full resize-y border border-zinc-800 bg-black/50 p-2.5 font-mono text-xs text-foreground outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab("transcripts")}
              className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" /> BACK TO TRANSCRIPTS
            </button>
            <button
              onClick={() => setActiveTab("credibility")}
              className="flex items-center gap-2 border border-violet-500 bg-violet-950/40 px-4 py-2.5 font-mono text-xs font-bold text-violet-300 transition-colors hover:bg-violet-900/50"
            >
              PROCEED TO TAB 03: CREDIBILITY LEDGER
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: WITNESS CREDIBILITY & INTENT LEDGER */}
      {activeTab === "credibility" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-violet-400">
              Phase 3 — Witness Credibility & Intent Ledger
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Distinguish factual reliability from possible malice or culpability. A witness who is
              mistaken (such as Jonah Pike on proxy telemetry) is not necessarily malicious, and an
              engineer who author an unreviewed commit (such as Mira Vance) cannot be convicted of
              felony theft without proof of intent.
            </p>
          </div>

          {/* 4 Credibility Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {WITNESS_PROFILES.map((w) => {
              const current = credibilityLedger[w.id] || {
                reliability: "",
                motive: "",
                rationale: "",
              };

              return (
                <div key={w.id} className="border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                  <div className="border-b border-zinc-800 pb-2">
                    <span className="font-mono text-xs font-bold text-foreground">{w.name}</span>
                    <div className="text-[11px] text-violet-400 font-mono">{w.role}</div>
                  </div>

                  {/* Factual Reliability */}
                  <div>
                    <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Factual Reliability (Log Alignment)
                    </label>
                    <select
                      value={current.reliability}
                      onChange={(e) =>
                        setCredibilityLedger((prev) => ({
                          ...prev,
                          [w.id]: {
                            ...prev[w.id]!,
                            reliability: e.target.value as CredibilityEntry["reliability"],
                          },
                        }))
                      }
                      className="mt-1 w-full border border-zinc-800 bg-black p-2 font-mono text-xs text-foreground outline-none focus:border-violet-500"
                    >
                      <option value="">Select factual reliability...</option>
                      <option value="high">
                        High — Statements strictly align with verified technical records
                      </option>
                      <option value="moderate">
                        Moderate — Substantially factual but includes analytical misinterpretations
                      </option>
                      <option value="low">
                        Low / Compromised — Directly conflicts with cryptographic or network logs
                      </option>
                    </select>
                  </div>

                  {/* Motive & Malice */}
                  <div>
                    <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Evidentiary Assessment of Motive / Intent
                    </label>
                    <select
                      value={current.motive}
                      onChange={(e) =>
                        setCredibilityLedger((prev) => ({
                          ...prev,
                          [w.id]: {
                            ...prev[w.id]!,
                            motive: e.target.value as CredibilityEntry["motive"],
                          },
                        }))
                      }
                      className="mt-1 w-full border border-zinc-800 bg-black p-2 font-mono text-xs text-foreground outline-none focus:border-violet-500"
                    >
                      <option value="">Select motive assessment...</option>
                      <option value="benign">
                        Benign Operational Activity — Documented routine duties or triage
                      </option>
                      <option value="unverified">
                        Unverified / Potential Insider Risk — Negligent action without proof of
                        malice
                      </option>
                      <option value="malicious">
                        Demonstrated Malice — Premeditated criminal data exfiltration (Requires
                        proof)
                      </option>
                    </select>
                  </div>

                  {/* Evaluator Rationale */}
                  <div>
                    <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Forensic Rationale
                    </label>
                    <textarea
                      value={current.rationale}
                      onChange={(e) =>
                        setCredibilityLedger((prev) => ({
                          ...prev,
                          [w.id]: {
                            ...prev[w.id]!,
                            rationale: e.target.value,
                          },
                        }))
                      }
                      rows={2}
                      placeholder="Explain what specific technical logs justify this reliability and intent assessment..."
                      className="mt-1 w-full border border-zinc-800 bg-black/50 p-2 font-mono text-xs text-foreground outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab("casewall")}
              className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" /> BACK TO CASE WALL
            </button>
            <button
              onClick={() => setActiveTab("conference")}
              className="flex items-center gap-2 border border-violet-500 bg-violet-950/40 px-4 py-2.5 font-mono text-xs font-bold text-violet-300 transition-colors hover:bg-violet-900/50"
            >
              PROCEED TO TAB 04: CASE CONFERENCE
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: CASE CONFERENCE & FINAL FINDINGS */}
      {activeTab === "conference" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-violet-400">
              Phase 4 — Case Conference & Investigative Findings
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Synthesize witness testimonies, case wall corroborations, and technical evidence.
              Submit a defensible forensic verdict that separates proven machine events from
              unproven human motives.
            </p>
          </div>

          {/* Pre-Submission Review Summary Cards */}
          <div className="grid grid-cols-2 gap-2 border border-zinc-800 bg-zinc-950 p-3 text-xs md:grid-cols-4">
            <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono">
              <span className="text-[9px] uppercase text-muted-foreground">Witness Notes</span>
              <div className="mt-0.5 text-violet-300">{totalNotesRecorded} of 4 Recorded</div>
            </div>
            <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono">
              <span className="text-[9px] uppercase text-muted-foreground">Case Wall Claims</span>
              <div className="mt-0.5 text-violet-300">{totalClaimsEvaluated} of 6 Assessed</div>
            </div>
            <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono">
              <span className="text-[9px] uppercase text-muted-foreground">Credibility Ledger</span>
              <div className="mt-0.5 text-violet-300">
                {totalCredibilityEvaluated} of 4 Complete
              </div>
            </div>
            <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono">
              <span className="text-[9px] uppercase text-muted-foreground">Conference Status</span>
              <div
                className={isConferenceReady ? "mt-0.5 text-emerald-400" : "mt-0.5 text-amber-400"}
              >
                {isConferenceReady ? "READY TO CONVENE" : "INCOMPLETE DECISIONS"}
              </div>
            </div>
          </div>

          {/* Structured Case Conference Decisions */}
          <div className="border border-violet-500/30 bg-zinc-950 p-5 space-y-4">
            {/* 01: Strongest Corroborated Account */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
                01 / Strongest Corroborated Account of How the Incident Unfolded
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-violet-500"
              >
                <option value="">Select strongest corroborated account...</option>
                {CONFERENCE_ACCOUNTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 02: Material Unresolved Issue */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
                02 / Most Material Unresolved Issue
              </label>
              <select
                value={selectedUnresolved}
                onChange={(e) => setSelectedUnresolved(e.target.value)}
                className="w-full border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-violet-500"
              >
                <option value="">Select material unresolved issue...</option>
                {CONFERENCE_UNRESOLVED.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 03: Apparent Contradiction Explained */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
                03 / Apparent Contradiction Explained by Differing Timelines or Knowledge
              </label>
              <select
                value={selectedExplained}
                onChange={(e) => setSelectedExplained(e.target.value)}
                className="w-full border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-violet-500"
              >
                <option value="">Select explained contradiction...</option>
                {CONFERENCE_EXPLAINED_CONTRADICTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 04: Statement Requiring Follow-Up */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
                04 / Witness Statement Requiring Critical Follow-Up
              </label>
              <select
                value={followupStatementId}
                onChange={(e) => setFollowupStatementId(e.target.value)}
                className="w-full border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-violet-500"
              >
                <option value="">Select statement requiring follow-up...</option>
                {WITNESS_PROFILES.flatMap((w) =>
                  w.statements.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.id}] {w.name}: "{s.topic}"
                    </option>
                  )),
                )}
              </select>
              <textarea
                value={followupRationale}
                onChange={(e) => setFollowupRationale(e.target.value)}
                rows={2}
                placeholder="Explain what specific technical discrepancy or unverified claim in this statement requires follow-up..."
                className="mt-1.5 w-full resize-y border border-zinc-800 bg-black p-2.5 font-mono text-xs text-foreground outline-none focus:border-violet-500"
              />
            </div>

            {/* 05: Next High-Impact Inquiry */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
                05 / Next High-Impact Documentary or Forensic Request
              </label>
              <select
                value={selectedInquiry}
                onChange={(e) => setSelectedInquiry(e.target.value)}
                className="w-full border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-violet-500"
              >
                <option value="">Select next high-impact request...</option>
                {CONFERENCE_NEXT_INQUIRIES.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submission Score & Evaluator Feedback */}
            {submitted && (
              <div className="mt-5 border border-violet-500/40 bg-violet-950/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-500/30 pb-2">
                  <span className="flex items-center gap-2 font-mono text-sm font-bold text-violet-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    CASE CONFERENCE FINDINGS RECORDED
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    STAGE 04 EVALUATION REPORT
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-mono text-3xl font-bold text-foreground">
                    {evaluation.totalScore}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">/ 100 POINTS</span>
                  <span
                    className={`ml-3 rounded-sm border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                      evaluation.totalScore >= 75
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : evaluation.totalScore >= 50
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                          : "border-rose-500/50 bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {evaluation.totalScore >= 75
                      ? "EVIDENCE-CORROBORATED WITNESS VERDICT"
                      : evaluation.totalScore >= 50
                        ? "PARTIALLY SUPPORTED CONFERENCE"
                        : "UNSUBSTANTIATED SPECULATION"}
                  </span>
                </div>

                {/* Score Breakdown Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 text-xs sm:grid-cols-5">
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Claim Checks</div>
                    <div className="mt-1 text-violet-300">{evaluation.claimScore} / 30</div>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Correlation</div>
                    <div className="mt-1 text-violet-300">{evaluation.correlationScore} / 20</div>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Evidence IDs</div>
                    <div className="mt-1 text-violet-300">{evaluation.citationScore} / 20</div>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Credibility</div>
                    <div className="mt-1 text-violet-300">{evaluation.credibilityScore} / 15</div>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Next Steps</div>
                    <div className="mt-1 text-violet-300">{evaluation.conferenceScore} / 15</div>
                  </div>
                </div>

                {/* Evaluator Commentary */}
                <div className="mt-3 border border-zinc-800 bg-black/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-mono text-[10px] font-bold uppercase text-violet-400">
                    Lead Forensic Investigator Remarks:{" "}
                  </span>
                  {evaluation.isOptimalAccount ? (
                    <span className="text-zinc-300">
                      Superb witness interrogation analysis. You correctly separated Jonah Pike's
                      honest analytical mistake regarding proxy telemetry from actual case evidence,
                      recognized Elena Rostova's speculation regarding Mira Vance's intent, and
                      anchored your findings in the verified automated cron and STS token logs.
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Investigative caution required: Concluding that Elena Rostova or Mira Vance
                      stole the roadmap conflates opportunity and timing with confirmed data theft.
                      Review the endpoint bindings on proxy traffic and the automated cron scheduler
                      traces.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-5 flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => {
                  setSubmitted(false);
                  void submitConference();
                }}
                disabled={!isConferenceReady}
                className="flex items-center gap-2 bg-violet-600 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                CONVENE CASE CONFERENCE & RECORD FINDINGS
              </button>

              <button
                onClick={resetAll}
                className="flex items-center gap-2 border border-zinc-700 px-4 py-2.5 font-mono text-xs tracking-wider text-muted-foreground hover:border-zinc-500"
              >
                <RotateCcw className="h-4 w-4" />
                RESET ROOM
              </button>

              {done && (
                <span className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  STAGE 04 COMPLETE
                </span>
              )}
            </div>
            {submissionMessage && (
              <div className="mt-3 font-mono text-xs text-muted-foreground" role="status">
                {submissionMessage}
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab("credibility")}
              className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" /> BACK TO CREDIBILITY
            </button>

            {!done && submitted && (
              <button
                onClick={onComplete}
                className="flex items-center gap-2 border border-violet-400 bg-violet-950/40 px-5 py-2.5 font-mono text-xs font-bold text-violet-300 transition-colors hover:bg-violet-900/60"
              >
                MARK STAGE 04 COMPLETE & UNLOCK STAGE 05
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
