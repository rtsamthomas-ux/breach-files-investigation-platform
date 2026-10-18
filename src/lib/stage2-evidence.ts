/**
 * ============================================================================
 * FORENSIC CASE SOLUTION KEY — DEVELOPER ONLY / INSTRUCTOR REFERENCE
 * CASE 07: THE GLASSHOUSE INCIDENT — STAGE 02: ACCESS INVESTIGATION
 * (DO NOT EXPOSE TO PARTICIPANT INTERFACE OR ACCESSIBLE CLIENT UI)
 * ============================================================================
 *
 * 1. INCIDENT SYNOPSIS & TECHNICAL CAUSALITY:
 *    - Identity involved: Service principal 'svc-exportbridge' (sp-99201-svc-eb)
 *      running on internal worker 'export-worker-03' (10.12.8.44).
 *    - Target resource: '/projects/glasshouse/roadmap' (Object: gh-roadmap-2027.enc).
 *    - Authentication mechanism: Valid, automated Workload Identity OAuth JWT
 *      minted by NovaCorp STS (sts-node-02) based on cryptographically verified
 *      AWS instance identity document (STS-ISS-208). No human credentials or
 *      interactive passwords were used.
 *    - Authorization mechanism: Permitted at Vault Authz Kernel (AUTH-EVAL-212)
 *      because:
 *      a) 'svc-exportbridge' held an overprivileged IAM policy role
 *         'ExportBridge-Worker-Role' granting 'vault:documents:read' across
 *         'arn:novacorp:vault:projects/*' without ABAC exclusions (IAM-POL-201).
 *      b) Storage container '/projects/glasshouse' was configured with default
 *         ACL inheritance ('INHERIT_PARENT=TRUE') permitting ExportBridge-Worker-Role
 *         read access; planned isolation ticket SEC-5519 was pending (ACL-CHK-206).
 *    - Trigger: Routine monthly cron schedule '0 9 17 * *' fired job EB-2041
 *      (SCH-LOG-209) executing configuration bundle v17 (CFG-DEP-203).
 *      Config v17 contained an expanded query regex '^/projects/(.*)/assets'
 *      committed by m.vance (CFG-AUD-202) which swept up the Glasshouse roadmap (WKR-CFG-210).
 *    - Access execution: Object payload (4.2 MB) decrypted via KMS master key and
 *      streamed over internal TLS 1.3 to export-worker-03 (OBJ-RET-213).
 *    - Key integrity: KMS and HSM partition audit confirms zero private key
 *      exfiltration or certificate tampering (KEY-ROT-215).
 *
 * 2. WHAT IS ESTABLISHED vs. WHAT REMAINS UNKNOWN:
 *    - Confirmed Established:
 *      * Legitimate machine authentication via STS workload federation.
 *      * Access permitted via combination of overprivileged wildcard IAM policy
 *        and inherited container ACLs.
 *      * Automated scheduled execution of job EB-2041.
 *      * Document retrieved and streamed to worker memory/staging.
 *      * Human user logins (s.alvarez, e.rostova) and build runner alert are
 *        unrelated to the document extraction.
 *    - Remains Unknown / Inconclusive:
 *      * Whether the regex change in Config v17 committed by m.vance was an
 *        unintentional configuration oversight or deliberate covert collection.
 *      * Why ticket SEC-5519 to isolate Glasshouse ACLs was delayed in review.
 *      * What occurred to package PKG-8842 after staging (external egress unproven).
 *
 * 3. DISTRACTIONS & CORRELATION DEBUNKING:
 *    - DISTRACTION 1 (AUTH-LOG-204): Failed VPN logins for s.alvarez at 09:05:40 UTC.
 *      * Debunking: Marketing user, residential ISP IP, forgot password, account locked.
 *        Zero privileges on vault-store, no connection to export-worker-03.
 *    - DISTRACTION 2 (DOC-WEB-205): Interactive web read by e.rostova at 09:15:22 UTC.
 *      * Debunking: Legitimate technical lead viewing roadmap on Confluence wiki with
 *        FIDO2 MFA token. Browser session, no API calls, no batch export connection.
 *    - DISTRACTION 3 (SEC-ALR-207): Sudo failure on build-node-07 by svc-buildrunner at 09:28:44 UTC.
 *      * Debunking: CI compile sandbox in DMZ-Build network, wrong service identity,
 *        isolated subnet with no routing to internal vault store.
 *    - RELEVANT BUT INCONCLUSIVE (ADM-SES-214): Admin SSH by m.vance at 09:41:20 UTC.
 *      * Debunking: Occurred AFTER the 09:40:00 investigation alert. Commands show
 *        routine operational triage (service status, error logs, uptime).
 *
 * 4. OPTIMAL PRIMARY FINDING:
 *    - "svc-exportbridge accessed the roadmap via a legitimate automated STS token and overprivileged inherited permissions triggered by Config v17; external delivery and human motive remain unestablished."
 *
 * 5. NEXT EVIDENCE REQUEST:
 *    - PR review history and communications for commit a94f2b1 (Config v17),
 *      audit logs for ticket SEC-5519, and scheduler invocation dispatch telemetry.
 * ============================================================================
 */

