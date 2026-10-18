/**
 * ============================================================================
 * FORENSIC CASE SOLUTION KEY — DEVELOPER ONLY / INSTRUCTOR REFERENCE
 * CASE 07: THE GLASSHOUSE INCIDENT — STAGE 04: WITNESS INVESTIGATION (THE WITNESS ROOM)
 * (DO NOT EXPOSE TO PARTICIPANT INTERFACE OR ACCESSIBLE CLIENT UI)
 * ============================================================================
 *
 * 1. WITNESS CREDIBILITY & SCOPE OF KNOWLEDGE:
 *    - MIRA VANCE (Infrastructure Engineer):
 *      * Factual Reliability: HIGH regarding technical configuration mechanics (authored commit a94f2b1,
 *        used emergency bypass, logged in post-alert for triage).
 *      * Intent / Malice: UNPROVEN. Logs show no data export commands during SSH triage; regex expansion
 *        may have been a careless oversight rather than deliberate sabotage.
 *      * Contradiction: Claims partner destination was timing out in morning logs (ST-MV-06), but
 *        records show no connection attempt was logged.
 *    - ELENA ROSTOVA (Project Lead):
 *      * Factual Reliability: HIGH regarding project confidentiality, wiki viewing at 09:15 UTC,
 *        and filing isolation ticket SEC-5519.
 *      * Speculation: Accuses Mira Vance of premeditated sabotage (ST-ER-05) based purely on timing.
 *      * Key Corroboration: Confirms that the marketing server file was the public press preview (ST-ER-04).
 *    - JONAH PIKE (Incident Response Analyst):
 *      * Factual Reliability: HIGH regarding alert generation (09:40:00 UTC) and triage portal login (09:42:20 UTC).
 *      * Major Analytical Error: Claims the 4.4 MB proxy POST at 09:40:45 UTC was the roadmap leaving (ST-JP-06).
 *        Contradicted by proxy logs showing the request came from telemetry-daemon-01 (10.12.8.99), not export-worker-03.
 *      * Good Triage: Correctly dismissed VPN brute force (s.alvarez) and build server sudo alerts (svc-buildrunner).
 *    - RAVI SEN (ExportBridge Operations Engineer):
 *      * Factual Reliability: HIGH regarding scheduled cron execution (EB-2041), STS instance identity tokens,
 *        and the meaning of status 'COMPLETED' (local staging only, not remote delivery).
 *      * Key Explanation: Correctly identified the flow-collector-01 clock skew (-120.4s) explaining the timing anomaly (ST-RS-05).
 *      * Unverified: Claims partner certificates were expired (ST-RS-06); uncorroborated by partner inquiry records.
 *
 * 2. CASE WALL CLAIMS GROUND TRUTH:
 *    - CW-01: Mira's config v17 merged with emergency bypass -> CORROBORATED (CFG-AUD-202, ST-MV-01, ST-MV-02).
 *    - CW-02: Elena's 09:15 UTC wiki access triggered the export -> CONTRADICTED (DOC-WEB-205, SCH-LOG-209).
 *    - CW-03: 4.4 MB proxy POST proves external exfiltration -> CONTRADICTED (ART-PRX-312, NET-13, ST-JP-06).
 *    - CW-04: Job EB-2041 ran via automated machine token -> CORROBORATED (STS-ISS-208, API-VAL-211, ST-RS-02).
 *    - CW-05: Flow collector 09:37:41 proves extraction preceded staging -> CONTRADICTED (ART-LOG-306, ST-RS-05).
 *    - CW-06: Records conclusively prove Mira Vance acted with deliberate malice -> UNVERIFIED (CFG-AUD-202, ADM-SES-214, ST-MV-03).
 * ============================================================================
 */

export type StatementStatus = "corroborated" | "contradicted" | "unverified";

export type WitnessStatement = {
  id: string;
  timestamp: string;
  topic: string;
  question: string;
  answer: string;
  evidentiaryStatus: StatementStatus;
  linkedEvidenceIds: string[];
  forensicNote: string;
};

export type WitnessProfile = {
  id: string;
  name: string;
  role: string;
  department: string;
  clearanceLevel: string;
  avatarColor: string;
  summary: string;
  scopeOfKnowledge: string[];
  statements: WitnessStatement[];
};

