/**
 * Stage 5: Incident Response Data & Solution Reference
 * Case 07: The Glasshouse Incident - NovaCorp Cyber Forensics
 *
 * Forensics ground truth:
 * - svc-exportbridge held wildcard permissions in config v17.
 * - Glasshouse roadmap was accessed and PKG-8842 was staged.
 * - Staged package hash matches the acquired artifact.
 * - Working copy hash difference was due to standard tar timestamp metadata.
 * - External network egress or receipt has NOT been established.
 * - Deliberate human sabotage has NOT been established.
 */

export type ContainmentCategory = "appropriate" | "disproportionate" | "destructive";
export type ActionPriority = "immediate" | "secondary" | "inappropriate";

export type ContainmentAction = {
  id: string;
  title: string;
  description: string;
  category: ContainmentCategory;
  recommendedPriority: ActionPriority;
  riskAssessment: string;
  forensicImpact: string;
};

export const CONTAINMENT_ACTIONS: ContainmentAction[] = [
  {
    id: "ACT-01",
    title: "Suspend ExportBridge Scheduled Job (EB-2041)",
    description:
      "Temporarily pause the cron trigger and active job queues for ExportBridge on export-worker-03.",
    category: "appropriate",
    recommendedPriority: "immediate",
    riskAssessment:
      "Low risk. Halts further automated scans and potential staging of restricted project data without service-wide disruption.",
    forensicImpact:
      "Preserves operational state; stops new jobs from overwriting transient execution queues.",
  },
  {
    id: "ACT-02",
    title: "Revoke Wildcard Scope & Apply Least-Privilege IAM",
    description:
      "Modify svc-exportbridge container role and IAM policy to remove broad wildcard paths (/projects/*) and restrict to approved public release directories.",
    category: "appropriate",
    recommendedPriority: "immediate",
    riskAssessment:
      "Low risk to core services. Immediately closes the unauthorized access path to confidential project repositories.",
    forensicImpact: "Eliminates privilege elevation path without altering past audit logs.",
  },
  {
    id: "ACT-03",
    title: "Forensically Preserve System, Auth & Config Logs",
    description:
      "Create cryptographic snapshots and export audit logs from the scheduler, worker, identity provider (STS), and git repository.",
    category: "appropriate",
    recommendedPriority: "immediate",
    riskAssessment:
      "Zero operational disruption. Crucial for non-repudiation and preventing log rotation.",
    forensicImpact:
      "Protects critical digital evidence from automatic rollover or accidental erasure.",
  },
  {
    id: "ACT-04",
    title: "Secure & Quarantine Staged Package (PKG-8842)",
    description:
      "Lock read/write access to the internal staging bucket directory for PKG-8842 and record its verified SHA-256 hash.",
    category: "appropriate",
    recommendedPriority: "immediate",
    riskAssessment:
      "Zero operational disruption. Prevents any downstream ingestion or accidental deletion.",
    forensicImpact:
      "Preserves the primary physical evidence artifact for independent cryptographic verification.",
  },
  {
    id: "ACT-05",
    title: "Review & Rotate Active Service Tokens",
    description:
      "Audit currently active STS session tokens issued to svc-exportbridge and force token invalidation for existing sessions.",
    category: "appropriate",
    recommendedPriority: "secondary",
    riskAssessment:
      "Minor transient reconnect for batch workers. Prevents replay of any compromised bearer tokens.",
    forensicImpact:
      "Terminates active sessions while preserving token issuance history in auth logs.",
  },
  {
    id: "ACT-06",
    title: "Shut Down All Corporate Exports & Customer Pipelines",
    description:
      "Impose an indefinite emergency shutdown on all data exports across every NovaCorp division.",
    category: "disproportionate",
    recommendedPriority: "inappropriate",
    riskAssessment:
      "Severe commercial and operational harm. Unwarranted because only ExportBridge configuration v17 is implicated.",
    forensicImpact:
      "Generates massive noise in telemetry and disrupts standard operational baselines unnecessarily.",
  },
  {
    id: "ACT-07",
    title: "Immediately Delete Staged Package from Storage",
    description:
      "Purge PKG-8842 and all temporary staging files from the object store immediately to mitigate leak risk.",
    category: "destructive",
    recommendedPriority: "inappropriate",
    riskAssessment:
      "Catastrophic forensic spoliation. Destroys the primary artifact required to prove what was accessed and staged.",
    forensicImpact:
      "Destroys physical evidence and renders independent file verification impossible.",
  },
  {
    id: "ACT-08",
    title: "Wipe & Re-image Worker Host (export-worker-03)",
    description:
      "Format the export worker instance and deploy a clean operating system image immediately.",
    category: "destructive",
    recommendedPriority: "inappropriate",
    riskAssessment:
      "Severe evidence destruction. Wipes volatile memory, container runtime layers, swap files, and uncommitted log buffers.",
    forensicImpact:
      "Anti-forensic outcome; eliminates critical host-based evidence needed to establish the execution environment.",
  },
];

