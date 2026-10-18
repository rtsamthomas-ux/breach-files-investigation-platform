/**
 * ============================================================================
 * FORENSIC CASE SOLUTION KEY — DEVELOPER ONLY / INSTRUCTOR REFERENCE
 * CASE 07: THE GLASSHOUSE INCIDENT — STAGE 03: EVIDENCE ANALYSIS (THE EVIDENCE LAB)
 * (DO NOT EXPOSE TO PARTICIPANT INTERFACE OR ACCESSIBLE CLIENT UI)
 * ============================================================================
 *
 * 1. SCIENTIFIC & FORENSIC PROBLEM:
 *    What can investigators reliably establish regarding the identity, integrity,
 *    provenance, and relationships of the collected digital artifacts?
 *
 * 2. ARTIFACT PROVENANCE & CLASSIFICATION KEY:
 *    - ART-ACQ-301: Original Evidence (Bitstream triage acquisition of pkg-8842.tar.gz from worker-03 spool).
 *    - ART-EXP-302: Original Evidence (Runtime export manifest from worker-03 recording pkg-8842 digest).
 *    - ART-OBJ-303: Original Evidence (Encrypted raw object gh-roadmap-2027.enc from Vault storage).
 *    - ART-WRK-304: Verified Working Copy (Analyst triage copy with pax headers added during local re-tar).
 *    - ART-DUP-305: Unrelated / Insufficiently Connected (1.2 MB marketing catalog with identical filename).
 *    - ART-LOG-306: Original Evidence (Collector flow log with -120.4s NTP clock offset).
 *    - ART-VER-307: Original Evidence (Independent secondary SHA-256 verification of primary image).
 *    - ART-COC-308: Original Evidence (Signed chain of custody handoff record).
 *    - ART-EGR-309: Provenance Incomplete (Truncated sampled perimeter firewall pcap without payloads).
 *    - ART-EVD-310: Original Evidence (Cryptographically sealed evidence container inventory).
 *    - ART-KMS-311: Original Evidence (HSM master key envelope decryption audit log).
 *    - ART-PRX-312: Unrelated / Insufficiently Connected (Proxy POST from telemetry-daemon-01, not worker-03).
 *    - ART-RES-313: Provenance Incomplete (Partner inquiry ticket pending, zero delivery receipt).
 *    - ART-SAN-314: Unrelated / Insufficiently Connected (Public marketing roadmap press preview).
 *
 * 3. HASH COMPARISONS & INTEGRITY DYNAMICS:
 *    - ART-ACQ-301 vs ART-EXP-302:
 *      * Bit-for-bit identical (SHA-256: 7f83b165...d9069).
 *      * Proves the forensically acquired archive is authentic to what worker-03 staged.
 *    - ART-ACQ-301 vs ART-VER-307:
 *      * Bit-for-bit identical (SHA-256: 7f83b165...d9069).
 *      * Proves bitstream integrity preserved across chain of custody.
 *    - ART-ACQ-301 vs ART-WRK-304:
 *      * Different digests (9c1b48... vs 7f83b1...).
 *      * Analyst added 72 bytes of pax extended headers; NOT malicious tampering.
 *    - ART-ACQ-301 vs ART-DUP-305:
 *      * Incomparable / different content.
 *      * Same filename 'pkg-8842.tar.gz', but size is 1.2 MB vs 4.4 MB; marketing catalog.
 *    - ART-ACQ-301 vs ART-OBJ-303:
 *      * Different digests because ART-OBJ-303 is raw encrypted object (4,412,896 bytes)
 *        while ART-ACQ-301 is tar.gz package (4,418,240 bytes) containing encapsulation.
 *
 * 4. CROSS-ARTIFACT CLAIMS:
 *    - Claim 1 (Staged package consistency): SUPPORTED by ART-ACQ-301, ART-EXP-302, ART-VER-307.
 *    - Claim 2 (Working copy differs from source): SUPPORTED by ART-ACQ-301 and ART-WRK-304.
 *    - Claim 3 (Clock offset explains timestamp anomaly): SUPPORTED by ART-LOG-306 (-120.4s offset).
 *    - Claim 4 (Records prove external recipient received roadmap): CONTRADICTED / UNRESOLVED.
 *      * ART-EGR-309 is sampled/truncated; ART-PRX-312 is from a different host; ART-RES-313 is pending.
 *      * Internal staging is confirmed, but external receipt is UNPROVEN.
 *
 * 5. VERDICT:
 *    - Supported finding: Package pkg-8842.tar.gz matches worker staging bit-for-bit; external receipt is unproven.
 *    - Critical limitation: Perimeter egress records are sampled/truncated and partner inquiry is pending.
 *    - Next step: Obtain partner access logs and full PCAP from all perimeter egress interfaces.
 * ============================================================================
 */