export type CaseWallClaim = {
  id: string;
  claimText: string;
  sourceWitness: string;
  description: string;
  expectedStatus: StatementStatus;
  keyEvidenceIds: string[];
  solutionExplanation: string;
};

export const WITNESS_PROFILES: WitnessProfile[] = [
  {
    id: "WIT-MV",
    name: "Mira Vance",
    role: "Senior Infrastructure Engineer",
    department: "Cloud Platforms & Automation",
    clearanceLevel: "Level 3 (Infrastructure)",
    avatarColor: "violet",
    summary:
      "Authored commit a94f2b1 introducing ExportBridge Config v17 under an emergency bypass flag. Initiated an administrative SSH session to export-worker-03 shortly after the investigation alert.",
    scopeOfKnowledge: [
      "ExportBridge deployment pipeline and configuration v17",
      "GitLab repository infra/export-bridge and merge policies",
      "Bastion host access and worker node maintenance",
    ],
    statements: [
      {
        id: "ST-MV-01",
        timestamp: "08:12:30 UTC Context",
        topic: "Configuration v17 Merge",
        question: "Why did you push configuration bundle v17 to master at 08:12 UTC?",
        answer:
          "I updated the export_target_regex query to '^/projects/(.*)/assets' because our Q4 audit compliance deadline was approaching and the previous filter missed active sub-projects.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["CFG-AUD-202", "CFG-DEP-203"],
        forensicNote:
          "Corroborated by commit a94f2b1 in GitLab audit logs showing the exact regex change for Q4 archival.",
      },
      {
        id: "ST-MV-02",
        timestamp: "08:12:30 UTC Context",
        topic: "Emergency Bypass Flag",
        question:
          "Why did you use the emergency-infra-update flag instead of awaiting peer review?",
        answer:
          "The regular CI/CD merge queue was stalled with a four-hour backlog, and the monthly batch schedule was due to run. Emergency bypass is standard protocol when deploying routine config syncs.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["CFG-AUD-202"],
        forensicNote:
          "Corroborated by GitLab branch protection log recording bypass flag 'emergency-infra-update'.",
      },
      {
        id: "ST-MV-03",
        timestamp: "08:15:00 UTC Context",
        topic: "Inclusion of Project Glasshouse",
        question: "Did you intend for Project Glasshouse to be swept into the export batch?",
        answer:
          "No. I assumed any confidential or embargoed projects had storage-level ACL isolation or explicit Deny tags that would block generic worker accounts.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["IAM-POL-201", "ACL-CHK-206"],
        forensicNote:
          "Corroborated by ACL audit showing container /projects/glasshouse inherited permissive root ACLs; planned isolation ticket SEC-5519 was pending.",
      },
      {
        id: "ST-MV-04",
        timestamp: "09:41:20 UTC Context",
        topic: "Post-Alert SSH Session",
        question: "Why did you initiate an SSH session to export-worker-03 at 09:41:20 UTC?",
        answer:
          "I saw an automated telemetry alert in our internal channel warning of high memory utilization on worker-03. I logged in via bastion-corp-01 to inspect process health.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["ADM-SES-214", "AUTH-11"],
        forensicNote:
          "Corroborated by bastion session logs showing login at 09:41:20 UTC, 80 seconds after alert AUTH-11.",
      },
      {
        id: "ST-MV-05",
        timestamp: "09:44:02 UTC Context",
        topic: "Commands Executed on Worker",
        question: "Did you copy, exfiltrate, or alter any staged files during that SSH session?",
        answer:
          "Absolutely not. I ran systemctl status, checked recent error lines in current.log, saw the job had finished, checked uptime, and disconnected immediately.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["ADM-SES-214"],
        forensicNote:
          "Corroborated by command audit showing only 'systemctl status', 'grep -i err', and 'uptime'; session terminated at 09:44:02 UTC.",
      },
      {
        id: "ST-MV-06",
        timestamp: "09:45:00 UTC Context",
        topic: "External Delivery Status",
        question:
          "Do you know if the staged roadmap package was delivered to the partner destination?",
        answer:
          "I believe the external destination was failing connections anyway. I noticed outbound socket timeout errors in the morning routing table logs.",
        evidentiaryStatus: "unverified",
        linkedEvidenceIds: ["ART-RES-313", "SYS-12"],
        forensicNote:
          "Unverified / Challenged: Worker logs record job COMPLETED without network timeout errors, and partner inquiry ART-RES-313 records no connection attempts rather than timeout errors.",
      },
    ],
  },
  {
    id: "WIT-ER",
    name: "Elena Rostova",
    role: "Project Technical Lead",
    department: "Advanced R&D / Project Glasshouse",
    clearanceLevel: "Level 4 (Confidential R&D)",
    avatarColor: "cyan",
    summary:
      "Technical Lead for Project Glasshouse. Authenticated via corporate workstation ws-corp-204 with hardware FIDO2 MFA at 09:15 UTC to review the roadmap wiki before the morning sprint meeting.",
    scopeOfKnowledge: [
      "Project Glasshouse architecture and roadmap contents",
      "Sensitivity classifications and customer embargo agreements",
      "Document isolation policies and pending ticket SEC-5519",
    ],
    statements: [
      {
        id: "ST-ER-01",
        timestamp: "09:15:22 UTC Context",
        topic: "Morning Document Access",
        question: "Why did you open the Glasshouse roadmap document at 09:15 UTC?",
        answer:
          "I reviewed the roadmap wiki page from my office workstation to prepare slides for our 10:00 UTC leadership sprint review. I was on the page for about six minutes.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["DOC-WEB-205"],
        forensicNote:
          "Corroborated by Confluence wiki logs showing authenticated browser GET from ws-corp-204 with FIDO2 MFA, lasting 6 minutes.",
      },
      {
        id: "ST-ER-02",
        timestamp: "09:15:00 UTC Context",
        topic: "Export Authorization",
        question: "Did you or anyone on your team authorize an automated export of the roadmap?",
        answer:
          "Under no circumstances. Glasshouse is under strict partner non-disclosure. Any external transmission requires written VP sign-off and PGP envelope encryption.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["ART-OBJ-303", "ART-RES-313"],
        forensicNote:
          "Corroborated by Vault storage classification tags ('classification:confidential') and absence of any authorized export ticket.",
      },
      {
        id: "ST-ER-03",
        timestamp: "09:22:00 UTC Context",
        topic: "Storage Isolation Request",
        question:
          "Were you aware that service accounts held read access to your project container?",
        answer:
          "We flagged that exact risk two weeks ago. We submitted ticket SEC-5519 requesting immediate ACL isolation for the /projects/glasshouse vault path.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["ACL-CHK-206"],
        forensicNote:
          "Corroborated by ACL audit record showing ticket SEC-5519 remained in status 'PENDING_REVIEW' at incident time.",
      },
      {
        id: "ST-ER-04",
        timestamp: "09:30:00 UTC Context",
        topic: "Public Marketing Server Rumors",
        question:
          "Rumors suggest the roadmap was found on an internal marketing file share. Did you put it there?",
        answer:
          "No, that's completely false. I looked at that file myself. It's just the generic Q4 marketing product catalog with a duplicate filename, not our confidential roadmap.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["ART-DUP-305", "ART-SAN-314"],
        forensicNote:
          "Corroborated by Stage 3 integrity analysis: ART-DUP-305 is a 1.2 MB marketing catalog and ART-SAN-314 is a 512 KB press release, neither matching the confidential roadmap.",
      },
      {
        id: "ST-ER-05",
        timestamp: "09:40:00 UTC Context",
        topic: "Attribution and Sabotage Accusation",
        question: "Who do you believe is responsible for staging the roadmap?",
        answer:
          "It has to be Mira Vance. Pushing an unreviewed emergency commit thirty minutes before a scheduled batch export cannot be a coincidence. It looks like deliberate insider theft.",
        evidentiaryStatus: "unverified",
        linkedEvidenceIds: ["CFG-AUD-202", "ADM-SES-214"],
        forensicNote:
          "Unverified / Speculative: Accusation assumes malicious intent based on temporal correlation. Technical evidence does not prove Vance intended to extract confidential data or acted with malice.",
      },
      {
        id: "ST-ER-06",
        timestamp: "10:00:00 UTC Context",
        topic: "Roadmap Payload Sensitivity",
        question: "What specific risk does the staged roadmap payload represent?",
        answer:
          "The 4.2 MB archive contains unencrypted next-generation optical sensor schematics and firmware signing certificates scheduled for release in late 2027.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["OBJ-RET-213", "ART-OBJ-303"],
        forensicNote:
          "Corroborated by object size (4,412,896 bytes) and KMS decryption audit records for gh-roadmap-2027.enc.",
      },
    ],
  },
  {
    id: "WIT-JP",
    name: "Jonah Pike",
    role: "Senior Incident Response Analyst",
    department: "Security Operations Center (SOC)",
    clearanceLevel: "Level 3 (Security Operations)",
    avatarColor: "amber",
    summary:
      "Triage lead for alert AUTH-11 (SEC-ALT-9941). Authenticated to the case management portal at 09:42:20 UTC to claim the ticket, correlate SIEM signals, and evaluate potential perimeter exfiltration.",
    scopeOfKnowledge: [
      "SOC SIEM detection rules and alert timestamps",
      "Edge firewall telemetry and forward proxy logging",
      "Triage assessment of decoy signals and false alarms",
    ],
    statements: [
      {
        id: "ST-JP-01",
        timestamp: "09:40:00 UTC Context",
        topic: "Alert Generation",
        question: "What specific rule triggered security alert SEC-ALT-9941 at 09:40:00 UTC?",
        answer:
          "The alert was fired by SIEM rule RULE-EXP-77: a restricted vault read by a non-human identity followed immediately by an archive staging event on an export worker.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["AUTH-11", "EXP-09"],
        forensicNote: "Corroborated by security monitoring record AUTH-11 and worker event EXP-09.",
      },
      {
        id: "ST-JP-02",
        timestamp: "09:42:20 UTC Context",
        topic: "Portal Login Record",
        question: "Why does your username appear in the identity logs at 09:42:20 UTC?",
        answer:
          "That was my interactive sign-in to the case management portal to open incident file BF-007, review telemetry, and assign triage tickets to the network team.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["AUTH-14"],
        forensicNote:
          "Corroborated by identity audit AUTH-14 showing analyst interactive login to the case-management portal.",
      },
      {
        id: "ST-JP-03",
        timestamp: "09:05:00 UTC Context",
        topic: "Evaluation of Failed VPN Logins",
        question: "Did you investigate the three failed logins for user s.alvarez at 09:05 UTC?",
        answer:
          "Yes, we checked immediately. It was an employee on residential broadband entering an expired password for corporate webmail. Zero connection to vault storage or ExportBridge.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["AUTH-LOG-204"],
        forensicNote:
          "Corroborated by edge VPN audit: s.alvarez is a marketing coordinator with no access to vault storage or worker clusters.",
      },
      {
        id: "ST-JP-04",
        timestamp: "09:28:00 UTC Context",
        topic: "Build Server Privilege Escalation",
        question: "What about the sudo elevation alert on build-node-07 at 09:28 UTC?",
        answer:
          "We investigated that as a possible lateral movement decoy. It turned out to be a broken CI container script in the isolated DMZ-Build network attempting cat /etc/shadow. No path to vault storage.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["SEC-ALR-207"],
        forensicNote:
          "Corroborated by host SIEM record SEC-ALR-207 confirming isolation in DMZ-Build subnet.",
      },
      {
        id: "ST-JP-05",
        timestamp: "09:39:53 UTC Context",
        topic: "Egress Monitoring Extract",
        question: "Did the perimeter egress logs show the roadmap leaving the network?",
        answer:
          "Our primary egress extract from 09:30 to 09:45 UTC showed no large outbound flow matching export-worker-03. However, perimeter logging is sampled at 1:100, so absence of evidence is not proof of non-delivery.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["NET-10", "ART-EGR-309"],
        forensicNote:
          "Corroborated by egress monitoring NET-10 and firewall sample ART-EGR-309 (packet slicing and sampled telemetry).",
      },
      {
        id: "ST-JP-06",
        timestamp: "09:40:45 UTC Context",
        topic: "Proxy Telemetry Transfer Claim",
        question: "Did you find any outbound flow that you believed was the roadmap leaving?",
        answer:
          "We flagged a 4.4 MB outbound POST on the forward proxy at 09:40:45 UTC. Given the size match, I initially assessed that the roadmap was exfiltrated to an external cloud endpoint.",
        evidentiaryStatus: "contradicted",
        linkedEvidenceIds: ["ART-PRX-312", "NET-13"],
        forensicNote:
          "Contradicted: Technical records prove that the 4.4 MB POST came from telemetry-daemon-01 (10.12.8.99), not export-worker-03 (10.12.8.44). Jonah mistook routine metric telemetry for exfiltration.",
      },
    ],
  },
  {
    id: "WIT-RS",
    name: "Ravi Sen",
    role: "Lead Operations Engineer",
    department: "Batch Data & Export Operations",
    clearanceLevel: "Level 3 (Workload Operations)",
    avatarColor: "amber",
    summary:
      "Oversees the ExportBridge cluster, scheduler daemon eb-scheduler-01, and workload identity service accounts. Explains the automated nature of job EB-2041 and daemon completion semantics.",
    scopeOfKnowledge: [
      "ExportBridge job scheduler eb-scheduler-01 and cron configurations",
      "Workload Identity Federation and STS token issuance",
      "Network flow collector timing and NTP synchronization",
      "Local staging spool mechanics and daemon status semantics",
    ],
    statements: [
      {
        id: "ST-RS-01",
        timestamp: "09:32:08 UTC Context",
        topic: "Job Trigger Mechanism",
        question: "Was job EB-2041 triggered manually by an operator or engineer?",
        answer:
          "No. Job EB-2041 was an automated execution from cron schedule 'sched-q4-archival'. It fires on the 17th of every month at 09:00 UTC, delayed by 32 minutes due to queue backlog.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["SCH-01", "SCH-LOG-209"],
        forensicNote: "Corroborated by scheduler audit SCH-01 and job execution trace SCH-LOG-209.",
      },
      {
        id: "ST-RS-02",
        timestamp: "09:32:04 UTC Context",
        topic: "Service Identity Token Minting",
        question: "Did job EB-2041 use human credentials or a service account?",
        answer:
          "It ran under workload identity svc-exportbridge. The host presented its AWS instance document to STS, which minted short-lived JWT tok_eb_98412. No human password was used.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["AUTH-05", "STS-ISS-208"],
        forensicNote:
          "Corroborated by STS token issuance log STS-ISS-208 confirming automated instance identity federation.",
      },
      {
        id: "ST-RS-03",
        timestamp: "09:34:00 UTC Context",
        topic: "Overprivileged Role Assignment",
        question: "Why was svc-exportbridge permitted to access confidential directories?",
        answer:
          "The ExportBridge-Worker-Role was granted wildcard read on arn:novacorp:vault:projects/* during the Q2 infrastructure consolidation so export scripts wouldn't fail on new subdirectories.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["IAM-POL-201", "AUTH-EVAL-212"],
        forensicNote:
          "Corroborated by IAM policy binding IAM-POL-201 and authorization decision AUTH-EVAL-212.",
      },
      {
        id: "ST-RS-04",
        timestamp: "09:40:31 UTC Context",
        topic: "Meaning of Status COMPLETED",
        question: "The worker log shows job EB-2041 COMPLETED. Does that prove external delivery?",
        answer:
          "Not in our codebase. In ExportBridge, COMPLETED simply means the tar.gz archive was generated and written to /var/spool/exportbridge/stage. External delivery is handled by a secondary queue.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["SYS-12", "EXP-09", "ART-EXP-302"],
        forensicNote:
          "Corroborated by worker architecture: staging to disk is confirmed, but external delivery queue records are separate and uncorroborated.",
      },
      {
        id: "ST-RS-05",
        timestamp: "09:37:41 UTC Context",
        topic: "Collector Timing Discrepancy",
        question:
          "Why did flow-collector-01 record an internal connection at 09:37:41 before staging at 09:39:41?",
        answer:
          "Flow-collector-01 had an active NTP sync failure all morning with a -120.4 second clock drift. When you add the two-minute offset, the actual event time was 09:39:41.4 UTC.",
        evidentiaryStatus: "corroborated",
        linkedEvidenceIds: ["ART-LOG-306", "NET-07"],
        forensicNote:
          "Corroborated by collector log ART-LOG-306: NTP_DESYNC_FAIL / offset: -120.400s confirms true UTC alignment.",
      },
      {
        id: "ST-RS-06",
        timestamp: "09:40:00 UTC Context",
        topic: "Partner Endpoint Routing",
        question: "Did the delivery queue attempt transmission to the external partner endpoint?",
        answer:
          "Our delivery queue was blocked because the partner TLS certificates expired earlier that morning, causing all outbound dispatch threads to immediately abort.",
        evidentiaryStatus: "unverified",
        linkedEvidenceIds: ["ART-RES-313", "ART-EGR-309"],
        forensicNote:
          "Unverified: Partner inquiry ART-RES-313 states ticket response is pending with no logs available; technical logs show no certificate expiration error records.",
      },
    ],
  },
];