export type PreservationSource = {
  id: string;
  sourceName: string;
  system: string;
  category: "critical" | "high" | "distractor";
  recommendedPriority: 1 | 2 | 3 | 4; // 1 = highest, 4 = lowest / distractor
  description: string;
  acquisitionMethod: string;
};

export const PRESERVATION_SOURCES: PreservationSource[] = [
  {
    id: "SRC-01",
    sourceName: "Scheduler & Worker Runtime Logs",
    system: "export-worker-03 / ExportBridge daemon",
    category: "critical",
    recommendedPriority: 1,
    description:
      "Execution logs for job EB-2041, container start/exit events, standard output, and process timestamps.",
    acquisitionMethod: "Read-only container log dump and forensic disk snapshot.",
  },
  {
    id: "SRC-02",
    sourceName: "IAM Policy & Configuration Commit History",
    system: "Internal GitLab / IAM Policy Engine",
    category: "critical",
    recommendedPriority: 1,
    description:
      "Commit a94f2b1 diff, author metadata, review trail, and version 17 configuration deployment timestamps.",
    acquisitionMethod: "Git commit archive with GPG signature validation and policy JSON snapshot.",
  },
  {
    id: "SRC-03",
    sourceName: "Authentication & STS Token Issuance Audit",
    system: "NovaCorp Central Identity Provider (STS)",
    category: "critical",
    recommendedPriority: 1,
    description:
      "Token generation requests for svc-exportbridge (STS-ISS-208), role assumption logs, and client IP addresses.",
    acquisitionMethod: "SIEM audit query export with cryptographic integrity seal.",
  },
  {
    id: "SRC-04",
    sourceName: "Staged Package Artifact & Storage Access Logs",
    system: "Object Storage (vault-store.novacorp.internal)",
    category: "critical",
    recommendedPriority: 1,
    description: "Raw staged archive PKG-8842, S3 bucket PUT/GET access logs, and object metadata.",
    acquisitionMethod: "Bitstream copy with SHA-256 calculation and read-only bucket lock.",
  },
  {
    id: "SRC-05",
    sourceName: "Egress Proxy & Perimeter Firewall Flow Records",
    system: "NovaCorp Border Gateway & Forward Proxy",
    category: "high",
    recommendedPriority: 2,
    description:
      "Network flow records and proxy logs covering export-worker-03 between 09:30 and 10:00 UTC.",
    acquisitionMethod: "NetFlow collector PCAP/flow-export and forward-proxy access log export.",
  },
  {
    id: "SRC-06",
    sourceName: "CI/CD Deployment & Change Approval Records",
    system: "NovaCorp Deployment Pipeline",
    category: "high",
    recommendedPriority: 2,
    description:
      "Deployment pipeline run logs, merge approvals, and automated security test results for config v17.",
    acquisitionMethod: "Pipeline audit trail export and change management ticket export.",
  },
  {
    id: "SRC-07",
    sourceName: "External Partner Gateway Logs & Recipient Records",
    system: "Partner SFTP / B2B API Endpoints",
    category: "high",
    recommendedPriority: 2,
    description:
      "Inbound transmission logs from authorized recipient endpoints to verify whether any payload arrived.",
    acquisitionMethod: "Formal partner log request and mutual TLS handshake audit verification.",
  },
  {
    id: "SRC-08",
    sourceName: "Marketing Division Web Browsing Cache",
    system: "design-laptop-12",
    category: "distractor",
    recommendedPriority: 4,
    description: "Web cache and DNS lookups from design-laptop-12 (updates.example.net).",
    acquisitionMethod: "Not relevant to ExportBridge server execution; low-priority distractor.",
  },
  {
    id: "SRC-09",
    sourceName: "General HR Portal Morning Login Logs",
    system: "hr-portal.novacorp.internal",
    category: "distractor",
    recommendedPriority: 4,
    description: "Routine SSO sign-ins for HR staff between 08:00 and 09:00 UTC.",
    acquisitionMethod: "Unrelated administrative traffic; no technical connection to the incident.",
  },
  {
    id: "SRC-10",
    sourceName: "Build Server Vendor Mirror Downloads",
    system: "build-cache-02",
    category: "distractor",
    recommendedPriority: 4,
    description: "High-volume external package repository mirror synchronization.",
    acquisitionMethod: "Standard routine infrastructure traffic; confirmed unrelated in Stage 1.",
  },
];