export type ArtifactClassification = "original" | "working_copy" | "incomplete" | "unrelated";

export type ArtifactType =
  | "acquisition"
  | "manifest"
  | "object_record"
  | "working_copy"
  | "log"
  | "verification"
  | "custody"
  | "inventory"
  | "decoy";

export type LabArtifact = {
  id: string;
  title: string;
  filename: string;
  type: ArtifactType;
  source: string;
  timestamp: string;
  sizeBytes?: number;
  hashAlgorithm?: string;
  sha256Digest?: string;
  custodySignature?: string;
  provenanceSummary: string;
  technicalDetails: string;
  forensicSignificance: string;
  tags: string[];
  expectedClassification: ArtifactClassification;
};

export type ClaimStatus = "supported" | "contradicted" | "unresolved";

export type InvestigativeClaim = {
  id: string;
  claimText: string;
  description: string;
  expectedStatus: ClaimStatus;
  keyArtifactIds: string[];
  explanation: string;
};

export const COMMON_HASHES = {
  STAGED_PACKAGE: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
  WORKING_COPY: "9c1b48d2f0a3e5c7b9a1d3f5e7c9b1a3d5f7e9c1b3a5d7f9e1c3b5a7d9f1e3b5",
  VAULT_OBJECT: "3a4f91b2c83d6e5a1b0c9f8e7d6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a",
  MARKETING_DECOY: "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
  CONTAINER_ENVELOPE: "5d41402abc4b2a76b9719d911017c592b0e78f9f8c0e66e850b537c449e6d871",
  PUBLIC_PREVIEW: "ffff00001111222233334444555566667777888899990000aaaabbbbccccdddd",
};