export const CASE_WALL_CLAIMS: CaseWallClaim[] = [
  {
    id: "CW-01",
    claimText:
      "Configuration bundle v17 was pushed by Mira Vance under an emergency bypass flag without required peer review approvals.",
    sourceWitness: "Mira Vance (ST-MV-01, ST-MV-02)",
    description:
      "Assess whether the code commit that altered the project export regex was executed outside standard branch protection policies.",
    expectedStatus: "corroborated",
    keyEvidenceIds: ["CFG-AUD-202", "ST-MV-01", "ST-MV-02"],
    solutionExplanation:
      "Corroborated: GitLab audit logs (CFG-AUD-202) confirm commit a94f2b1 by m.vance used the emergency-infra-update bypass flag without peer sign-off.",
  },
  {
    id: "CW-02",
    claimText:
      "Elena Rostova's interactive web viewing of the roadmap at 09:15 UTC triggered the ExportBridge batch export job.",
    sourceWitness: "Speculation / Defense Theory",
    description:
      "Determine whether the Project Lead's morning browser session initiated or influenced automated job EB-2041.",
    expectedStatus: "contradicted",
    keyEvidenceIds: ["DOC-WEB-205", "SCH-LOG-209", "ST-ER-01", "ST-RS-01"],
    solutionExplanation:
      "Contradicted: Rostova's access was an interactive Confluence wiki view (DOC-WEB-205). Job EB-2041 was initiated by an automated monthly cron trigger (SCH-LOG-209) with zero API linkage to the wiki.",
  },
  {
    id: "CW-03",
    claimText:
      "The 4.4 MB outbound POST on forward proxy-cluster-01 at 09:40:45 UTC represents external exfiltration of package PKG-8842.",
    sourceWitness: "Jonah Pike (ST-JP-06)",
    description:
      "Evaluate whether the proxy connection flagged by the SOC analyst matches the worker node or staged roadmap package.",
    expectedStatus: "contradicted",
    keyEvidenceIds: ["ART-PRX-312", "NET-13", "ST-JP-06"],
    solutionExplanation:
      "Contradicted: Endpoint correlation confirms the proxy transfer originated from telemetry-daemon-01 (10.12.8.99), not export-worker-03 (10.12.8.44). Pike conflated telemetry with case data.",
  },
  {
    id: "CW-04",
    claimText:
      "Job EB-2041 authenticated using automated Workload Identity federation without presenting interactive human user credentials.",
    sourceWitness: "Ravi Sen (ST-RS-02)",
    description:
      "Check whether token issuance for svc-exportbridge was automated through host instance attestation or human password presentation.",
    expectedStatus: "corroborated",
    keyEvidenceIds: ["STS-ISS-208", "API-VAL-211", "ST-RS-02"],
    solutionExplanation:
      "Corroborated: NovaCorp STS logs (STS-ISS-208) verify token tok_eb_98412 was minted via signed AWS instance identity documents for principal svc-exportbridge.",
  },
  {
    id: "CW-05",
    claimText:
      "The flow collector connection logged at 09:37:41 UTC proves that document extraction occurred before package staging began.",
    sourceWitness: "Timeline Anomaly Theory",
    description:
      "Determine whether the logged connection time represents an impossible chronological causality violation.",
    expectedStatus: "contradicted",
    keyEvidenceIds: ["ART-LOG-306", "ST-RS-05", "EXP-09"],
    solutionExplanation:
      "Contradicted: Flow-collector-01 suffered an NTP sync failure with an offset of -120.400s. Normalized True UTC time is 09:39:41.4 UTC, which coincides exactly with package staging.",
  },
  {
    id: "CW-06",
    claimText:
      "The available technical records conclusively prove that Mira Vance acted with deliberate malicious intent to steal the roadmap.",
    sourceWitness: "Elena Rostova (ST-ER-05)",
    description:
      "Assess whether authoring an unreviewed regex change and initiating a post-alert triage SSH session constitutes conclusive proof of criminal intent.",
    expectedStatus: "unverified",
    keyEvidenceIds: ["CFG-AUD-202", "ADM-SES-214", "ST-MV-03", "ST-ER-05"],
    solutionExplanation:
      "Unverified: While Vance authored the unreviewed regex change and logged in post-alert, technical evidence does not establish whether the query was an operational oversight or intentional theft. Attributing deliberate criminal intent is unproven.",
  },
];