export type ScopeQuestion = {
  id: string;
  topic: string;
  question: string;
  guidance: string;
  keyConcerns: string[];
};

export const SCOPE_QUESTIONS: ScopeQuestion[] = [
  {
    id: "SCP-01",
    topic: "Broad Configuration Pattern Match",
    question:
      "Which other confidential projects or repositories were exposed by the /projects/* wildcard in ExportBridge config v17?",
    guidance:
      "Examine whether other restricted project directories (e.g., Project BlueSky, Project Citadel) were read or staged during scheduled runs under config v17.",
    keyConcerns: [
      "Check storage access logs for any READ events under /projects/* during config v17 deployment window.",
      "Verify whether other restricted repos were included in the export manifest.",
      "Determine exact timestamp window between config v17 commit and job execution.",
    ],
  },
  {
    id: "SCP-02",
    topic: "Identity Access Surface & Role Inheritance",
    question:
      "What other data stores, databases, or microservices could svc-exportbridge reach with its current IAM permissions?",
    guidance:
      "Audit the full policy document of the svc-exportbridge container role to check if permissions extended beyond internal document storage.",
    keyConcerns: [
      "Review attached policies for wildcard S3 actions (s3:GetObject, s3:ListBucket).",
      "Check cross-account trust relationships and external role assumptions.",
      "Ensure service account cannot access production customer databases.",
    ],
  },
  {
    id: "SCP-03",
    topic: "Concurrent Worker Instances & Scheduled Pipelines",
    question:
      "Were other worker hosts or pipeline jobs running concurrently under the same configuration?",
    guidance:
      "Determine whether export-worker-01 or export-worker-02 were also provisioned with config v17 and whether they processed jobs.",
    keyConcerns: [
      "Inspect Kubernetes/cluster scheduler pod replicas during 09:30–09:45 UTC.",
      "Confirm only export-worker-03 executed job EB-2041.",
      "Check for queued jobs waiting in the ExportBridge broker.",
    ],
  },
  {
    id: "SCP-04",
    topic: "Credential Sharing & Lateral Persistence",
    question:
      "Do other services, automated batch jobs, or developer environments share the svc-exportbridge credentials?",
    guidance:
      "Verify that svc-exportbridge is strictly bound to the container runtime via STS instance profile rather than static API keys.",
    keyConcerns: [
      "Confirm no static access keys exist for svc-exportbridge in IAM.",
      "Verify STS tokens expire within 60 minutes.",
      "Confirm no hardcoded keys in git repositories or environment variables.",
    ],
  },
  {
    id: "SCP-05",
    topic: "External Delivery Verification",
    question:
      "Did any external destination or unauthorized endpoint receive the staged package PKG-8842?",
    guidance:
      "Cross-correlate firewall egress flows, DNS queries, proxy logs, and partner endpoint confirmation.",
    keyConcerns: [
      "Acknowledge that network flow logs do not record package IDs.",
      "Check upstream border router NetFlow for flows matching PKG-8842 size (~1.2MB).",
      "Request partner SFTP transfer server logs for the matching timeframe.",
    ],
  },
  {
    id: "SCP-06",
    topic: "Root Cause & Intent Classification",
    question:
      "Was the incident caused by configuration oversight, control failure, or deliberate insider sabotage?",
    guidance:
      "Distinguish technical configuration error from unsubstantiated claims of criminal malice.",
    keyConcerns: [
      "Mira Vance documented commit a94f2b1 as a routine path consolidation.",
      "No anomalous interactive access or external communications were found on her workstation.",
      "Classify root cause as deficient change control and excessive wildcard permissions, not proven malice.",
    ],
  },
];

export type FactHypothesisItem = {
  id: string;
  statement: string;
  correctCategory:
    "confirmed_fact" | "reasonable_hypothesis" | "unresolved_question" | "unsupported_claim";
  explanation: string;
};