export const STAGE3_ARTIFACTS: LabArtifact[] = [
  {
    id: "ART-ACQ-301",
    title: "Forensic Bitstream Image of Staging Spool",
    filename: "pkg-8842.tar.gz",
    type: "acquisition",
    source: "Incident Response Triage Agent / host: export-worker-03",
    timestamp: "10:15:00 UTC",
    sizeBytes: 4418240,
    hashAlgorithm: "SHA-256",
    sha256Digest: COMMON_HASHES.STAGED_PACKAGE,
    custodySignature: "ED25519:7a41c...99b1a (Triage Officer Vance)",
    provenanceSummary:
      "Raw bitstream image of the staging archive collected directly from /var/spool/exportbridge/stage.",
    technicalDetails:
      "Bitstream acquisition performed via read-only memory-backed forensic tool. Captured file size: 4,418,240 bytes. Calculated SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069. Digital custody token COC-2026-881 verified with hardware security key.",
    forensicSignificance:
      "Serves as the primary reference artifact for the staged payload on worker-03. Its hash proves bitstream state at triage time.",
    tags: ["primary evidence", "staging spool", "bitstream image"],
    expectedClassification: "original",
  },
  {
    id: "ART-EXP-302",
    title: "ExportBridge Runtime Job Manifest",
    filename: "manifest-eb2041.json",
    type: "manifest",
    source: "ExportBridge Worker Runtime / host: export-worker-03",
    timestamp: "09:39:35 UTC",
    sizeBytes: 2840,
    hashAlgorithm: "SHA-256",
    sha256Digest: "8b1a99c32f0e4b7a1d5c9e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b",
    custodySignature: "Internal Runtime HMAC (Daemon PID 4410)",
    provenanceSummary:
      "Runtime execution manifest generated by the export daemon immediately prior to staging completion.",
    technicalDetails:
      "JSON manifest file recording Job ID EB-2041, execution identity svc-exportbridge, package identifier PKG-8842, and target payload digest '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069' for 4,418,240 bytes.",
    forensicSignificance:
      "Demonstrates that the package acquired at 10:15:00 UTC (ART-ACQ-301) matches character-for-character the hash logged by the worker daemon when staging completed.",
    tags: ["runtime manifest", "job EB-2041", "hash record"],
    expectedClassification: "original",
  },
  {
    id: "ART-OBJ-303",
    title: "Vault Storage Enclave Version Snapshot",
    filename: "gh-roadmap-2027.enc",
    type: "object_record",
    source: "Vault Object Store / bucket: vault-projects-confidential",
    timestamp: "09:12:00 UTC",
    sizeBytes: 4412896,
    hashAlgorithm: "SHA-256",
    sha256Digest: COMMON_HASHES.VAULT_OBJECT,
    custodySignature: "Vault Audit Engine VLT-9921",
    provenanceSummary:
      "Storage enclave snapshot of the restricted raw encrypted roadmap file prior to job EB-2041.",
    technicalDetails:
      "Original object key: /projects/glasshouse/gh-roadmap-2027.enc. Payload size: 4,412,896 bytes (4.2 MB). SHA-256: 3a4f91b2c83d6e5a1b0c9f8e7d6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a.",
    forensicSignificance:
      "Byte size and hash differ from ART-ACQ-301 because ART-OBJ-303 is the raw encrypted vault object, whereas ART-ACQ-301 is a compressed tar.gz archive with directory metadata and gzip headers.",
    tags: ["vault enclave", "raw object", "confidential"],
    expectedClassification: "original",
  },
  {
    id: "ART-WRK-304",
    title: "Analyst Triage Working Copy",
    filename: "pkg-8842_analyst_copy.tar.gz",
    type: "working_copy",
    source: "Forensics Workstation-01 / analyst: lee",
    timestamp: "10:45:12 UTC",
    sizeBytes: 4418312,
    hashAlgorithm: "SHA-256",
    sha256Digest: COMMON_HASHES.WORKING_COPY,
    custodySignature: "Local Workstation User (analyst.lee)",
    provenanceSummary: "Working copy created by analyst Lee during local triage inspection.",
    technicalDetails:
      "Analyst unpacked the archive to examine headers and re-compressed with local flags, appending 72 bytes of pax extended attributes. Size increased from 4,418,240 to 4,418,312 bytes. SHA-256 changed to 9c1b48d2f0a3e5c7b9a1d3f5e7c9b1a3d5f7e9c1b3a5d7f9e1c3b5a7d9f1e3b5.",
    forensicSignificance:
      "Illustrates that a changed digest on a working copy reflects analytical re-archival differences rather than malicious evidence tampering.",
    tags: ["working copy", "pax attributes", "hash changed"],
    expectedClassification: "working_copy",
  },
  {
    id: "ART-DUP-305",
    title: "Public Share File with Matching Name",
    filename: "pkg-8842.tar.gz",
    type: "decoy",
    source: "Marketing Share Server / share: //corp-files/public/releases/",
    timestamp: "09:41:10 UTC",
    sizeBytes: 1248512,
    hashAlgorithm: "SHA-256",
    sha256Digest: COMMON_HASHES.MARKETING_DECOY,
    custodySignature: "Public Share Daemon (anonymous)",
    provenanceSummary:
      "File located on internal corporate marketing share with an identical filename.",
    technicalDetails:
      "File name: pkg-8842.tar.gz. File size: 1,248,512 bytes (1.2 MB). SHA-256: 11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff. Content inspection reveals Q4 public promotional assets.",
    forensicSignificance:
      "A classic decoy: matching filename does not indicate matching bytes, origin, or evidentiary value.",
    tags: ["decoy", "matching filename", "unrelated content"],
    expectedClassification: "unrelated",
  },
  {
    id: "ART-LOG-306",
    title: "Network Flow Collector Log with Clock Skew",
    filename: "collector-01_export.log",
    type: "log",
    source: "Network Flow Collector / host: flow-collector-01",
    timestamp: "09:37:41 (Local Device Clock)",
    sizeBytes: 18400,
    hashAlgorithm: "SHA-256",
    sha256Digest: "55aa66bb77cc88dd99ee00ff11aa22bb33cc44dd55ee66ff77aa88bb99cc00dd",
    custodySignature: "Syslog Appliance Daemon #01",
    provenanceSummary:
      "Flow record showing internal worker connection with an uncalibrated hardware clock.",
    technicalDetails:
      "Device reported NTP sync status: 'NTP_DESYNC_FAIL / offset: -120.400s'. The internal connection was logged at 09:37:41 local clock time. Corrected True UTC timestamp: 09:37:41 + 120.4s = 09:39:41.4 UTC.",
    forensicSignificance:
      "Resolves an apparent timing paradox: the network event appears to occur before staging, but normalization proves it coincided exactly with package staging at 09:39:41 UTC.",
    tags: ["flow log", "clock offset", "NTP desync"],
    expectedClassification: "original",
  },
  {
    id: "ART-VER-307",
    title: "Independent Airgapped Verification Digest",
    filename: "independent_verify.sha256",
    type: "verification",
    source: "Isolated Forensics Lab Enclave / tool: sha256sum v9.1",
    timestamp: "11:00:22 UTC",
    sizeBytes: 128,
    hashAlgorithm: "SHA-256",
    sha256Digest: COMMON_HASHES.STAGED_PACKAGE,
    custodySignature: "Senior Examiner Tanaka (HW Token #48)",
    provenanceSummary:
      "Independent hash calculation of primary acquisition image performed on an isolated forensic workstation.",
    technicalDetails:
      "Target file: raw bitstream replica of ART-ACQ-301. Tool: GNU coreutils sha256sum on offline Alpine Linux environment. Result: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069.",
    forensicSignificance:
      "Confirms bit-for-bit authenticity of the primary evidence image, eliminating possibility of collector tool corruption.",
    tags: ["independent verification", "airgapped", "cryptographic proof"],
    expectedClassification: "original",
  },
  {
    id: "ART-COC-308",
    title: "Digital Chain of Custody Handoff Record",
    filename: "coc-transfer-08.pdf.sig",
    type: "custody",
    source: "NovaCorp Security Operations / evidence-locker-01",
    timestamp: "10:30:00 UTC",
    sizeBytes: 142000,
    hashAlgorithm: "SHA-256",
    sha256Digest: "4433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa9988776655",
    custodySignature: "Dual Signed: Vance & Tanaka (ECDSA P-256)",
    provenanceSummary:
      "Chain-of-custody handoff document for physical drive containing the initial worker triage capture.",
    technicalDetails:
      "Formal handoff record detailing transfer from field triage engineer D. Vance to custody officer S. Tanaka. Tamper-evident bag #88219 verified uncompromised.",
    forensicSignificance:
      "Establishes unbroken procedural custody from host acquisition to laboratory analysis.",
    tags: ["chain of custody", "dual signed", "tamper evident"],
    expectedClassification: "original",
  },
  {
    id: "ART-EGR-309",
    title: "Perimeter Firewall Sampled Packet Extract",
    filename: "fw-edge-02_sample.pcap",
    type: "log",
    source: "Perimeter Firewall Edge-02 / filter: egress-443",
    timestamp: "09:38:00 - 09:42:00 UTC",
    sizeBytes: 1048576,
    hashAlgorithm: "SHA-256",
    sha256Digest: "aabb1122ccdd3344eeff5566aabb1122ccdd3344eeff5566aabb1122ccdd3344",
    custodySignature: "Network Ops Auto-Dump (pcap-dump-44)",
    provenanceSummary: "Incomplete packet capture extract from perimeter interface Edge-02.",
    technicalDetails:
      "Capture configured with snaplen=64 (payload truncated) and 1:100 packet sampling. Contains fragmentary TLS handshakes to external CDNs, but zero payload data and no reassembled streams.",
    forensicSignificance:
      "Cannot prove or disprove external receipt. Truncated sampling cannot corroborate whether PKG-8842 traversed this boundary.",
    tags: ["packet capture", "truncated", "incomplete provenance"],
    expectedClassification: "incomplete",
  },
  {
    id: "ART-EVD-310",
    title: "Forensic Evidence Container Inventory",
    filename: "evidence-container-manifest.xml",
    type: "inventory",
    source: "Forensic Storage Appliance / secure-vault-02",
    timestamp: "10:20:15 UTC",
    sizeBytes: 8192,
    hashAlgorithm: "SHA-256",
    sha256Digest: COMMON_HASHES.CONTAINER_ENVELOPE,
    custodySignature: "Forensics Vault Engine V2",
    provenanceSummary:
      "Sealed cryptographic container manifest encapsulating all triage artifacts.",
    technicalDetails:
      "Container ID CNT-BF007-SEC1. Encapsulates ART-ACQ-301, ART-EXP-302, and worker syslog segments with an overarching container digest.",
    forensicSignificance:
      "Validates that primary artifacts were ingested into a sealed container within 40 minutes of detection.",
    tags: ["container manifest", "sealed envelope", "cryptographic boundary"],
    expectedClassification: "original",
  },
  {
    id: "ART-KMS-311",
    title: "HSM Decryption Key Usage Audit Log",
    filename: "kms-audit-vault.json",
    type: "log",
    source: "Hardware Security Module (HSM) / KMS Cluster",
    timestamp: "09:37:02 UTC",
    sizeBytes: 4210,
    hashAlgorithm: "SHA-256",
    sha256Digest: "66778899aabbccddeeff00112233445566778899aabbccddeeff001122334455",
    custodySignature: "HSM Partition #02 Hardware Cryptostamp",
    provenanceSummary:
      "Hardware security module audit log recording decryption of the roadmap object.",
    technicalDetails:
      "Key ARN: arn:novacorp:kms:vault-master-key. Calling principal: svc-exportbridge. Resulting plaintext payload digest matches ART-OBJ-303 (3a4f91b...).",
    forensicSignificance:
      "Demonstrates that object decryption occurred inside export-worker-03 memory prior to packaging into pkg-8842.tar.gz.",
    tags: ["HSM audit", "key usage", "decryption proof"],
    expectedClassification: "original",
  },
  {
    id: "ART-PRX-312",
    title: "Forward Proxy Outbound Transfer Extract",
    filename: "proxy-outbound-sample.csv",
    type: "decoy",
    source: "Corporate Forward Proxy / host: proxy-cluster-01",
    timestamp: "09:40:45 UTC",
    sizeBytes: 3200,
    hashAlgorithm: "SHA-256",
    sha256Digest: "99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa",
    custodySignature: "Proxy Log Collector",
    provenanceSummary: "Outbound HTTP transfer record occurring shortly after staging.",
    technicalDetails:
      "POST request to vendor telemetry endpoint. Reported byte count: 4,420,100 bytes. However, client IP is 10.12.8.99 (telemetry-daemon-01), NOT worker-03 (10.12.8.44).",
    forensicSignificance:
      "A decoy: similar byte count (~4.4 MB) and nearby timestamp, but originates from a different host and service.",
    tags: ["proxy log", "different host", "decoy transfer"],
    expectedClassification: "unrelated",
  },
  {
    id: "ART-RES-313",
    title: "External Partner SOC Inquiry Response Status",
    filename: "ext-destination-inquiry.eml",
    type: "log",
    source: "Legal & Incident Response / to: CloudShare Partner SOC",
    timestamp: "11:30:00 UTC",
    sizeBytes: 15400,
    hashAlgorithm: "SHA-256",
    sha256Digest: "33445566778899aabbccddeeff00112233445566778899aabbccddeeff001122",
    custodySignature: "Inquiry Ticket INC-88912-CS",
    provenanceSummary:
      "Formal inquiry ticket dispatched to external partner asking if package PKG-8842 was received.",
    technicalDetails:
      "Status: PENDING_VENDOR_LOG_EXPORT. The partner's SOC has not provided transfer logs, upload receipts, or confirmation of inbound connections from NovaCorp IP ranges.",
    forensicSignificance:
      "Proves that recipient-side confirmation is completely absent; any conclusion claiming external receipt is legally and forensically unsupported.",
    tags: ["external inquiry", "unconfirmed receipt", "pending data"],
    expectedClassification: "incomplete",
  },
  {
    id: "ART-SAN-314",
    title: "Sanitized Public Press Roadmap Preview",
    filename: "public-roadmap-preview.pdf",
    type: "decoy",
    source: "NovaCorp Corporate Communications / Web CMS",
    timestamp: "08:00:00 UTC",
    sizeBytes: 512000,
    hashAlgorithm: "SHA-256",
    sha256Digest: COMMON_HASHES.PUBLIC_PREVIEW,
    custodySignature: "Web CMS Publisher (m.chen)",
    provenanceSummary:
      "Public marketing summary of Project Glasshouse published earlier the same day.",
    technicalDetails:
      "File size: 512,000 bytes. SHA-256: ffff00001111222233334444555566667777888899990000aaaabbbbccccdddd. Contains marketing blurbs without confidential technical specifications.",
    forensicSignificance:
      "Demonstrates that public materials sharing the project name exist, but are completely distinct in content, size, and hash from confidential vault assets.",
    tags: ["public preview", "marketing", "decoy document"],
    expectedClassification: "unrelated",
  },
];