export const CONFERENCE_ACCOUNTS = [
  {
    id: "CONF-ACC-1",
    label:
      "Job EB-2041 was an automated cron execution running Config v17 that accessed the roadmap via overprivileged service role permissions and inherited ACLs; external delivery remains unproven.",
    isOptimal: true,
  },
  {
    id: "CONF-ACC-2",
    label:
      "Elena Rostova extracted the roadmap through her 09:15 UTC wiki session and forwarded it to marketing file shares.",
    isOptimal: false,
  },
  {
    id: "CONF-ACC-3",
    label:
      "Jonah Pike proved external exfiltration via the 4.4 MB forward proxy transfer at 09:40:45 UTC.",
    isOptimal: false,
  },
  {
    id: "CONF-ACC-4",
    label:
      "External attackers compromised the VPN using s.alvarez's credentials and assumed control of the ExportBridge worker.",
    isOptimal: false,
  },
] as const;

export const CONFERENCE_UNRESOLVED = [
  {
    id: "CONF-UNRES-1",
    label:
      "Whether Mira Vance's regex expansion in Config v17 was a negligent operational oversight or intentional insider sabotage, and whether the staged package ever traversed the external boundary.",
    isOptimal: true,
  },
  {
    id: "CONF-UNRES-2",
    label:
      "Whether the SHA-256 algorithm produced hash collisions between marketing files and confidential archives.",
    isOptimal: false,
  },
  {
    id: "CONF-UNRES-3",
    label: "Whether Elena Rostova remembered her corporate laptop password.",
    isOptimal: false,
  },
] as const;