export const FACT_HYPOTHESIS_ITEMS: FactHypothesisItem[] = [
  {
    id: "FH-01",
    statement:
      "The svc-exportbridge identity presented a valid token and successfully read the Glasshouse roadmap.",
    correctCategory: "confirmed_fact",
    explanation: "Corroborated by AUTH-05, DOC-06, and STS-ISS-208 showing READ_SUCCESS.",
  },
  {
    id: "FH-02",
    statement:
      "Package PKG-8842 was staged in internal storage with a cryptographic hash matching the acquired artifact.",
    correctCategory: "confirmed_fact",
    explanation: "Corroborated by EXP-09, EVD-RAW-001, and EVD-RAW-007; hash verified in Stage 3.",
  },
  {
    id: "FH-03",
    statement:
      "The working copy hash discrepancy was caused by standard tar archive re-creation timestamps, not content alteration.",
    correctCategory: "confirmed_fact",
    explanation:
      "Established in Stage 3: inner file contents are identical, tarball timestamp diff accounted for hash change.",
  },
  {
    id: "FH-04",
    statement:
      "The ExportBridge job targeted the roadmap because configuration v17 introduced a broad /projects/* wildcard match.",
    correctCategory: "reasonable_hypothesis",
    explanation:
      "Technically supported by commit diff a94f2b1 and config audit CFG-AUD-202, though the scheduler engine logic is an inference.",
  },
  {
    id: "FH-05",
    statement:
      "The staged package may have remained un-transmitted because the worker process crashed or completed without an active egress socket.",
    correctCategory: "reasonable_hypothesis",
    explanation:
      "Consistent with the absence of correlating egress flows in NET-10 and worker COMPLETED status without delivery confirmation.",
  },
  {
    id: "FH-06",
    statement: "Whether any external partner or third-party server received PKG-8842.",
    correctCategory: "unresolved_question",
    explanation:
      "Cannot be proven either way from internal logs alone; requires partner B2B logs and upstream ISP flows.",
  },
  {
    id: "FH-07",
    statement:
      "Whether Mira Vance intended for confidential projects to be swept into the public export bridge.",
    correctCategory: "unresolved_question",
    explanation:
      "Records establish she authored the commit, but intent (mistake vs negligence vs intent) is unverified.",
  },
  {
    id: "FH-08",
    statement:
      "Foreign cyber actors or malicious competitors actively exfiltrated the Glasshouse roadmap across the perimeter.",
    correctCategory: "unsupported_claim",
    explanation:
      "Completely unsupported by evidence; contradicts network flow logs and verified artifact staging location.",
  },
  {
    id: "FH-09",
    statement:
      "Elena Rostova initiated the export during her 08:45 web review session to steal intellectual property.",
    correctCategory: "unsupported_claim",
    explanation:
      "Contradicted: her session was a standard interactive web read via intranet portal, completely separate from EB-2041 batch job.",
  },
  {
    id: "FH-10",
    statement:
      "The file hash difference between working copies proves a covert malware payload or rootkit was injected.",
    correctCategory: "unsupported_claim",
    explanation:
      "Contradicted by byte-level metadata extraction in Stage 3 showing identical member checksums.",
  },
];

export type ResponseDecisionOption = {
  id: string;
  label: string;
  verdict: "proportionate" | "overreactive" | "negligent";
  isOptimal: boolean;
  description: string;
  implications: string;
};

export const RESPONSE_DECISION_OPTIONS: ResponseDecisionOption[] = [
  {
    id: "DEC-OPT-01",
    label:
      "Declare Internal Access & Staging Contained; Investigate Potential Egress as Unconfirmed",
    verdict: "proportionate",
    isOptimal: true,
    description:
      "Acknowledge internally that overprivileged service credentials accessed and staged confidential roadmap data within internal infrastructure. Contain the workflow, enforce least-privilege policies, preserve all forensic artifacts, and perform external partner log reconciliation before making definitive breach notifications.",
    implications:
      "Defensible, evidence-grounded stance. Avoids false market alarm or premature regulatory reporting of data theft while properly treating the internal exposure with highest forensic priority.",
  },
  {
    id: "DEC-OPT-02",
    label: "Declare Confirmed Critical External Data Exfiltration & File Public Breach Disclosure",
    verdict: "overreactive",
    isOptimal: false,
    description:
      "Notify regulatory bodies, media, and shareholders that Project Glasshouse was stolen and exfiltrated by threat actors outside the company perimeter.",
    implications:
      "Factually erroneous and legally reckless. Claims external theft when network evidence shows zero confirmed external transmission and the artifact remained in internal staging.",
  },
  {
    id: "DEC-OPT-03",
    label: "Close Incident as Benign False Alarm with No Corrective Action",
    verdict: "negligent",
    isOptimal: false,
    description:
      "Treat the alert as a routine test artifact because the worker reported COMPLETED and no external IP was observed, taking no policy action.",
    implications:
      "Grossly irresponsible. Leaves the overprivileged wildcard configuration active in production, risking recurring exposures of sensitive projects.",
  },
];