export const INVESTIGATIVE_CLAIMS: InvestigativeClaim[] = [
  {
    id: "CLAIM-1",
    claimText:
      "The collected export package pkg-8842.tar.gz is authentic and bit-identical to the artifact staged by worker-03 during job EB-2041.",
    description:
      "Correlate the physical triage acquisition image with worker daemon runtime logs and independent verification calculations.",
    expectedStatus: "supported",
    keyArtifactIds: ["ART-ACQ-301", "ART-EXP-302", "ART-VER-307"],
    explanation:
      "Supported: The SHA-256 digest (7f83b1...d9069) and byte count (4,418,240) match exactly across the worker manifest, triage acquisition image, and independent verification.",
  },
  {
    id: "CLAIM-2",
    claimText:
      "The working copy pkg-8842_analyst_copy.tar.gz used by the analyst differs from the primary acquisition source due to evidence tampering.",
    description:
      "Determine whether the hash change between ART-ACQ-301 and ART-WRK-304 proves malicious alteration or benign analytical re-archival.",
    expectedStatus: "contradicted",
    keyArtifactIds: ["ART-ACQ-301", "ART-WRK-304"],
    explanation:
      "Contradicted: The working copy digest differs because 72 bytes of pax extended attributes were appended during local triage re-archival, not because of malicious tampering with the evidence.",
  },
  {
    id: "CLAIM-3",
    claimText:
      "The apparent timestamp discrepancy between flow collector-01 (09:37:41) and package staging (09:39:41) is explained by a documented clock skew.",
    description:
      "Assess whether the log timestamp order represents an impossible causality paradox or a reconcilable sensor clock offset.",
    expectedStatus: "supported",
    keyArtifactIds: ["ART-LOG-306", "ART-EXP-302"],
    explanation:
      "Supported: Flow collector-01 recorded an NTP synchronization failure with a -120.4s offset. When adjusted to True UTC, the event occurred at 09:39:41 UTC, matching worker staging.",
  },
  {
    id: "CLAIM-4",
    claimText:
      "The available forensic records prove that the confidential Glasshouse roadmap successfully reached an external recipient.",
    description:
      "Examine perimeter firewall samples, proxy logs, and external inquiry tickets to determine if external receipt is established.",
    expectedStatus: "unresolved",
    keyArtifactIds: ["ART-EGR-309", "ART-PRX-312", "ART-RES-313"],
    explanation:
      "Unresolved (or Contradicted): Internal staging was completed, but perimeter firewall captures are truncated samples, proxy transfers came from a different host, and partner inquiries remain pending with no receipt confirmation.",
  },
];