export const CONFERENCE_EXPLAINED_CONTRADICTIONS = [
  {
    id: "CONF-EXP-1",
    label:
      "The apparent 09:37:41 flow collector transfer preceding package staging is reconciled by the documented -120.4 second NTP clock skew on flow-collector-01.",
    isOptimal: true,
  },
  {
    id: "CONF-EXP-2",
    label:
      "The duplicate marketing file proves that two different files can share the exact same cryptographic SHA-256 hash.",
    isOptimal: false,
  },
  {
    id: "CONF-EXP-3",
    label:
      "Jonah Pike's proxy exfiltration claim is valid because telemetry packets are secretly encrypted archives.",
    isOptimal: false,
  },
] as const;

export const CONFERENCE_NEXT_INQUIRIES = [
  {
    id: "CONF-INQ-1",
    label:
      "Subpoena GitLab commit a94f2b1 branch telemetry and PR draft comments, review ticket SEC-5519 administrative delays, and obtain external partner edge firewall PCAPs.",
    isOptimal: true,
  },
  {
    id: "CONF-INQ-2",
    label:
      "Immediately terminate Mira Vance for felony data theft based on git commit history alone.",
    isOptimal: false,
  },
  {
    id: "CONF-INQ-3",
    label:
      "Delete all collector logs to prevent clock skew discrepancies from confusing leadership.",
    isOptimal: false,
  },
] as const;
