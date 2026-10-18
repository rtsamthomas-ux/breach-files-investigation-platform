import { describe, expect, it } from "vitest";
import { ACCESS_EVIDENCE, ACCESS_CATEGORIES } from "../lib/stage2-evidence";

describe("Stage 2 — Access Investigation Evidence Integrity", () => {
  it("provides at least 12 interconnected evidence records", () => {
    expect(ACCESS_EVIDENCE.length).toBeGreaterThanOrEqual(12);
    expect(ACCESS_EVIDENCE.length).toBe(15);
  });

  it("verifies every evidence record contains required forensic fields", () => {
    const ids = new Set<string>();

    for (const record of ACCESS_EVIDENCE) {
      expect(record.id).toBeTruthy();
      expect(record.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(ACCESS_CATEGORIES).toContain(record.category);
      expect(record.source.length).toBeGreaterThan(5);
      expect(record.title.length).toBeGreaterThan(10);
      expect(record.summary.length).toBeGreaterThan(20);
      expect(record.detail.length).toBeGreaterThan(50);
      expect(record.tags.length).toBeGreaterThanOrEqual(2);

      // Verify unique IDs
      expect(ids.has(record.id)).toBe(false);
      ids.add(record.id);
    }
  });

  it("includes all required evidence domains: IAM, AUTH, CONFIG, ACCESS, and AUDIT", () => {
    const categoriesPresent = new Set(ACCESS_EVIDENCE.map((r) => r.category));
    expect(categoriesPresent.has("IAM")).toBe(true);
    expect(categoriesPresent.has("AUTH")).toBe(true);
    expect(categoriesPresent.has("CONFIG")).toBe(true);
    expect(categoriesPresent.has("ACCESS")).toBe(true);
    expect(categoriesPresent.has("AUDIT")).toBe(true);
  });

  it("includes at least three realistic, distinguishable distractions", () => {
    const distractionIds = ["AUTH-LOG-204", "DOC-WEB-205", "SEC-ALR-207"];
    for (const dId of distractionIds) {
      const record = ACCESS_EVIDENCE.find((r) => r.id === dId);
      expect(record).toBeDefined();
      expect(record?.tags).toContain("distraction");
    }
  });

  it("includes the core causal chain for access via overprivileged service identity", () => {
    const coreCausalIds = [
      "IAM-POL-201", // Overprivileged role
      "CFG-AUD-202", // Config v17 regex update
      "CFG-DEP-203", // Config v17 deployed
      "ACL-CHK-206", // Container ACL inheritance
      "STS-ISS-208", // Automated token issuance
      "SCH-LOG-209", // Scheduled cron trigger
      "WKR-CFG-210", // Worker query evaluation
      "API-VAL-211", // Gateway token check
      "AUTH-EVAL-212", // Vault Authz ALLOW
      "OBJ-RET-213", // Object retrieval
      "KEY-ROT-215", // HSM keys intact (no stolen key)
    ];

    for (const cId of coreCausalIds) {
      const record = ACCESS_EVIDENCE.find((r) => r.id === cId);
      expect(record).toBeDefined();
    }
  });

  it("preserves chronological timestamp sequence across events", () => {
    const times = ACCESS_EVIDENCE.map((r) => r.time);
    const sortedTimes = [...times].sort((a, b) => a.localeCompare(b));
    expect(times).toEqual(sortedTimes);
  });
});
