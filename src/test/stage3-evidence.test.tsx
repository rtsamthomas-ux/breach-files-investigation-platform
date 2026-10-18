import { describe, expect, it } from "vitest";
import {
  STAGE3_ARTIFACTS,
  INVESTIGATIVE_CLAIMS,
  COMMON_HASHES,
  VERDICT_FINDINGS,
  VERDICT_LIMITATIONS,
  VERDICT_NEXT_STEPS,
} from "../lib/stage3-evidence";

describe("Stage 3 — Evidence Analysis & Lab Corpus Integrity", () => {
  it("provides at least 12 interconnected artifacts", () => {
    expect(STAGE3_ARTIFACTS.length).toBeGreaterThanOrEqual(12);
    expect(STAGE3_ARTIFACTS.length).toBe(14);
  });

  it("ensures every artifact contains valid metadata, provenance and forensic explanations", () => {
    const ids = new Set<string>();

    for (const art of STAGE3_ARTIFACTS) {
      expect(art.id).toMatch(/^ART-[A-Z]{3}-\d{3}$/);
      expect(art.title.length).toBeGreaterThan(10);
      expect(art.filename.length).toBeGreaterThan(3);
      expect(art.source.length).toBeGreaterThan(5);
      expect(art.timestamp.length).toBeGreaterThan(4);
      expect(art.provenanceSummary.length).toBeGreaterThan(20);
      expect(art.technicalDetails.length).toBeGreaterThan(30);
      expect(art.forensicSignificance.length).toBeGreaterThan(30);
      expect(art.tags.length).toBeGreaterThanOrEqual(2);
      expect(["original", "working_copy", "incomplete", "unrelated"]).toContain(
        art.expectedClassification,
      );

      // Unique IDs
      expect(ids.has(art.id)).toBe(false);
      ids.add(art.id);
    }
  });

  it("verifies cryptographic hash consistency for byte-identical artifacts", () => {
    const primaryAcq = STAGE3_ARTIFACTS.find((a) => a.id === "ART-ACQ-301")!;
    const workerManifest = STAGE3_ARTIFACTS.find((a) => a.id === "ART-EXP-302")!;
    const independentVerify = STAGE3_ARTIFACTS.find((a) => a.id === "ART-VER-307")!;

    expect(primaryAcq).toBeDefined();
    expect(workerManifest).toBeDefined();
    expect(independentVerify).toBeDefined();

    // Primary image matches COMMON_HASHES.STAGED_PACKAGE exactly
    expect(primaryAcq.sha256Digest).toBe(COMMON_HASHES.STAGED_PACKAGE);
    expect(independentVerify.sha256Digest).toBe(COMMON_HASHES.STAGED_PACKAGE);

    // Byte size of primary acquisition
    expect(primaryAcq.sizeBytes).toBe(4418240);
  });

  it("verifies hash and size discrepancies between working copy and original are realistic", () => {
    const primaryAcq = STAGE3_ARTIFACTS.find((a) => a.id === "ART-ACQ-301")!;
    const workingCopy = STAGE3_ARTIFACTS.find((a) => a.id === "ART-WRK-304")!;

    expect(primaryAcq.sha256Digest).not.toBe(workingCopy.sha256Digest);
    expect(workingCopy.sizeBytes).toBe(primaryAcq.sizeBytes! + 72); // Exactly 72 bytes pax headers
    expect(workingCopy.expectedClassification).toBe("working_copy");
  });

  it("verifies decoy file with duplicate filename has completely different bytes and size", () => {
    const primaryAcq = STAGE3_ARTIFACTS.find((a) => a.id === "ART-ACQ-301")!;
    const decoy = STAGE3_ARTIFACTS.find((a) => a.id === "ART-DUP-305")!;

    expect(decoy.filename).toBe(primaryAcq.filename); // Identical filename 'pkg-8842.tar.gz'
    expect(decoy.sha256Digest).not.toBe(primaryAcq.sha256Digest);
    expect(decoy.sizeBytes).toBe(1248512); // 1.2 MB vs 4.4 MB
    expect(decoy.expectedClassification).toBe("unrelated");
  });

  it("verifies clock offset metadata in network collector log", () => {
    const log = STAGE3_ARTIFACTS.find((a) => a.id === "ART-LOG-306")!;
    expect(log).toBeDefined();
    expect(log.technicalDetails).toContain("-120.400s");
    expect(log.technicalDetails).toContain("09:39:41.4 UTC");
  });

  it("validates four core investigative claims and their ground-truth statuses", () => {
    expect(INVESTIGATIVE_CLAIMS.length).toBe(4);

    const claim1 = INVESTIGATIVE_CLAIMS.find((c) => c.id === "CLAIM-1")!;
    expect(claim1.expectedStatus).toBe("supported");
    expect(claim1.keyArtifactIds).toContain("ART-ACQ-301");
    expect(claim1.keyArtifactIds).toContain("ART-EXP-302");

    const claim2 = INVESTIGATIVE_CLAIMS.find((c) => c.id === "CLAIM-2")!;
    expect(claim2.expectedStatus).toBe("contradicted"); // Alteration was benign pax attributes, not evidence tampering

    const claim3 = INVESTIGATIVE_CLAIMS.find((c) => c.id === "CLAIM-3")!;
    expect(claim3.expectedStatus).toBe("supported"); // Clock offset explains the difference

    const claim4 = INVESTIGATIVE_CLAIMS.find((c) => c.id === "CLAIM-4")!;
    expect(claim4.expectedStatus).toBe("unresolved"); // External receipt remains unproven
  });

  it("ensures verdict options contain clear optimal defensible findings and limitations", () => {
    const optimalFinding = VERDICT_FINDINGS.find((f) => f.isOptimal);
    expect(optimalFinding).toBeDefined();
    expect(optimalFinding?.id).toBe("V-FIND-1");
    expect(optimalFinding?.label).toContain("external delivery remains unproven");

    const optimalLimitation = VERDICT_LIMITATIONS.find((l) => l.isOptimal);
    expect(optimalLimitation).toBeDefined();
    expect(optimalLimitation?.id).toBe("V-LIM-1");
    expect(optimalLimitation?.label).toContain("Perimeter network logs are sampled/truncated");

    const optimalStep = VERDICT_NEXT_STEPS.find((s) => s.isOptimal);
    expect(optimalStep).toBeDefined();
    expect(optimalStep?.id).toBe("V-STEP-1");
    expect(optimalStep?.label).toContain("external partner recipient access logs");
  });
});