export const VERDICT_FINDINGS = [
  {
    id: "V-FIND-1",
    label:
      "Package pkg-8842.tar.gz matches the worker's staging output bit-for-bit; internal staging is verified, but external delivery remains unproven by available records.",
    isOptimal: true,
  },
  {
    id: "V-FIND-2",
    label:
      "External exfiltration of the Glasshouse roadmap is conclusively proven by the 4.4 MB forward proxy transfer at 09:40:45 UTC.",
    isOptimal: false,
  },
  {
    id: "V-FIND-3",
    label:
      "The primary evidence was compromised and tampered with during laboratory handling, as demonstrated by the altered hash on the analyst copy.",
    isOptimal: false,
  },
  {
    id: "V-FIND-4",
    label:
      "The Glasshouse roadmap was leaked directly to public web shares prior to job execution, as proven by the matching file on the marketing server.",
    isOptimal: false,
  },
] as const;

export const VERDICT_LIMITATIONS = [
  {
    id: "V-LIM-1",
    label:
      "Perimeter network logs are sampled/truncated and external partner inquiries remain pending, leaving the external transmission channel unverified.",
    isOptimal: true,
  },
  {
    id: "V-LIM-2",
    label:
      "Hardware security module (HSM) decryption logs were destroyed by the attacker, leaving key usage in doubt.",
    isOptimal: false,
  },
  {
    id: "V-LIM-3",
    label:
      "SHA-256 cryptographic collisions prevent distinguishing between marketing files and confidential archives.",
    isOptimal: false,
  },
] as const;

export const VERDICT_NEXT_STEPS = [
  {
    id: "V-STEP-1",
    label:
      "Obtain external partner recipient access logs and full unsliced PCAPs across all perimeter egress gateways during the 09:35–09:50 UTC window.",
    isOptimal: true,
  },
  {
    id: "V-STEP-2",
    label:
      "Immediately issue disciplinary termination notices to the marketing team based on duplicate filenames on the internal share.",
    isOptimal: false,
  },
  {
    id: "V-STEP-3",
    label:
      "Purge the analyst workstation and discard the primary bitstream image due to hash discrepancies on working copies.",
    isOptimal: false,
  },
] as const;
