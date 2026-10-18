import { useMemo, useState, type ComponentType } from "react";
import {
  KeyRound,
  Search,
  Bookmark,
  BookmarkCheck,
  Filter,
  Clock3,
  AlertTriangle,
  Send,
  RotateCcw,
  ClipboardList,
  CheckCircle2,
  ChevronRight,
  FileSearch,
} from "lucide-react";
import {
  type AccessCategory,
  type AccessRecord,
  ACCESS_CATEGORIES,
  ACCESS_EVIDENCE,
} from "../lib/stage2-evidence";
import { submitStageServerFn } from "../api/submissions";

type Icon = ComponentType<{ className?: string }>;

const CATEGORY_COLORS: Record<AccessCategory, string> = {
  IAM: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
  AUTH: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  CONFIG: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
  ACCESS: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  AUDIT: "border-rose-500/40 text-rose-400 bg-rose-500/10",
};

export function AccessInvestigation({
  done,
  authToken,
  onComplete,
}: {
  done: boolean;
  authToken?: string | undefined;
  onComplete: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof ACCESS_CATEGORIES)[number]>("ALL");
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("IAM-POL-201");
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [timelineIds, setTimelineIds] = useState<string[]>([]);

  // Report Form state
  const [finding, setFinding] = useState("");
  const [evidenceIds, setEvidenceIds] = useState("");
  const [establishedVsUnknown, setEstablishedVsUnknown] = useState("");
  const [alternative, setAlternative] = useState("");
  const [nextEvidence, setNextEvidence] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");

  const selectedRecord =
    ACCESS_EVIDENCE.find((record) => record.id === selectedId) ?? ACCESS_EVIDENCE[0]!;

  const filteredEvidence = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ACCESS_EVIDENCE.filter((record) => {
      const matchesCategory = category === "ALL" || record.category === category;
      const matchesBookmark = !showBookmarkedOnly || bookmarks.includes(record.id);
      const searchable = [
        record.id,
        record.time,
        record.category,
        record.source,
        record.title,
        record.summary,
        record.detail,
        ...record.tags,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && matchesBookmark && (!query || searchable.includes(query));
    });
  }, [search, category, bookmarks, showBookmarkedOnly]);

  const timelineRecords = timelineIds
    .map((id) => ACCESS_EVIDENCE.find((record) => record.id === id))
    .filter((record): record is AccessRecord => Boolean(record))
    .sort((a, b) => a.time.localeCompare(b.time));

  const reportComplete =
    finding.trim().length > 0 &&
    evidenceIds.trim().length > 0 &&
    establishedVsUnknown.trim().length >= 40 &&
    alternative.trim().length >= 30 &&
    nextEvidence.trim().length >= 30 &&
    reasoning.trim().length >= 50;

  const toggleBookmark = (id: string) => {
    setBookmarks((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const toggleTimeline = (id: string) => {
    setTimelineIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const resetReport = () => {
    setFinding("");
    setEvidenceIds("");
    setEstablishedVsUnknown("");
    setAlternative("");
    setNextEvidence("");
    setReasoning("");
    setSubmitted(false);
    setSubmissionMessage("");
  };

  const submitReport = async () => {
    if (!reportComplete) return;
    setSubmitted(false);
    setSubmissionMessage("");
    try {
      const result = await submitStageServerFn({
        data: {
          stageId: 2,
          authToken,
          payload: {
            finding,
            evidenceIds,
            timelineIds,
            establishedVsUnknown,
            alternative,
            nextEvidence,
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

  // Comprehensive multi-factor evaluation scoring
  const evaluation = useMemo(() => {
    const submittedIds = [
      ...new Set(
        evidenceIds
          .toUpperCase()
          .split(/[\s,;]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];

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

    // 1. Evidence relevance & correlation coverage (up to 30 pts)
    const evidenceScore = Math.min(30, matchedKeyIds.length * 5);

    // 2. Distraction discernment (up to 10 pts)
    const distractionScore =
      matchedDistractions.length === 0 ? 10 : matchedDistractions.length === 1 ? 5 : 0;

    // 3. Primary Finding Defensibility (up to 15 pts)
    const optimalFindingString =
      "svc-exportbridge accessed the roadmap via a legitimate automated STS token and overprivileged inherited permissions triggered by Config v17; external delivery and human motive remain unestablished.";
    const isOptimalFinding = finding === optimalFindingString;
    const findingScore = isOptimalFinding ? 15 : 0;

    // 4. Chronological Timeline Reconstruction (up to 15 pts)
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

    // 5. Established vs Unknown distinction (up to 10 pts)
    const establishedScore = establishedVsUnknown.trim().length >= 40 ? 10 : 0;

    // 6. Alternative explanation (up to 10 pts)
    const alternativeScore = alternative.trim().length >= 30 ? 10 : 0;

    // 7. Next evidence request (up to 10 pts)
    const nextEvidenceScore = nextEvidence.trim().length >= 30 ? 10 : 0;

    const totalScore = Math.min(
      100,
      evidenceScore +
        distractionScore +
        findingScore +
        timelineScore +
        establishedScore +
        alternativeScore +
        nextEvidenceScore,
    );

    return {
      totalScore,
      evidenceScore,
      distractionScore,
      findingScore,
      timelineScore,
      establishedScore,
      alternativeScore,
      nextEvidenceScore,
      matchedKeyIds,
      matchedDistractions,
      isOptimalFinding,
    };
  }, [evidenceIds, finding, timelineIds, establishedVsUnknown, alternative, nextEvidence]);

  return (
    <div className="space-y-5">
      {/* Stage Briefing Panel */}
      <AccessPanel title="Stage 02 - Access Investigation" icon={KeyRound}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Investigate how the overprivileged service identity{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
                svc-exportbridge
              </code>{" "}
              was able to access the restricted Glasshouse roadmap. Distinguish automated
              service-account activity from human user logins, correlate authentication and
              authorization events, identify governance oversights, and determine what the available
              evidence does and does not establish.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] tracking-widest">
              <span className="border border-primary/40 px-2 py-1 text-primary">CASE BF-007</span>
              <span className="border border-border px-2 py-1 text-muted-foreground">
                15 ACCESS RECORDS
              </span>
              <span className="border border-indigo-500/40 px-2 py-1 text-indigo-400">
                IAM & AUTH AUDIT
              </span>
              <span className="border border-warning/40 px-2 py-1 text-warning">
                INVESTIGATOR MODE
              </span>
            </div>
          </div>
          <div className="min-w-32 border border-border bg-background p-3">
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
              BOOKMARKED
            </div>
            <div className="mt-1 font-mono text-2xl text-primary">
              {bookmarks.length}
              <span className="text-sm text-muted-foreground"> / 15</span>
            </div>
          </div>
        </div>
      </AccessPanel>

      {/* Main Investigation Workspace: Left Evidence Vault, Right Record & Timeline */}
      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        {/* Evidence Vault */}
        <AccessPanel title="Access Evidence Vault" icon={FileSearch}>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search IDs, principals, roles, URIs, hashes, keywords..."
                className="w-full border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ACCESS_CATEGORIES.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`border px-2.5 py-1.5 font-mono text-[10px] tracking-wider transition-colors ${
                    category === item
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowBookmarkedOnly((value) => !value)}
              className={`flex items-center gap-2 border px-3 py-2 font-mono text-[10px] tracking-wider transition-colors ${
                showBookmarkedOnly
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Filter className="h-3 w-3" />
              {showBookmarkedOnly ? "SHOW ALL RECORDS" : "BOOKMARKS ONLY"}
            </button>

            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>{filteredEvidence.length} RECORDS MATCH</span>
              <span>UTC / TAMPER-VERIFIED LOGS</span>
            </div>

            <div className="max-h-[530px] space-y-2 overflow-y-auto pr-1">
              {filteredEvidence.map((record) => (
                <div
                  key={record.id}
                  className={`border transition-colors ${
                    selectedId === record.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <button onClick={() => setSelectedId(record.id)} className="w-full p-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {record.id}
                          </span>
                          <span
                            className={`border px-1.5 py-0.5 font-mono text-[9px] ${
                              CATEGORY_COLORS[record.category]
                            }`}
                          >
                            {record.category}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {record.time} UTC
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold">{record.title}</div>
                        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {record.summary}
                        </div>
                      </div>
                      {bookmarks.includes(record.id) && (
                        <BookmarkCheck className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </div>
                  </button>
                </div>
              ))}

              {filteredEvidence.length === 0 && (
                <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No access records match those filters.
                </div>
              )}
            </div>
          </div>
        </AccessPanel>

        {/* Right Side: Record Detail & Timeline */}
        <div className="space-y-5">
          <AccessPanel title="Record Inspection" icon={Search}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-primary">{selectedRecord.id}</div>
                <h3 className="mt-1 text-base font-semibold">{selectedRecord.title}</h3>
              </div>
              <button
                onClick={() => toggleBookmark(selectedRecord.id)}
                className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] tracking-wider transition-colors hover:border-primary"
              >
                {bookmarks.includes(selectedRecord.id) ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
                {bookmarks.includes(selectedRecord.id) ? "BOOKMARKED" : "BOOKMARK"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
              <AccessMetadata label="Timestamp" value={`${selectedRecord.time} UTC`} />
              <AccessMetadata label="Category" value={selectedRecord.category} />
              <div className="col-span-2 bg-background p-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  Source System / Host
                </div>
                <div className="mt-1 font-mono text-xs">{selectedRecord.source}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
                FORENSIC RECORD DETAIL
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {selectedRecord.detail}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {selectedRecord.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-border px-2 py-1 font-mono text-[9px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            <button
              onClick={() => toggleTimeline(selectedRecord.id)}
              className={`mt-4 flex w-full items-center justify-center gap-2 border px-3 py-2.5 font-mono text-xs tracking-wider transition-colors ${
                timelineIds.includes(selectedRecord.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary hover:text-primary"
              }`}
            >
              <Clock3 className="h-4 w-4" />
              {timelineIds.includes(selectedRecord.id)
                ? "REMOVE FROM ACCESS TIMELINE"
                : "ADD TO ACCESS TIMELINE"}
            </button>
          </AccessPanel>

          {/* Timeline Reconstruction Panel */}
          <AccessPanel title="Access Timeline Reconstruction" icon={Clock3}>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Assemble the chronological sequence of events demonstrating how identity, token,
              permissions, and configuration intersected to permit access. Separate true causal
              precursors from coincidental background noise.
            </p>

            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                RECONSTRUCTED SEQUENCE
              </span>
              <span className="font-mono text-xs text-primary">
                {timelineRecords.length} EVENTS SELECTED
              </span>
            </div>

            {timelineRecords.length > 0 ? (
              <div className="mt-3 space-y-2">
                {timelineRecords.map((record, index) => (
                  <div key={record.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/50 font-mono text-[10px] text-primary">
                        {index + 1}
                      </span>
                      {index < timelineRecords.length - 1 && (
                        <span className="h-7 w-px bg-border" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 border border-border bg-background p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-primary">
                          {record.time} UTC - {record.id}
                        </span>
                        <span
                          className={`border px-1 py-0.2 font-mono text-[8px] ${
                            CATEGORY_COLORS[record.category]
                          }`}
                        >
                          {record.category}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-semibold">{record.title}</div>
                    </div>
                    <button
                      onClick={() => toggleTimeline(record.id)}
                      className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remove ${record.id} from timeline`}
                    >
                      <span className="text-xs">X</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 border border-dashed border-border p-5 text-center">
                <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Inspect records and add relevant chronological access events here.
                </p>
              </div>
            )}
          </AccessPanel>
        </div>
      </div>

      {/* Investigator's Report Panel */}
      <AccessPanel title="Investigator's Report — Access & Identity" icon={ClipboardList}>
        <div className="mb-5 flex items-start gap-3 border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            A defensible forensic conclusion requires rigorous evidence citation, technical
            accuracy, and professional restraint. Distinguish confirmed authentication and
            authorization facts from assumptions about human intent. Do not attribute malice without
            corroborating proof.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Question 01: Primary Finding */}
          <div className="space-y-2 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              01 / Most Defensible Finding About How Access Occurred
            </label>
            <select
              value={finding}
              onChange={(event) => setFinding(event.target.value)}
              className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            >
              <option value="">Select your conclusion...</option>
              <option value="svc-exportbridge accessed the roadmap via a legitimate automated STS token and overprivileged inherited permissions triggered by Config v17; external delivery and human motive remain unestablished.">
                svc-exportbridge accessed the roadmap via a legitimate automated STS token and
                overprivileged inherited permissions triggered by Config v17; external delivery and
                human motive remain unestablished.
              </option>
              <option value="A rogue insider (m.vance) maliciously altered Config v17 and directly exfiltrated the roadmap during an admin SSH session.">
                A rogue insider (m.vance) maliciously altered Config v17 and directly exfiltrated
                the roadmap during an admin SSH session.
              </option>
              <option value="External adversaries compromised the svc-exportbridge private keys via brute-force VPN credentials to impersonate the service identity.">
                External adversaries compromised the svc-exportbridge private keys via brute-force
                VPN credentials to impersonate the service identity.
              </option>
              <option value="The alert was an authorization engine false positive and the restricted document was never retrieved from the secure vault.">
                The alert was an authorization engine false positive and the restricted document was
                never retrieved from the secure vault.
              </option>
            </select>
          </div>

          {/* Question 02: Evidence IDs */}
          <div className="space-y-2 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              02 / Supporting Evidence IDs
            </label>
            <input
              value={evidenceIds}
              onChange={(event) => setEvidenceIds(event.target.value)}
              placeholder="Example: IAM-POL-201, CFG-AUD-202, ACL-CHK-206, STS-ISS-208, AUTH-EVAL-212, OBJ-RET-213"
              className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              Provide the exact evidence IDs that substantiate your finding. Separate IDs with
              commas or spaces.
            </p>
          </div>

          {/* Question 03: Established vs Unknown */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              03 / What is Established vs. What Remains Unknown
            </label>
            <textarea
              value={establishedVsUnknown}
              onChange={(event) => setEstablishedVsUnknown(event.target.value)}
              rows={4}
              placeholder="Distinguish strictly what is technically established by the evidence versus what remains unknown or hypothetical (e.g., automated token mechanics vs committer intent; internal object streaming vs external exfiltration)."
              className="w-full resize-y border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">Minimum 40 characters.</p>
          </div>

          {/* Question 04: Alternative Explanation */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              04 / Alternative Plausible Explanation
            </label>
            <textarea
              value={alternative}
              onChange={(event) => setAlternative(event.target.value)}
              rows={4}
              placeholder="Formulate an alternative explanation (e.g., routine quarterly maintenance misconfiguration vs intentional insider evasion using a service identity) and explain what facts support or weaken it."
              className="w-full resize-y border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">Minimum 30 characters.</p>
          </div>

          {/* Question 05: Next Evidence Request */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              05 / Next Evidence Request & Justification
            </label>
            <textarea
              value={nextEvidence}
              onChange={(event) => setNextEvidence(event.target.value)}
              rows={4}
              placeholder="Specify the exact log, artifact, or corroborating source you would request next (e.g., PR code review approvals for commit a94f2b1, SEC-5519 ticket logs, or scheduler invocation parameters) and justify why."
              className="w-full resize-y border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">Minimum 30 characters.</p>
          </div>

          {/* Question 06: Reasoning & Chronology */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              06 / Chronological Sequence & Access Path Reasoning
            </label>
            <textarea
              value={reasoning}
              onChange={(event) => setReasoning(event.target.value)}
              rows={4}
              placeholder="Detail the chronological sequence of access events from configuration and policy setup to token issuance, request validation, ACL evaluation, and object retrieval. Explain why human logins did not cause this event."
              className="w-full resize-y border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">Minimum 50 characters.</p>
          </div>
        </div>

        {/* Submission Feedback & Score Breakdown */}
        {submitted && (
          <div className="mt-5 border border-primary/40 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-sm text-primary">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                STAGE 02 REPORT RECORDED LOCALLY
              </span>
              <span className="text-xs text-muted-foreground">FORENSIC QUALITY EVALUATION</span>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-mono text-3xl font-bold">{evaluation.totalScore}</span>
              <span className="font-mono text-sm text-muted-foreground">/ 100 POINTS</span>
              <span
                className={`ml-3 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  evaluation.totalScore >= 75
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : evaluation.totalScore >= 50
                      ? "border-warning/50 bg-warning/10 text-warning"
                      : "border-destructive/50 bg-destructive/10 text-destructive"
                }`}
              >
                {evaluation.totalScore >= 75
                  ? "DEFENSIBLE FORENSIC FINDING"
                  : evaluation.totalScore >= 50
                    ? "INCOMPLETE EVIDENCE SUPPORT"
                    : "UNSUBSTANTIATED SPECULATION"}
              </span>
            </div>

            {/* Criteria Breakdown Grid */}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs md:grid-cols-4">
              <div className="border border-border/60 bg-background/60 p-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Evidence Relevance
                </div>
                <div className="mt-1 font-mono text-sm text-primary">
                  {evaluation.evidenceScore} / 30
                </div>
              </div>

              <div className="border border-border/60 bg-background/60 p-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Distraction Discernment
                </div>
                <div className="mt-1 font-mono text-sm text-primary">
                  {evaluation.distractionScore} / 10
                </div>
              </div>

              <div className="border border-border/60 bg-background/60 p-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Finding Defensibility
                </div>
                <div className="mt-1 font-mono text-sm text-primary">
                  {evaluation.findingScore} / 15
                </div>
              </div>

              <div className="border border-border/60 bg-background/60 p-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Timeline Coherence
                </div>
                <div className="mt-1 font-mono text-sm text-primary">
                  {evaluation.timelineScore} / 15
                </div>
              </div>

              <div className="border border-border/60 bg-background/60 p-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Established vs Unknown
                </div>
                <div className="mt-1 font-mono text-sm text-primary">
                  {evaluation.establishedScore} / 10
                </div>
              </div>

              <div className="border border-border/60 bg-background/60 p-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Alternative Explanation
                </div>
                <div className="mt-1 font-mono text-sm text-primary">
                  {evaluation.alternativeScore} / 10
                </div>
              </div>

              <div className="border border-border/60 bg-background/60 p-2 col-span-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Next Evidence Request
                </div>
                <div className="mt-1 font-mono text-sm text-primary">
                  {evaluation.nextEvidenceScore} / 10
                </div>
              </div>
            </div>

            {/* Evaluator Remarks */}
            <div className="mt-3 rounded border border-border/60 bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                Evaluator Remarks:{" "}
              </span>
              {evaluation.isOptimalFinding ? (
                <span>
                  Excellent restraint. You correctly recognized that the service identity accessed
                  the resource via legitimate automated STS authentication and overprivileged ACL
                  inheritance, while properly acknowledging that external delivery and human motive
                  remain unproven.
                </span>
              ) : (
                <span>
                  Review your primary finding. Attributing the incident to human password
                  compromise, malicious exfiltration, or a false alarm conflicts with the
                  cryptographically verified STS tokens, HSM logs, and successful object read
                  events.
                </span>
              )}
              {evaluation.matchedDistractions.length > 0 && (
                <span className="mt-1 block text-warning">
                  Note: Your report cited coincidental distraction records (
                  {evaluation.matchedDistractions.join(", ")}). Correlate usernames, network
                  subnets, and failure semantics to separate false leads from the true access chain.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => void submitReport()}
            disabled={!reportComplete}
            className="flex items-center gap-2 bg-primary px-4 py-2.5 font-mono text-xs font-bold tracking-wider text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            SUBMIT INVESTIGATION REPORT
          </button>
          <button
            onClick={resetReport}
            className="flex items-center gap-2 border border-border px-4 py-2.5 font-mono text-xs tracking-wider transition-colors hover:border-primary"
          >
            <RotateCcw className="h-4 w-4" />
            RESET REPORT
          </button>
          {done && (
            <span className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-primary">
              <CheckCircle2 className="h-4 w-4" />
              STAGE COMPLETE
            </span>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Submitted reports are checked by the server. Sign in with Supabase configured to save
          stage progress to your account.
        </div>
        {submissionMessage && (
          <div className="mt-3 font-mono text-xs text-muted-foreground" role="status">
            {submissionMessage}
          </div>
        )}
      </AccessPanel>

      {/* Stage Completion Advancement Button */}
      {!done && submitted && (
        <div className="flex justify-end">
          <button
            onClick={onComplete}
            className="flex items-center gap-2 border border-primary px-5 py-3 font-mono text-xs font-bold tracking-wider text-primary transition-colors hover:bg-primary/10"
          >
            MARK STAGE 02 COMPLETE
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function AccessMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words font-mono text-xs">{value}</div>
    </div>
  );
}

function AccessPanel({
  title,
  icon: IconComponent,
  children,
}: {
  title: string;
  icon?: Icon;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-foreground">
        {IconComponent && <IconComponent className="h-4 w-4 text-primary" />}
        {title}
      </div>
      {children}
    </section>
  );
}
