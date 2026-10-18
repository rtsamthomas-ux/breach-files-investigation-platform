import { useMemo, useState, type ComponentType } from "react";
import {
  Layers,
  ShieldCheck,
  Binary,
  FileCheck2,
  GitCompare,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Send,
  HardDrive,
  FileSearch,
  Eye,
  HelpCircle,
  FileCode,
  Sparkles,
  Search,
  Info,
} from "lucide-react";
import {
  type LabArtifact,
  type ArtifactClassification,
  type ClaimStatus,
  STAGE3_ARTIFACTS,
  INVESTIGATIVE_CLAIMS,
  VERDICT_FINDINGS,
  VERDICT_LIMITATIONS,
  VERDICT_NEXT_STEPS,
} from "../lib/stage3-evidence";
import { submitStageServerFn } from "../api/submissions";

type Icon = ComponentType<{ className?: string }>;

type AnalysisPhase = "intake" | "integrity" | "correlation" | "verdict";

type ComparisonRecord = {
  id: string;
  slotAId: string;
  slotBId: string;
  verdict: "identical" | "different" | "incomparable";
  notes: string;
  timestamp: string;
};

type ClaimAssessment = {
  status: ClaimStatus | "";
  citedArtifacts: string[];
  justification: string;
};

export function EvidenceLab({
  done,
  authToken,
  onComplete,
}: {
  done: boolean;
  authToken?: string | undefined;
  onComplete: () => void;
}) {
  // Navigation & phase state
  const [activePhase, setActivePhase] = useState<AnalysisPhase>("intake");

  // Phase A: Intake & Provenance State
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>("ART-ACQ-301");
  const [classifications, setClassifications] = useState<Record<string, ArtifactClassification>>(
    {},
  );
  const [intakeFilter, setIntakeFilter] = useState<string>("ALL");
  const [intakeSearch, setIntakeSearch] = useState<string>("");

  // Phase B: Integrity Comparison Tray State
  const [slotAId, setSlotAId] = useState<string>("ART-ACQ-301");
  const [slotBId, setSlotBId] = useState<string>("ART-EXP-302");
  const [comparisonVerdict, setComparisonVerdict] = useState<
    "identical" | "different" | "incomparable" | ""
  >("");
  const [comparisonNotes, setComparisonNotes] = useState<string>("");
  const [comparisonsLedger, setComparisonsLedger] = useState<ComparisonRecord[]>([]);

  // Phase C: Cross-Artifact Correlation State
  const [claimAssessments, setClaimAssessments] = useState<Record<string, ClaimAssessment>>({
    "CLAIM-1": { status: "", citedArtifacts: [], justification: "" },
    "CLAIM-2": { status: "", citedArtifacts: [], justification: "" },
    "CLAIM-3": { status: "", citedArtifacts: [], justification: "" },
    "CLAIM-4": { status: "", citedArtifacts: [], justification: "" },
  });

  // Phase D: Findings & Verdict State
  const [selectedFindingId, setSelectedFindingId] = useState<string>("");
  const [selectedLimitationId, setSelectedLimitationId] = useState<string>("");
  const [verdictArtifacts, setVerdictArtifacts] = useState<string[]>([]);
  const [alternativeTheory, setAlternativeTheory] = useState<string>("");
  const [selectedNextStepId, setSelectedNextStepId] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submissionMessage, setSubmissionMessage] = useState("");

  // Active selected artifact in Phase A
  const selectedArtifact =
    STAGE3_ARTIFACTS.find((a) => a.id === selectedArtifactId) ?? STAGE3_ARTIFACTS[0]!;

  // Slot A and Slot B artifacts for Phase B
  const slotAArtifact = STAGE3_ARTIFACTS.find((a) => a.id === slotAId) ?? null;
  const slotBArtifact = STAGE3_ARTIFACTS.find((a) => a.id === slotBId) ?? null;

  // Filtered artifacts for Phase A
  const filteredArtifacts = useMemo(() => {
    const q = intakeSearch.trim().toLowerCase();
    return STAGE3_ARTIFACTS.filter((art) => {
      const matchesType =
        intakeFilter === "ALL" || art.type.toLowerCase() === intakeFilter.toLowerCase();
      const searchable = [
        art.id,
        art.title,
        art.filename,
        art.source,
        art.technicalDetails,
        art.provenanceSummary,
        ...art.tags,
      ]
        .join(" ")
        .toLowerCase();
      return matchesType && (!q || searchable.includes(q));
    });
  }, [intakeFilter, intakeSearch]);

  // Phase completion calculations
  const totalClassified = Object.keys(classifications).length;
  const isPhaseAComplete = totalClassified >= 10;
  const isPhaseBComplete = comparisonsLedger.length >= 2;
  const isPhaseCComplete = Object.values(claimAssessments).every(
    (c) => c.status !== "" && c.citedArtifacts.length > 0 && c.justification.trim().length >= 15,
  );
  const isPhaseDComplete =
    selectedFindingId !== "" &&
    selectedLimitationId !== "" &&
    verdictArtifacts.length >= 3 &&
    alternativeTheory.trim().length >= 30 &&
    selectedNextStepId !== "";

  // Scoring engine calculation
  const evaluation = useMemo(() => {
    // 1. Provenance & Classification score (up to 25 pts)
    let correctClassifications = 0;
    for (const art of STAGE3_ARTIFACTS) {
      if (classifications[art.id] === art.expectedClassification) {
        correctClassifications++;
      }
    }
    const provenanceScore = Math.min(25, Math.round((correctClassifications / 14) * 25));

    // 2. Integrity Verification score (up to 25 pts)
    // Checks comparisons recorded in ledger
    let integrityScore = 0;
    const hasIdenticalComparison = comparisonsLedger.some(
      (c) =>
        ((c.slotAId === "ART-ACQ-301" && c.slotBId === "ART-EXP-302") ||
          (c.slotAId === "ART-EXP-302" && c.slotBId === "ART-ACQ-301") ||
          (c.slotAId === "ART-ACQ-301" && c.slotBId === "ART-VER-307")) &&
        c.verdict === "identical",
    );
    const hasDifferentComparison = comparisonsLedger.some(
      (c) =>
        ((c.slotAId === "ART-ACQ-301" && c.slotBId === "ART-WRK-304") ||
          (c.slotAId === "ART-ACQ-301" && c.slotBId === "ART-OBJ-303")) &&
        c.verdict === "different",
    );
    const hasIncomparableOrDecoy = comparisonsLedger.some(
      (c) =>
        (c.slotAId === "ART-DUP-305" || c.slotBId === "ART-DUP-305") &&
        (c.verdict === "different" || c.verdict === "incomparable"),
    );

    if (hasIdenticalComparison) integrityScore += 10;
    if (hasDifferentComparison) integrityScore += 10;
    if (hasIncomparableOrDecoy || comparisonsLedger.length >= 3) integrityScore += 5;
    integrityScore = Math.min(25, integrityScore);

    // 3. Claims Classifications score (up to 20 pts: 5 pts each)
    let claimScore = 0;
    for (const claim of INVESTIGATIVE_CLAIMS) {
      const assessment = claimAssessments[claim.id];
      if (assessment && assessment.status === claim.expectedStatus) {
        claimScore += 5;
      }
    }

    // 4. Evidence Citation Quality (up to 15 pts)
    let citationScore = 0;
    // Check citations in claims
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
    // Check verdict citations
    if (
      verdictArtifacts.includes("ART-ACQ-301") &&
      (verdictArtifacts.includes("ART-EXP-302") || verdictArtifacts.includes("ART-VER-307"))
    ) {
      citationScore += 4;
    }
    citationScore = Math.min(15, citationScore);

    // 5. Verdict Uncertainty & Next Steps (up to 15 pts)
    let uncertaintyScore = 0;
    const isOptimalFinding = selectedFindingId === "V-FIND-1";
    const isOptimalLimitation = selectedLimitationId === "V-LIM-1";
    const isOptimalNextStep = selectedNextStepId === "V-STEP-1";
    const hasDetailedAlternative = alternativeTheory.trim().length >= 30;

    if (isOptimalFinding) uncertaintyScore += 5;
    if (isOptimalLimitation) uncertaintyScore += 4;
    if (isOptimalNextStep) uncertaintyScore += 3;
    if (hasDetailedAlternative) uncertaintyScore += 3;
    uncertaintyScore = Math.min(15, uncertaintyScore);

    const totalScore = Math.min(
      100,
      provenanceScore + integrityScore + claimScore + citationScore + uncertaintyScore,
    );

    return {
      totalScore,
      provenanceScore,
      integrityScore,
      claimScore,
      citationScore,
      uncertaintyScore,
      isOptimalFinding,
      isOptimalLimitation,
      isOptimalNextStep,
    };
  }, [
    classifications,
    comparisonsLedger,
    claimAssessments,
    selectedFindingId,
    selectedLimitationId,
    selectedNextStepId,
    verdictArtifacts,
    alternativeTheory,
  ]);

  const handleClassify = (classification: ArtifactClassification) => {
    setClassifications((prev) => ({
      ...prev,
      [selectedArtifactId]: classification,
    }));
  };

  const handleRecordComparison = () => {
    if (!slotAArtifact || !slotBArtifact || !comparisonVerdict) return;
    const newRecord: ComparisonRecord = {
      id: `CMP-${Date.now().toString().slice(-4)}`,
      slotAId: slotAArtifact.id,
      slotBId: slotBArtifact.id,
      verdict: comparisonVerdict,
      notes: comparisonNotes.trim() || "Verified via hash & size comparison in lab workbench.",
      timestamp: new Date().toISOString().substring(11, 19) + " UTC",
    };
    setComparisonsLedger((prev) => [newRecord, ...prev]);
    setComparisonNotes("");
    setComparisonVerdict("");
  };

  const submitFindings = async () => {
    if (!isPhaseDComplete) return;
    setSubmitted(false);
    setSubmissionMessage("");
    try {
      const result = await submitStageServerFn({
        data: {
          stageId: 3,
          authToken,
          payload: {
            classifications,
            comparisonsLedger: comparisonsLedger.map((comparison) => ({
              artifactA: comparison.slotAId,
              artifactB: comparison.slotBId,
              relation:
                comparison.verdict === "different" ? "altered_metadata" : comparison.verdict,
            })),
            claimAssessments: Object.fromEntries(
              Object.entries(claimAssessments)
                .filter(([, assessment]) => assessment.status !== "")
                .map(([id, assessment]) => [id, assessment]),
            ),
            selectedFindingId,
            selectedLimitationId,
            selectedNextStepId,
            alternativeTheory,
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

  const loadPresetPair = (idA: string, idB: string) => {
    setSlotAId(idA);
    setSlotBId(idB);
    setComparisonVerdict("");
    setComparisonNotes("");
  };

  const toggleClaimCitation = (claimId: string, artId: string) => {
    setClaimAssessments((prev) => {
      const current = prev[claimId]?.citedArtifacts || [];
      const updated = current.includes(artId)
        ? current.filter((x) => x !== artId)
        : [...current, artId];
      return {
        ...prev,
        [claimId]: {
          ...prev[claimId]!,
          citedArtifacts: updated,
        },
      };
    });
  };

  const toggleVerdictCitation = (artId: string) => {
    setVerdictArtifacts((prev) =>
      prev.includes(artId) ? prev.filter((x) => x !== artId) : [...prev, artId],
    );
  };

  const resetAll = () => {
    setClassifications({});
    setComparisonsLedger([]);
    setClaimAssessments({
      "CLAIM-1": { status: "", citedArtifacts: [], justification: "" },
      "CLAIM-2": { status: "", citedArtifacts: [], justification: "" },
      "CLAIM-3": { status: "", citedArtifacts: [], justification: "" },
      "CLAIM-4": { status: "", citedArtifacts: [], justification: "" },
    });
    setSelectedFindingId("");
    setSelectedLimitationId("");
    setVerdictArtifacts([]);
    setAlternativeTheory("");
    setSelectedNextStepId("");
    setSubmitted(false);
  };

  return (
    <div className="space-y-6">
      {/* Evidence Lab Station Header */}
      <div className="border border-cyan-500/30 bg-zinc-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-cyan-500/40 bg-cyan-950/40 text-cyan-400">
              <Binary className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                FORENSIC EVIDENCE LABORATORY // CASE BF-007
              </div>
              <h2 className="font-mono text-xl font-bold tracking-wide text-foreground">
                STAGE 03 — ARTIFACT IDENTITY & INTEGRITY
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-border bg-black/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              14 EVIDENCE ARTIFACTS
            </span>
            <span className="border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 font-mono text-[11px] text-cyan-400">
              HASH VERIFICATION ACTIVE
            </span>
            {done && (
              <span className="flex items-center gap-1 border border-primary/50 bg-primary/10 px-2.5 py-1 font-mono text-[11px] text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> STAGE VERIFIED
              </span>
            )}
          </div>
        </div>

        {/* 4-Phase Horizontal Workflow Stepper */}
        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-4 md:grid-cols-4">
          {[
            {
              id: "intake" as AnalysisPhase,
              label: "01 Intake & Provenance",
              done: isPhaseAComplete,
              desc: `${totalClassified}/14 Classified`,
            },
            {
              id: "integrity" as AnalysisPhase,
              label: "02 Integrity Verification",
              done: isPhaseBComplete,
              desc: `${comparisonsLedger.length} Verified`,
            },
            {
              id: "correlation" as AnalysisPhase,
              label: "03 Cross-Correlation",
              done: isPhaseCComplete,
              desc: "4 Claims Evaluated",
            },
            {
              id: "verdict" as AnalysisPhase,
              label: "04 Findings & Verdict",
              done: isPhaseDComplete,
              desc: submitted ? `${evaluation.totalScore}/100 Pts` : "Draft Ready",
            },
          ].map((phase) => {
            const isActive = activePhase === phase.id;
            return (
              <button
                key={phase.id}
                onClick={() => setActivePhase(phase.id)}
                className={`flex flex-col border p-3 text-left transition-all ${
                  isActive
                    ? "border-cyan-400 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "border-zinc-800 bg-black/30 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-xs font-bold ${
                      isActive ? "text-cyan-300" : "text-zinc-400"
                    }`}
                  >
                    {phase.label}
                  </span>
                  {phase.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <span className="h-2 w-2 rounded-full border border-zinc-600" />
                  )}
                </div>
                <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {phase.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PHASE A: INTAKE & PROVENANCE WORKSPACE */}
      {activePhase === "intake" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-cyan-400">
                  Phase 1 — Artifact Intake & Custody Classification
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inspect incoming forensic artifacts. Determine which metadata establishes origin,
                  acquisition context, and chain of custody. Classify each artifact into its
                  defensible evidentiary role.
                </p>
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                Progress: <span className="font-bold text-cyan-400">{totalClassified} of 14</span>{" "}
                Classified
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={intakeSearch}
                  onChange={(e) => setIntakeSearch(e.target.value)}
                  placeholder="Search artifacts, hashes, collectors, filenames..."
                  className="w-full border border-zinc-800 bg-black/50 py-1.5 pl-8 pr-3 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
                />
              </div>
              {["ALL", "acquisition", "manifest", "log", "custody", "working_copy", "decoy"].map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setIntakeFilter(type)}
                    className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                      intakeFilter === type
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                        : "border-zinc-800 text-muted-foreground hover:border-zinc-700"
                    }`}
                  >
                    {type}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Full-Width Laboratory Canvas: Left Artifact Grid, Right Inspection Console */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Artifacts Selection Grid */}
            <div className="space-y-2 lg:col-span-5">
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filteredArtifacts.map((art) => {
                  const isSelected = art.id === selectedArtifactId;
                  const currentClass = classifications[art.id];
                  return (
                    <button
                      key={art.id}
                      onClick={() => setSelectedArtifactId(art.id)}
                      className={`w-full border p-3 text-left transition-all ${
                        isSelected
                          ? "border-cyan-400 bg-cyan-950/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                          : "border-zinc-800 bg-zinc-950/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-cyan-400">
                              {art.id}
                            </span>
                            <span className="border border-zinc-700 px-1 py-0.2 font-mono text-[9px] text-muted-foreground uppercase">
                              {art.type}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-xs font-semibold text-foreground">
                            {art.title}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {art.filename} • {art.timestamp}
                          </div>
                        </div>

                        {currentClass ? (
                          <span
                            className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                              currentClass === "original"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                : currentClass === "working_copy"
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                  : currentClass === "incomplete"
                                    ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                                    : "border-zinc-600 bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {currentClass === "original"
                              ? "Original"
                              : currentClass === "working_copy"
                                ? "Working Copy"
                                : currentClass === "incomplete"
                                  ? "Incomplete"
                                  : "Unrelated"}
                          </span>
                        ) : (
                          <span className="border border-dashed border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
                            Unclassified
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Artifact Deep-Dive Inspection Console */}
            <div className="space-y-4 lg:col-span-7">
              <div className="border border-cyan-500/20 bg-zinc-950 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {selectedArtifact.id} // ARTIFACT INSPECTION
                    </span>
                    <h4 className="mt-1 text-base font-bold text-foreground">
                      {selectedArtifact.title}
                    </h4>
                  </div>
                  <span className="border border-zinc-800 bg-black/40 px-2.5 py-1 font-mono text-xs text-zinc-400">
                    File: {selectedArtifact.filename}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 text-xs">
                  <div className="bg-zinc-900/90 p-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Acquisition / Event Time
                    </span>
                    <div className="mt-1 font-mono text-foreground">
                      {selectedArtifact.timestamp}
                    </div>
                  </div>
                  <div className="bg-zinc-900/90 p-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Byte Size
                    </span>
                    <div className="mt-1 font-mono text-foreground">
                      {selectedArtifact.sizeBytes
                        ? `${selectedArtifact.sizeBytes.toLocaleString()} bytes`
                        : "N/A (Logical Record)"}
                    </div>
                  </div>
                  <div className="col-span-2 bg-zinc-900/90 p-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Source System / Collector Host
                    </span>
                    <div className="mt-1 font-mono text-foreground">{selectedArtifact.source}</div>
                  </div>
                  {selectedArtifact.sha256Digest && (
                    <div className="col-span-2 bg-zinc-900/90 p-3">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                        SHA-256 Cryptographic Digest
                      </span>
                      <div className="mt-1 break-all font-mono text-[11px] text-cyan-300">
                        {selectedArtifact.sha256Digest}
                      </div>
                    </div>
                  )}
                  {selectedArtifact.custodySignature && (
                    <div className="col-span-2 bg-zinc-900/90 p-3">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                        Custody Token & Digital Signature
                      </span>
                      <div className="mt-1 font-mono text-xs text-emerald-400">
                        {selectedArtifact.custodySignature}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Technical Specifications
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-300">
                    {selectedArtifact.technicalDetails}
                  </p>
                </div>

                <div className="mt-4 space-y-2 border-t border-zinc-800/80 pt-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                    Evidentiary Significance
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {selectedArtifact.forensicSignificance}
                  </p>
                </div>

                {/* Classification Decision Actions */}
                <div className="mt-5 border-t border-zinc-800 pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Record Forensic Classification for {selectedArtifact.id}:
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      {
                        key: "original" as ArtifactClassification,
                        label: "Original Evidence",
                        desc: "Direct primary acquisition",
                        activeClass: "border-emerald-500 bg-emerald-500/20 text-emerald-300",
                      },
                      {
                        key: "working_copy" as ArtifactClassification,
                        label: "Verified Working Copy",
                        desc: "Analyst derived copy",
                        activeClass: "border-amber-500 bg-amber-500/20 text-amber-300",
                      },
                      {
                        key: "incomplete" as ArtifactClassification,
                        label: "Provenance Incomplete",
                        desc: "Sampled / truncated",
                        activeClass: "border-orange-500 bg-orange-500/20 text-orange-300",
                      },
                      {
                        key: "unrelated" as ArtifactClassification,
                        label: "Unrelated / Decoy",
                        desc: "Public or decoy data",
                        activeClass: "border-zinc-500 bg-zinc-700 text-zinc-200",
                      },
                    ].map((btn) => {
                      const isCurrent = classifications[selectedArtifact.id] === btn.key;
                      return (
                        <button
                          key={btn.key}
                          onClick={() => handleClassify(btn.key)}
                          className={`flex flex-col border p-2.5 text-left transition-all ${
                            isCurrent
                              ? btn.activeClass
                              : "border-zinc-800 bg-black/40 hover:border-zinc-700"
                          }`}
                        >
                          <span className="font-mono text-xs font-bold">{btn.label}</span>
                          <span className="text-[10px] text-muted-foreground">{btn.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3">
                  <div className="font-mono text-xs text-muted-foreground">Quick comparison:</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSlotAId(selectedArtifact.id);
                        setActivePhase("integrity");
                      }}
                      className="border border-cyan-500/40 px-3 py-1 font-mono text-[10px] text-cyan-400 hover:bg-cyan-500/10"
                    >
                      Load into Comparison Slot A
                    </button>
                    <button
                      onClick={() => {
                        setSlotBId(selectedArtifact.id);
                        setActivePhase("integrity");
                      }}
                      className="border border-zinc-700 px-3 py-1 font-mono text-[10px] text-zinc-300 hover:bg-zinc-800"
                    >
                      Load into Comparison Slot B
                    </button>
                  </div>
                </div>
              </div>

              {/* Phase Advance Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActivePhase("integrity")}
                  className="flex items-center gap-2 border border-cyan-500 bg-cyan-950/40 px-4 py-2.5 font-mono text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-900/50"
                >
                  PROCEED TO PHASE 02: INTEGRITY VERIFICATION
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE B: INTEGRITY VERIFICATION WORKSPACE (HASH & BYTE COMPARATOR TRAY) */}
      {activePhase === "integrity" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-cyan-400">
              Phase 2 — Cryptographic Hash & Byte Integrity Workbench
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Perform hands-on side-by-side artifact integrity verification. Determine whether two
              artifacts are byte-identical, different versions, or incomparable. Distinguish
              matching filenames from matching bytes, and benign analysis modifications from
              malicious tampering.
            </p>

            {/* Quick-Load Preset Pairs */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Load Standard Verification Pairs:
              </span>
              <button
                onClick={() => loadPresetPair("ART-ACQ-301", "ART-EXP-302")}
                className="border border-zinc-700 bg-black/40 px-2.5 py-1 font-mono text-[10px] text-cyan-300 hover:border-cyan-500"
              >
                Staged Image vs Worker Manifest
              </button>
              <button
                onClick={() => loadPresetPair("ART-ACQ-301", "ART-VER-307")}
                className="border border-zinc-700 bg-black/40 px-2.5 py-1 font-mono text-[10px] text-emerald-300 hover:border-emerald-500"
              >
                Primary Image vs Independent Verify
              </button>
              <button
                onClick={() => loadPresetPair("ART-ACQ-301", "ART-WRK-304")}
                className="border border-zinc-700 bg-black/40 px-2.5 py-1 font-mono text-[10px] text-amber-300 hover:border-amber-500"
              >
                Staged Image vs Analyst Copy
              </button>
              <button
                onClick={() => loadPresetPair("ART-ACQ-301", "ART-DUP-305")}
                className="border border-zinc-700 bg-black/40 px-2.5 py-1 font-mono text-[10px] text-rose-300 hover:border-rose-500"
              >
                Staged Image vs Marketing Decoy
              </button>
              <button
                onClick={() => loadPresetPair("ART-ACQ-301", "ART-OBJ-303")}
                className="border border-zinc-700 bg-black/40 px-2.5 py-1 font-mono text-[10px] text-indigo-300 hover:border-indigo-500"
              >
                Staged Image vs Raw Vault Object
              </button>
            </div>
          </div>

          {/* Dual-Slot Comparison Tray */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Slot A: Reference Artifact */}
            <div className="border border-cyan-500/40 bg-zinc-950 p-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="font-mono text-xs font-bold text-cyan-400">
                  SLOT A — REFERENCE ARTIFACT
                </span>
                <select
                  value={slotAId}
                  onChange={(e) => setSlotAId(e.target.value)}
                  className="border border-zinc-700 bg-black px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
                >
                  {STAGE3_ARTIFACTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} - {a.filename}
                    </option>
                  ))}
                </select>
              </div>

              {slotAArtifact && (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="font-mono text-xs font-semibold text-foreground">
                      {slotAArtifact.title}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      Filename: {slotAArtifact.filename}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border border-zinc-800 bg-zinc-900/60 p-2 text-xs">
                    <div>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">
                        Reported Size
                      </span>
                      <div className="font-mono text-foreground">
                        {slotAArtifact.sizeBytes
                          ? `${slotAArtifact.sizeBytes.toLocaleString()} bytes`
                          : "N/A"}
                      </div>
                    </div>
                    <div>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">
                        Algorithm
                      </span>
                      <div className="font-mono text-foreground">
                        {slotAArtifact.hashAlgorithm || "SHA-256"}
                      </div>
                    </div>
                  </div>

                  <div className="border border-zinc-800 bg-black/60 p-2.5">
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">
                      SHA-256 Digest
                    </span>
                    <div className="mt-1 break-all font-mono text-[11px] text-cyan-300">
                      {slotAArtifact.sha256Digest || "N/A"}
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {slotAArtifact.technicalDetails}
                  </p>
                </div>
              )}
            </div>

            {/* Slot B: Target Artifact */}
            <div className="border border-zinc-700 bg-zinc-950 p-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="font-mono text-xs font-bold text-zinc-300">
                  SLOT B — COMPARISON TARGET
                </span>
                <select
                  value={slotBId}
                  onChange={(e) => setSlotBId(e.target.value)}
                  className="border border-zinc-700 bg-black px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
                >
                  {STAGE3_ARTIFACTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} - {a.filename}
                    </option>
                  ))}
                </select>
              </div>

              {slotBArtifact && (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="font-mono text-xs font-semibold text-foreground">
                      {slotBArtifact.title}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      Filename: {slotBArtifact.filename}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border border-zinc-800 bg-zinc-900/60 p-2 text-xs">
                    <div>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">
                        Reported Size
                      </span>
                      <div className="font-mono text-foreground">
                        {slotBArtifact.sizeBytes
                          ? `${slotBArtifact.sizeBytes.toLocaleString()} bytes`
                          : "N/A"}
                      </div>
                    </div>
                    <div>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">
                        Algorithm
                      </span>
                      <div className="font-mono text-foreground">
                        {slotBArtifact.hashAlgorithm || "SHA-256"}
                      </div>
                    </div>
                  </div>

                  <div className="border border-zinc-800 bg-black/60 p-2.5">
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">
                      SHA-256 Digest
                    </span>
                    <div className="mt-1 break-all font-mono text-[11px] text-zinc-300">
                      {slotBArtifact.sha256Digest || "N/A"}
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {slotBArtifact.technicalDetails}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Cryptographic Comparison Engine Diagnostic Card */}
          {slotAArtifact && slotBArtifact && (
            <div className="border border-cyan-500/30 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <GitCompare className="h-4 w-4 text-cyan-400" />
                  <span className="font-mono text-xs font-bold text-foreground">
                    DIGEST & BYTE COMPARISON DIAGNOSTIC
                  </span>
                </div>

                {slotAArtifact.sha256Digest && slotBArtifact.sha256Digest ? (
                  slotAArtifact.sha256Digest === slotBArtifact.sha256Digest ? (
                    <span className="flex items-center gap-1.5 border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> CRYPTOGRAPHIC BITSTREAM MATCH (100%
                      IDENTICAL)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 border border-amber-500/50 bg-amber-500/10 px-3 py-1 font-mono text-xs font-bold text-amber-400">
                      <AlertTriangle className="h-4 w-4" /> DIGEST MISMATCH (DIFFERENT PAYLOAD OR
                      METADATA)
                    </span>
                  )
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    One or both artifacts lack cryptographic digest
                  </span>
                )}
              </div>

              {/* Byte Delta Analysis */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                  <div className="text-[9px] text-muted-foreground">Slot A Size</div>
                  <div className="text-foreground">
                    {slotAArtifact.sizeBytes ? `${slotAArtifact.sizeBytes} B` : "N/A"}
                  </div>
                </div>
                <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                  <div className="text-[9px] text-muted-foreground">Slot B Size</div>
                  <div className="text-foreground">
                    {slotBArtifact.sizeBytes ? `${slotBArtifact.sizeBytes} B` : "N/A"}
                  </div>
                </div>
                <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                  <div className="text-[9px] text-muted-foreground">Size Delta</div>
                  <div
                    className={
                      slotAArtifact.sizeBytes && slotBArtifact.sizeBytes
                        ? slotAArtifact.sizeBytes === slotBArtifact.sizeBytes
                          ? "text-emerald-400"
                          : "text-amber-400"
                        : "text-muted-foreground"
                    }
                  >
                    {slotAArtifact.sizeBytes && slotBArtifact.sizeBytes
                      ? `${Math.abs(slotAArtifact.sizeBytes - slotBArtifact.sizeBytes)} B delta`
                      : "Incomparable"}
                  </div>
                </div>
                <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                  <div className="text-[9px] text-muted-foreground">Name Comparison</div>
                  <div className="text-foreground">
                    {slotAArtifact.filename === slotBArtifact.filename
                      ? "Identical Filename"
                      : "Distinct Filenames"}
                  </div>
                </div>
              </div>

              {/* Formulate Comparison Verdict */}
              <div className="mt-4 border-t border-zinc-800 pt-3">
                <div className="font-mono text-xs font-semibold text-cyan-400">
                  Formulate Examiner Verdict for Pair ({slotAArtifact.id} ↔ {slotBArtifact.id}):
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    {
                      key: "identical" as const,
                      label: "Byte-Identical (Cryptographic Match)",
                      activeClass: "border-emerald-500 bg-emerald-500/20 text-emerald-300",
                    },
                    {
                      key: "different" as const,
                      label: "Different Versions / Modified Content",
                      activeClass: "border-amber-500 bg-amber-500/20 text-amber-300",
                    },
                    {
                      key: "incomparable" as const,
                      label: "Incomparable with Available Evidence",
                      activeClass: "border-zinc-500 bg-zinc-700 text-zinc-200",
                    },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => setComparisonVerdict(btn.key)}
                      className={`border px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                        comparisonVerdict === btn.key
                          ? btn.activeClass
                          : "border-zinc-800 bg-black/40 text-muted-foreground hover:border-zinc-700"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  <input
                    value={comparisonNotes}
                    onChange={(e) => setComparisonNotes(e.target.value)}
                    placeholder="Forensic significance (e.g. why the match or discrepancy occurred)..."
                    className="w-full border border-zinc-800 bg-black/60 p-2 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleRecordComparison}
                    disabled={!comparisonVerdict}
                    className="flex items-center gap-2 border border-cyan-500 bg-cyan-950/40 px-4 py-2 font-mono text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-900/50 disabled:opacity-40"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    RECORD VERIFIED COMPARISON IN LAB LEDGER
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Comparisons Ledger */}
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono text-xs font-bold text-foreground">
                VERIFIED COMPARISON LEDGER ({comparisonsLedger.length} RECORDED)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Minimum 2 comparisons required
              </span>
            </div>

            {comparisonsLedger.length > 0 ? (
              <div className="mt-3 space-y-2">
                {comparisonsLedger.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between border border-zinc-800 bg-zinc-900/50 p-2.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {c.slotAId} ↔ {c.slotBId}
                        </span>
                        <span
                          className={`border px-1.5 py-0.2 font-mono text-[9px] uppercase ${
                            c.verdict === "identical"
                              ? "border-emerald-500/40 text-emerald-400"
                              : c.verdict === "different"
                                ? "border-amber-500/40 text-amber-400"
                                : "border-zinc-600 text-zinc-400"
                          }`}
                        >
                          {c.verdict}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {c.timestamp}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-zinc-300">{c.notes}</p>
                    </div>

                    <button
                      onClick={() =>
                        setComparisonsLedger((prev) => prev.filter((x) => x.id !== c.id))
                      }
                      className="text-muted-foreground hover:text-rose-400"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 border border-dashed border-zinc-800 p-4 text-center text-xs text-muted-foreground">
                No comparisons recorded yet. Select pair presets or choose artifacts above and
                record your findings.
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActivePhase("intake")}
              className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" /> BACK TO INTAKE
            </button>
            <button
              onClick={() => setActivePhase("correlation")}
              className="flex items-center gap-2 border border-cyan-500 bg-cyan-950/40 px-4 py-2.5 font-mono text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-900/50"
            >
              PROCEED TO PHASE 03: CROSS-ARTIFACT CORRELATION
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE C: CROSS-ARTIFACT CORRELATION WORKSPACE */}
      {activePhase === "correlation" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-cyan-400">
              Phase 3 — Cross-Artifact Evidence Matrix
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect physical and digital artifacts across systems to evaluate core investigative
              claims. Classify each claim as Supported, Contradicted, or Unresolved based strictly
              on the corroborated evidence.
            </p>
          </div>

          {/* Interactive Claims Board */}
          <div className="space-y-4">
            {INVESTIGATIVE_CLAIMS.map((claim, idx) => {
              const current = claimAssessments[claim.id] || {
                status: "",
                citedArtifacts: [],
                justification: "",
              };
              return (
                <div
                  key={claim.id}
                  className="border border-zinc-800 bg-zinc-950 p-4 transition-all hover:border-zinc-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="max-w-2xl">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400">
                        <span>
                          CLAIM 0{idx + 1} // {claim.id}
                        </span>
                      </div>
                      <h4 className="mt-1 text-sm font-bold text-foreground">{claim.claimText}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{claim.description}</p>
                    </div>

                    {/* Status Selector */}
                    <div className="flex gap-1.5">
                      {(["supported", "contradicted", "unresolved"] as ClaimStatus[]).map(
                        (status) => {
                          const isActive = current.status === status;
                          return (
                            <button
                              key={status}
                              onClick={() =>
                                setClaimAssessments((prev) => ({
                                  ...prev,
                                  [claim.id]: {
                                    ...prev[claim.id]!,
                                    status,
                                  },
                                }))
                              }
                              className={`border px-3 py-1.5 font-mono text-[11px] font-bold uppercase transition-all ${
                                isActive
                                  ? status === "supported"
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
                      <span>ATTACH CORROBORATING ARTIFACT IDS:</span>
                      <span className="text-cyan-400">
                        {current.citedArtifacts.length} Selected
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {STAGE3_ARTIFACTS.map((art) => {
                        const isCited = current.citedArtifacts.includes(art.id);
                        return (
                          <button
                            key={art.id}
                            onClick={() => toggleClaimCitation(claim.id, art.id)}
                            className={`border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                              isCited
                                ? "border-cyan-400 bg-cyan-950 text-cyan-300"
                                : "border-zinc-800 bg-zinc-900/60 text-muted-foreground hover:border-zinc-700"
                            }`}
                          >
                            {art.id}
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
                        setClaimAssessments((prev) => ({
                          ...prev,
                          [claim.id]: {
                            ...prev[claim.id]!,
                            justification: e.target.value,
                          },
                        }))
                      }
                      rows={2}
                      placeholder="Forensic justification: explain how the cited artifacts support, contradict, or leave this claim unresolved..."
                      className="w-full resize-y border border-zinc-800 bg-black/50 p-2.5 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActivePhase("integrity")}
              className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" /> BACK TO INTEGRITY
            </button>
            <button
              onClick={() => setActivePhase("verdict")}
              className="flex items-center gap-2 border border-cyan-500 bg-cyan-950/40 px-4 py-2.5 font-mono text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-900/50"
            >
              PROCEED TO PHASE 04: FINDINGS & VERDICT
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE D: FINDINGS & VERDICT WORKSPACE */}
      {activePhase === "verdict" && (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-cyan-400">
              Phase 4 — Forensic Findings & Case 07 Evidence Verdict
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Formulate the final, defensible conclusion regarding artifact authenticity, custody,
              integrity, and exfiltration limitations. Acknowledge technical uncertainties rather
              than overclaiming.
            </p>
          </div>

          {/* Pre-Submission Review Summary Cards */}
          <div className="grid grid-cols-2 gap-2 border border-zinc-800 bg-zinc-950 p-3 text-xs md:grid-cols-4">
            <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono">
              <span className="text-[9px] uppercase text-muted-foreground">
                Classified Artifacts
              </span>
              <div className="mt-0.5 text-cyan-300">{totalClassified} of 14</div>
            </div>
            <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono">
              <span className="text-[9px] uppercase text-muted-foreground">
                Integrity Comparisons
              </span>
              <div className="mt-0.5 text-cyan-300">{comparisonsLedger.length} Recorded</div>
            </div>
            <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono">
              <span className="text-[9px] uppercase text-muted-foreground">Evaluated Claims</span>
              <div className="mt-0.5 text-cyan-300">
                {Object.values(claimAssessments).filter((c) => c.status !== "").length} of 4
              </div>
            </div>
            <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 font-mono">
              <span className="text-[9px] uppercase text-muted-foreground">Verdict Readiness</span>
              <div
                className={isPhaseDComplete ? "mt-0.5 text-emerald-400" : "mt-0.5 text-amber-400"}
              >
                {isPhaseDComplete ? "READY TO SUBMIT" : "INCOMPLETE FIELDS"}
              </div>
            </div>
          </div>

          {/* Structured Forensic Verdict Board */}
          <div className="border border-cyan-500/30 bg-zinc-950 p-5 space-y-4">
            {/* 01: Strongest Supported Finding */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                01 / Strongest Defensible Finding About the Artifact Corpus
              </label>
              <select
                value={selectedFindingId}
                onChange={(e) => setSelectedFindingId(e.target.value)}
                className="w-full border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
              >
                <option value="">Select defensible finding...</option>
                {VERDICT_FINDINGS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 02: Most Consequential Limitation */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                02 / Most Consequential Evidence Limitation or Ambiguity
              </label>
              <select
                value={selectedLimitationId}
                onChange={(e) => setSelectedLimitationId(e.target.value)}
                className="w-full border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
              >
                <option value="">Select key limitation...</option>
                {VERDICT_LIMITATIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 03: Primary Supporting Artifact Citations */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="uppercase tracking-widest text-cyan-400">
                  03 / Core Supporting Artifact IDs (Select 3+)
                </span>
                <span className="text-muted-foreground">{verdictArtifacts.length} Selected</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STAGE3_ARTIFACTS.map((art) => {
                  const isSelected = verdictArtifacts.includes(art.id);
                  return (
                    <button
                      key={art.id}
                      onClick={() => toggleVerdictCitation(art.id)}
                      className={`border px-2.5 py-1 font-mono text-xs transition-colors ${
                        isSelected
                          ? "border-cyan-400 bg-cyan-950 text-cyan-300 font-bold"
                          : "border-zinc-800 bg-black text-muted-foreground hover:border-zinc-700"
                      }`}
                    >
                      {art.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 04: Alternative Interpretation & Forensic Nuance */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                04 / Alternative Explanation & Forensic Nuance
              </label>
              <textarea
                value={alternativeTheory}
                onChange={(e) => setAlternativeTheory(e.target.value)}
                rows={3}
                placeholder="Explain an alternative interpretation (e.g. why package staging could occur without successful external egress, or why working copy hashes change benignly)..."
                className="w-full resize-y border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
              />
              <span className="font-mono text-[9px] text-muted-foreground">
                Minimum 30 characters required.
              </span>
            </div>

            {/* 05: Next High-Impact Verification Step */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                05 / Next High-Impact Forensic Verification Step
              </label>
              <select
                value={selectedNextStepId}
                onChange={(e) => setSelectedNextStepId(e.target.value)}
                className="w-full border border-zinc-800 bg-black p-3 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
              >
                <option value="">Select next verification request...</option>
                {VERDICT_NEXT_STEPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submission Score & Evaluator Feedback */}
            {submitted && (
              <div className="mt-5 border border-cyan-500/40 bg-cyan-950/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 pb-2">
                  <span className="flex items-center gap-2 font-mono text-sm font-bold text-cyan-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    FORENSIC LABORATORY FINDINGS RECORDED
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    STAGE 03 EVALUATION REPORT
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
                      ? "DEFENSIBLE FORENSIC VERDICT"
                      : evaluation.totalScore >= 50
                        ? "PARTIALLY SUPPORTED VERDICT"
                        : "UNSUBSTANTIATED SPECULATION"}
                  </span>
                </div>

                {/* Score Breakdown Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 text-xs sm:grid-cols-5">
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Provenance</div>
                    <div className="mt-1 text-cyan-300">{evaluation.provenanceScore} / 25</div>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Integrity</div>
                    <div className="mt-1 text-cyan-300">{evaluation.integrityScore} / 25</div>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Claim Accuracy</div>
                    <div className="mt-1 text-cyan-300">{evaluation.claimScore} / 20</div>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">
                      Citation Quality
                    </div>
                    <div className="mt-1 text-cyan-300">{evaluation.citationScore} / 15</div>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-2 font-mono">
                    <div className="text-[9px] uppercase text-muted-foreground">Uncertainty</div>
                    <div className="mt-1 text-cyan-300">{evaluation.uncertaintyScore} / 15</div>
                  </div>
                </div>

                {/* Evaluator Commentary */}
                <div className="mt-3 border border-zinc-800 bg-black/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-mono text-[10px] font-bold uppercase text-cyan-400">
                    Lead Forensic Examiner Remarks:{" "}
                  </span>
                  {evaluation.isOptimalFinding ? (
                    <span className="text-zinc-300">
                      Exemplary forensic discipline. You correctly distinguished byte-identical
                      staging from uncorroborated external receipt, recognized that working-copy
                      hash deltas were benign pax metadata artifacts, and resolved the flow
                      collector clock skew.
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Forensic critique: Attributing external exfiltration to proxy telemetry or
                      treating working copies as evidence of tampering conflicts with the technical
                      records. Correlate host IP bindings and tar extended headers before concluding
                      theft.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-5 flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => void submitFindings()}
                disabled={!isPhaseDComplete}
                className="flex items-center gap-2 bg-cyan-500 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                SUBMIT FORENSIC LABORATORY FINDINGS
              </button>

              <button
                onClick={resetAll}
                className="flex items-center gap-2 border border-zinc-700 px-4 py-2.5 font-mono text-xs tracking-wider text-muted-foreground hover:border-zinc-500"
              >
                <RotateCcw className="h-4 w-4" />
                RESET LAB WORKBENCH
              </button>

              {done && (
                <span className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  STAGE 03 COMPLETE
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
              onClick={() => setActivePhase("correlation")}
              className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" /> BACK TO CORRELATION
            </button>

            {!done && submitted && (
              <button
                onClick={onComplete}
                className="flex items-center gap-2 border border-cyan-400 bg-cyan-950/40 px-5 py-2.5 font-mono text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-900/60"
              >
                MARK STAGE 03 COMPLETE & UNLOCK STAGE 04
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