export type SafeRecoveryStep = {
  id: string;
  title: string;
  recommended: boolean;
  description: string;
};

export const SAFE_RECOVERY_STEPS: SafeRecoveryStep[] = [
  {
    id: "REC-01",
    title: "Explicit Path Whitelisting in Configuration v18",
    recommended: true,
    description:
      "Replace all wildcard expressions with an explicit, enumerated whitelist of non-confidential project paths (e.g. /projects/public-releases/*).",
  },
  {
    id: "REC-02",
    title: "Container-Level IAM Least-Privilege Scoping",
    recommended: true,
    description:
      "Scope the svc-exportbridge STS role to read-only access strictly bounded to public bucket prefixes.",
  },
  {
    id: "REC-03",
    title: "Dry-Run & Synthetic Data Pipeline Testing",
    recommended: true,
    description:
      "Execute test runs of the ExportBridge workflow using synthetic mock data in an isolated staging VPC before resuming production cron jobs.",
  },
  {
    id: "REC-04",
    title: "Continuous SIEM Anomaly Detection & Canary Files",
    recommended: true,
    description:
      "Deploy automated detection alerts for any read request targeting confidential tags (Glasshouse, Citadel) and place canary honeypot files in storage.",
  },
  {
    id: "REC-05",
    title: "Two-Person Review Rule for Export Configuration Changes",
    recommended: true,
    description:
      "Enforce mandatory peer review and InfoSec sign-off on any git merge modifying export filters or IAM roles.",
  },
  {
    id: "REC-06",
    title: "Immediate Resumption of Weekly Cron Without Configuration Verification",
    recommended: false,
    description:
      "Re-enable scheduled jobs immediately to meet operational reporting deadlines before validating the permissions fix.",
  },
];

export interface IncidentResponseState {
  phase1: {
    selectedActionIds: string[];
    actionPriorities: Record<string, "immediate" | "secondary">;
    justification: string;
  };
  phase2: {
    selectedSourceIds: string[];
    sourcePriorities: Record<string, 1 | 2 | 3 | 4>;
    custodian: string;
    acquisitionMethod: string;
    evidenceLockerLocation: string;
    chainOfCustodyNotes: string;
  };
  phase3: {
    scopeResponses: Record<string, string>;
    selectedRecoveryStepIds: string[];
    recoveryPlanRationale: string;
  };
  phase4: {
    decisionId: string;
    classifications: Record<string, string>;
    decisionRationale: string;
    nextInvestigationSteps: string;
  };
}

export const INITIAL_RESPONSE_STATE: IncidentResponseState = {
  phase1: {
    selectedActionIds: [],
    actionPriorities: {},
    justification: "",
  },
  phase2: {
    selectedSourceIds: [],
    sourcePriorities: {},
    custodian: "",
    acquisitionMethod: "",
    evidenceLockerLocation: "",
    chainOfCustodyNotes: "",
  },
  phase3: {
    scopeResponses: {},
    selectedRecoveryStepIds: [],
    recoveryPlanRationale: "",
  },
  phase4: {
    decisionId: "",
    classifications: {},
    decisionRationale: "",
    nextInvestigationSteps: "",
  },
};

export interface IncidentResponseScoreBreakdown {
  containmentScore: number;
  preservationScore: number;
  scopeScore: number;
  decisionScore: number;
  reportScore: number;
  total: number;
  hasDestructiveActions: boolean;
  hasDisproportionateShutdown: boolean;
  hasUnsafeRecovery: boolean;
  declaredPrematureBreach: boolean;
}