export type AccessCategory = "IAM" | "AUTH" | "CONFIG" | "ACCESS" | "AUDIT";

export type AccessRecord = {
  id: string;
  time: string;
  category: AccessCategory;
  source: string;
  title: string;
  summary: string;
  detail: string;
  tags: string[];
};

export const ACCESS_CATEGORIES = ["ALL", "IAM", "AUTH", "CONFIG", "ACCESS", "AUDIT"] as const;

export const ACCESS_EVIDENCE: AccessRecord[] = [
  {
    id: "IAM-POL-201",
    time: "07:45:12",
    category: "IAM",
    source: "Cloud IAM Controller / policy-engine-01",
    title: "Overprivileged service role policy definition active",
    summary:
      "Role ExportBridge-Worker-Role holds broad wildcard read permissions across internal project repositories.",
    detail:
      "IAM policy binding audit for identity 'svc-exportbridge' (principal ID: sp-99201-svc-eb) shows assignment of role 'ExportBridge-Worker-Role'. Permission statement Stmt-04 grants action 'vault:documents:read' with resource pattern 'arn:novacorp:vault:projects/*'. The policy contains no conditional attribute-based access control (ABAC) tags excluding 'classification:confidential' or 'project:glasshouse'. This role was provisioned during the Q2 infrastructure consolidation and has not been restricted since.",
    tags: ["IAM policy", "overprivileged", "wildcard", "svc-exportbridge"],
  },
  {
    id: "CFG-AUD-202",
    time: "08:12:30",
    category: "CONFIG",
    source: "GitLab Enterprise audit log / repo: infra/export-bridge",
    title: "Pipeline configuration v17 merged to master",
    summary:
      "Commit a94f2b1 by user m.vance updates ExportBridge sync selector to include all active project subtrees.",
    detail:
      "Commit metadata: SHA a94f2b189, committer: 'm.vance' (Infrastructure Engineer). Commit message: 'chore(config): update batch export query pattern for Q4 audit archival'. Diff inspection shows export_target_regex was changed from '^/projects/public/(.*)' to '^/projects/(.*)/assets'. While the commit note references quarterly archival requirements, the commit did not include peer review approvals in the branch protection log (bypass flag: emergency-infra-update). The record documents a configuration change; it does not prove malicious intent.",
    tags: ["config change", "v17", "m.vance", "regex expansion"],
  },
  {
    id: "CFG-DEP-203",
    time: "08:15:10",
    category: "CONFIG",
    source: "Deployment Orchestrator / deploy-worker-02",
    title: "Configuration release v17 deployed to worker cluster",
    summary: "ExportBridge cluster workers reload configuration bundle v17 without restart.",
    detail:
      "Deployment pipeline job DPL-9941 pushed configuration bundle 'eb-config-v17.json' to cluster nodes export-worker-01 through export-worker-04. Checksum verification SHA256:8f2a1b9c confirmed synchronized configuration. Active daemon status reported READY. The automated deployment log records execution of the pipeline, not who scheduled the downstream job.",
    tags: ["deployment", "v17", "export-worker-03", "automated"],
  },
  {
    id: "AUTH-LOG-204",
    time: "09:05:40",
    category: "AUTH",
    source: "Edge VPN Gateway / Okta SSO audit",
    title: "Repeated failed interactive logins for remote user",
    summary: "Three failed password attempts recorded for user s.alvarez from residential ISP IP.",
    detail:
      "Account 's.alvarez' (Marketing Coordinator) generated 3 consecutive failed authentication events (ERR_BAD_CREDENTIAL) on the corporate client VPN portal from IP 198.51.100.84 within 45 seconds, resulting in a temporary 15-minute lock. Geo-location matches employee residence. Cross-correlation confirms s.alvarez has no privileges on vault-store, no access to ExportBridge, and no connection to export-worker-03. This is a typical forgotten password event with no causal link to Case 07.",
    tags: ["distraction", "failed login", "s.alvarez", "unrelated user"],
  },
  {
    id: "DOC-WEB-205",
    time: "09:15:22",
    category: "ACCESS",
    source: "Internal Confluence / Document Wiki audit",
    title: "Legitimate interactive roadmap review by Project Lead",
    summary:
      "User e.rostova accesses Glasshouse roadmap wiki page via standard browser session with hardware 2FA.",
    detail:
      "Interactive web request: GET /wiki/projects/glasshouse/roadmap from workstation ws-corp-204 (IP 10.14.22.88). User identity: 'e.rostova' (Glasshouse Technical Lead). Session authenticated via FIDO2 hardware token with active MFA. User viewed the document for 6 minutes before logging out. Web server access logs indicate standard HTML browser rendering, zero API calls to ExportBridge, and no batch data extraction. This is documented, authorized business activity by the project owner.",
    tags: ["distraction", "legitimate user", "e.rostova", "browser session"],
  },
  {
    id: "ACL-CHK-206",
    time: "09:22:15",
    category: "ACCESS",
    source: "Vault Object ACL Manager / acl-daemon-01",
    title: "Storage container ACL hierarchy audit snapshot",
    summary:
      "Container /projects/glasshouse inherited default root ACLs rather than applying confidential isolation overrides.",
    detail:
      "Storage ACL audit snapshot shows path '/projects/glasshouse' was created 14 days prior with ACL flag 'INHERIT_PARENT=TRUE'. Parent container '/projects' permits READ to principals holding role 'ExportBridge-Worker-Role' and group 'Security-Archival-Automation'. An isolation policy ticket (SEC-5519) requesting explicit deny for automated export services on Glasshouse remained in status 'PENDING_REVIEW' at incident time. The service identity held access by default inheritance.",
    tags: ["ACL inheritance", "missing isolation", "governance gap", "read permitted"],
  },
  {
    id: "SEC-ALR-207",
    time: "09:28:44",
    category: "AUDIT",
    source: "Host SIEM Agent / build-node-07",
    title: "Privilege escalation alert on CI build agent",
    summary:
      "Process sudo elevation failure flagged for identity svc-buildrunner in compile sandbox.",
    detail:
      "Security event SIG-8812 triggered on build-node-07: identity 'svc-buildrunner' attempted to execute '/usr/bin/cat /etc/shadow' via sudo with nopasswd flag, resulting in command denial (EXIT_CODE 1). Investigation reveals an automated container build script for an unrelated customer frontend project misconfigured its sudoers template. Build-node-07 resides in DMZ-Build network with no connectivity to internal vault storage or ExportBridge workers.",
    tags: ["distraction", "build farm", "svc-buildrunner", "sudo failure"],
  },
  {
    id: "STS-ISS-208",
    time: "09:32:04",
    category: "AUTH",
    source: "NovaCorp Security Token Service (STS) / sts-node-02",
    title: "Workload identity OAuth token issued to svc-exportbridge",
    summary:
      "Automated token request validated via instance identity document; short-lived JWT issued.",
    detail:
      "Workload Identity Federation request: Host export-worker-03 (AWS instance id i-0488219ae3) presented cryptographically signed instance identity document to STS endpoint. STS verified host binding, matched service principal 'svc-exportbridge', and minted OAuth JWT token (Token ID: tok_eb_98412) with validity 3600 seconds. Claims: sub='svc-exportbridge', iss='sts.novacorp.internal', aud='vault.novacorp.internal', roles=['ExportBridge-Worker-Role']. No human passwords or interactive credentials were used or presented.",
    tags: ["STS token", "workload identity", "JWT", "tok_eb_98412"],
  },
  {
    id: "SCH-LOG-209",
    time: "09:32:08",
    category: "CONFIG",
    source: "ExportBridge Job Scheduler / eb-scheduler-01",
    title: "Job EB-2041 instantiated from quarterly batch template",
    summary: "Scheduled cron trigger launches job EB-2041 referencing configuration bundle v17.",
    detail:
      "Scheduler trigger: Schedule ID 'sched-q4-archival' fired at 09:32:08 UTC on standard cron schedule '0 9 17 * *' (every 17th of the month at 09:00 UTC, delayed by 32 minutes due to queue backlog). Job descriptor: EB-2041, configVersion: 17, assignedWorker: export-worker-03. The scheduler log demonstrates the execution occurred via an automated queue schedule, not an ad-hoc CLI invocation from an engineer's shell.",
    tags: ["scheduler", "EB-2041", "cron trigger", "config v17"],
  },
  {
    id: "WKR-CFG-210",
    time: "09:34:55",
    category: "CONFIG",
    source: "ExportBridge Worker Runtime / export-worker-03",
    title: "Worker compiles repository export manifest from v17 regex",
    summary:
      "Worker evaluates active regex '^/projects/(.*)/assets' against document store catalog, matching Glasshouse.",
    detail:
      "Execution trace: Process eb-worker (PID 4410) on export-worker-03 parsed active configuration rule 'export_target_regex'. Evaluation against storage catalog matched 42 project paths, including '/projects/glasshouse/roadmap' (evaluated as matching assets query due to legacy file classification mapping). Manifest ID MNF-4412 generated. This confirms how the restricted project was enumerated by the automated workflow.",
    tags: ["worker runtime", "query evaluation", "manifest", "MNF-4412"],
  },
  {
    id: "API-VAL-211",
    time: "09:36:15",
    category: "AUTH",
    source: "API Gateway Security Filter / gw-edge-01",
    title: "Inbound API request validated against STS public keys",
    summary:
      "Gateway validates token tok_eb_98412 signature and claims for URI /projects/glasshouse/roadmap.",
    detail:
      "Gateway request: GET /api/v2/vault/projects/glasshouse/roadmap. Authorization header: 'Bearer tok_eb_98412'. Cryptographic signature verified against STS JWKS endpoint. Audience 'vault.novacorp.internal' accepted. Request originated from source IP 10.12.8.44 (export-worker-03). The gateway confirmed valid authentication token format; downstream authorization delegated to Vault Storage Service.",
    tags: ["API gateway", "token validation", "bearer token", "export-worker-03"],
  },
  {
    id: "AUTH-EVAL-212",
    time: "09:36:18",
    category: "IAM",
    source: "Vault Authorization Kernel / vault-authz-01",
    title: "Authorization decision: PERMIT evaluated for svc-exportbridge",
    summary:
      "Authz kernel grants read access based on Role:ExportBridge-Worker-Role matching inherited container rule.",
    detail:
      "Authorization evaluation record AuthZ-889102: Subject: svc-exportbridge. Requested Action: vault:documents:read. Target Resource: /projects/glasshouse/roadmap. Evaluation steps: 1) Explicit Deny evaluated: NONE. 2) Resource ACL evaluated: INHERITED_PERMIT from parent '/projects'. 3) Role evaluation: ExportBridge-Worker-Role matches Stmt-04. Decision: ALLOW. Resulting capability: Read stream permitted. This record directly proves that access succeeded because permissions were overprivileged and container inheritance was permissive.",
    tags: ["authorization", "ALLOW", "inherited ACL", "overprivileged role"],
  },
  {
    id: "OBJ-RET-213",
    time: "09:37:02",
    category: "ACCESS",
    source: "Secure Enclave Object Store / vault-store-01",
    title: "Binary object payload streamed to worker endpoint",
    summary:
      "Encrypted object 'gh-roadmap-2027.enc' decrypted in memory and streamed (4.2 MB) to export-worker-03.",
    detail:
      "Object access log: Object Key 'vault://projects/glasshouse/gh-roadmap-2027.enc' accessed. Payload size: 4,412,896 bytes (4.2 MB). KMS key 'arn:novacorp:kms:vault-master-key' used for envelope decryption. Data streamed over TLS 1.3 to client 10.12.8.44 (export-worker-03). This confirms document retrieval from storage occurred. Note: Object access logs record bytes transmitted across internal network to worker; they do not establish external exfiltration or delivery to an unauthorized party.",
    tags: ["object retrieval", "payload streamed", "KMS decrypt", "4.2 MB"],
  },
  {
    id: "ADM-SES-214",
    time: "09:41:20",
    category: "AUDIT",
    source: "Bastion Host Audit / bastion-corp-01",
    title: "Admin SSH session opened to worker cluster after alert",
    summary:
      "Engineer m.vance initiates SSH session to export-worker-03 following telemetry warning.",
    detail:
      "Interactive SSH session opened from bastion-corp-01 (user: m.vance) to export-worker-03 at 09:41:20 UTC. Session history shows commands: 'systemctl status exportbridge-daemon', 'cat /var/log/exportbridge/current.log | grep -i err', and 'uptime'. Session terminated at 09:44:02 UTC. The timing is shortly after the 09:40:00 investigation alert. It is consistent with operational triage; it does not contain file export or credential alteration commands.",
    tags: ["admin session", "m.vance", "operational triage", "inconclusive"],
  },
  {
    id: "KEY-ROT-215",
    time: "09:43:10",
    category: "AUDIT",
    source: "KMS Certificate Manager / kms-audit-01",
    title: "Service credential lifecycle audit confirms uncompromised keys",
    summary:
      "No private key extraction or unauthorized rotation detected for svc-exportbridge certificate pair.",
    detail:
      "Cryptographic audit of certificate serial #04:9A:F1:88 (bound to svc-exportbridge) verifies private key remained inside HSM partition 'hsm-partition-sec-02'. Zero private key export operations recorded. Last legitimate rotation occurred 45 days prior. This record supports the finding that access occurred through legitimate service architecture and API channels, not via compromised private keys or certificate theft.",
    tags: ["KMS audit", "HSM", "no private key theft", "valid credential"],
  },
];