export function calculateIncidentResponseScore(
  state: IncidentResponseState,
): IncidentResponseScoreBreakdown {
  const { phase1, phase2, phase3, phase4 } = state;

  // 1. Containment (max 20)
  let containmentScore = 0;
  const appropriateSelected = phase1.selectedActionIds.filter((id) => {
    const action = CONTAINMENT_ACTIONS.find((a) => a.id === id);
    return action?.category === "appropriate";
  });
  containmentScore += appropriateSelected.length * 4; // up to 20

  // Penalties for destructive or disproportionate actions
  if (phase1.selectedActionIds.includes("ACT-06")) containmentScore -= 6; // disproportionate shutdown
  if (phase1.selectedActionIds.includes("ACT-07")) containmentScore -= 10; // deleting staged package
  if (phase1.selectedActionIds.includes("ACT-08")) containmentScore -= 10; // wiping worker
  containmentScore = Math.max(0, Math.min(20, containmentScore));

  // 2. Evidence Preservation (max 20)
  let preservationScore = 0;
  const criticalSelected = phase2.selectedSourceIds.filter((id) => {
    const src = PRESERVATION_SOURCES.find((s) => s.id === id);
    return src?.category === "critical";
  });
  preservationScore += criticalSelected.length * 3; // up to 12

  const highSelected = phase2.selectedSourceIds.filter((id) => {
    const src = PRESERVATION_SOURCES.find((s) => s.id === id);
    return src?.category === "high";
  });
  preservationScore += Math.min(6, highSelected.length * 2); // up to 6

  // Penalties for high-priority distractors
  const distractorP1 = phase2.selectedSourceIds.filter((id) => {
    const src = PRESERVATION_SOURCES.find((s) => s.id === id);
    return src?.category === "distractor" && phase2.sourcePriorities[id] === 1;
  });
  preservationScore -= distractorP1.length * 3;

  if (phase2.chainOfCustodyNotes.trim().length >= 20) preservationScore += 2;
  preservationScore = Math.max(0, Math.min(20, preservationScore));

  // 3. Scope & Recovery (max 20)
  let scopeScore = 0;
  const answeredCount = Object.values(phase3.scopeResponses).filter(
    (v) => v && v.trim().length >= 15,
  ).length;
  scopeScore += Math.min(10, answeredCount * 2); // up to 10

  const recommendedSteps = phase3.selectedRecoveryStepIds.filter((id) => {
    const step = SAFE_RECOVERY_STEPS.find((s) => s.id === id);
    return step?.recommended;
  });
  scopeScore += Math.min(8, recommendedSteps.length * 2); // up to 8

  if (phase3.selectedRecoveryStepIds.includes("REC-06")) scopeScore -= 6; // resuming unverified cron
  if (phase3.recoveryPlanRationale.trim().length >= 20) scopeScore += 2;
  scopeScore = Math.max(0, Math.min(20, scopeScore));

  // 4. Response Decision & Fact Classification (max 20)
  let decisionScore = 0;
  if (phase4.decisionId === "DEC-OPT-01") {
    decisionScore += 10; // optimal proportionate stance
  }

  let correctClassifications = 0;
  FACT_HYPOTHESIS_ITEMS.forEach((item) => {
    if (phase4.classifications[item.id] === item.correctCategory) {
      correctClassifications += 1;
    }
  });
  decisionScore += Math.min(10, correctClassifications); // 1 pt per correct item
  decisionScore = Math.max(0, Math.min(20, decisionScore));

  // 5. Final Report & Forensic Integrity (max 20)
  let reportScore = 0;
  if (phase1.justification.trim().length >= 25) reportScore += 4;
  if (phase2.chainOfCustodyNotes.trim().length >= 25) reportScore += 4;
  if (phase3.recoveryPlanRationale.trim().length >= 25) reportScore += 4;
  if (phase4.decisionRationale.trim().length >= 25) reportScore += 4;
  if (phase4.nextInvestigationSteps.trim().length >= 20) reportScore += 4;
  reportScore = Math.max(0, Math.min(20, reportScore));

  const total = containmentScore + preservationScore + scopeScore + decisionScore + reportScore;

  return {
    containmentScore,
    preservationScore,
    scopeScore,
    decisionScore,
    reportScore,
    total,
    hasDestructiveActions:
      phase1.selectedActionIds.includes("ACT-07") || phase1.selectedActionIds.includes("ACT-08"),
    hasDisproportionateShutdown: phase1.selectedActionIds.includes("ACT-06"),
    hasUnsafeRecovery: phase3.selectedRecoveryStepIds.includes("REC-06"),
    declaredPrematureBreach: phase4.decisionId === "DEC-OPT-02",
  };
}
