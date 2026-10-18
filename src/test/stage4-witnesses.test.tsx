import { describe, expect, it } from "vitest";
import {
  WITNESS_PROFILES,
  CASE_WALL_CLAIMS,
  CONFERENCE_ACCOUNTS,
  CONFERENCE_UNRESOLVED,
  CONFERENCE_EXPLAINED_CONTRADICTIONS,
  CONFERENCE_NEXT_INQUIRIES,
} from "../lib/stage4-witnesses";

describe("Stage 4 — Witness Investigation Data & Logic Integrity", () => {
  it("provides exactly four fictional witnesses with distinct roles", () => {
    expect(WITNESS_PROFILES.length).toBe(4);
    const witnessIds = WITNESS_PROFILES.map((w) => w.id);
    expect(witnessIds).toContain("WIT-MV"); // Mira Vance
    expect(witnessIds).toContain("WIT-ER"); // Elena Rostova
    expect(witnessIds).toContain("WIT-JP"); // Jonah Pike
    expect(witnessIds).toContain("WIT-RS"); // Ravi Sen
  });

  it("ensures each witness has at least six interview statements", () => {
    const allStatementIds = new Set<string>();

    for (const witness of WITNESS_PROFILES) {
      expect(witness.name).toBeTruthy();
      expect(witness.role).toBeTruthy();
      expect(witness.department).toBeTruthy();
      expect(witness.clearanceLevel).toBeTruthy();
      expect(witness.scopeOfKnowledge.length).toBeGreaterThanOrEqual(2);
      expect(witness.statements.length).toBeGreaterThanOrEqual(6);

      for (const stmt of witness.statements) {
        expect(stmt.id).toMatch(/^ST-[A-Z]{2}-\d{2}$/);
        expect(stmt.timestamp).toBeTruthy();
        expect(stmt.topic).toBeTruthy();
        expect(stmt.question.length).toBeGreaterThan(15);
        expect(stmt.answer.length).toBeGreaterThan(20);
        expect(["corroborated", "contradicted", "unverified"]).toContain(stmt.evidentiaryStatus);
        expect(stmt.linkedEvidenceIds.length).toBeGreaterThanOrEqual(1);
        expect(stmt.forensicNote.length).toBeGreaterThan(15);

        // Unique IDs
        expect(allStatementIds.has(stmt.id)).toBe(false);
        allStatementIds.add(stmt.id);
      }
    }

    expect(allStatementIds.size).toBe(24);
  });

  it("includes at least six case wall claims with defensible truth statuses", () => {
    expect(CASE_WALL_CLAIMS.length).toBeGreaterThanOrEqual(6);

    const claim1 = CASE_WALL_CLAIMS.find((c) => c.id === "CW-01")!;
    expect(claim1.expectedStatus).toBe("corroborated");
    expect(claim1.keyEvidenceIds).toContain("CFG-AUD-202");

    const claim2 = CASE_WALL_CLAIMS.find((c) => c.id === "CW-02")!;
    expect(claim2.expectedStatus).toBe("contradicted"); // Elena's web review did not trigger export
    expect(claim2.keyEvidenceIds).toContain("DOC-WEB-205");

    const claim3 = CASE_WALL_CLAIMS.find((c) => c.id === "CW-03")!;
    expect(claim3.expectedStatus).toBe("contradicted"); // Proxy POST was telemetry daemon
    expect(claim3.keyEvidenceIds).toContain("ART-PRX-312");

    const claim4 = CASE_WALL_CLAIMS.find((c) => c.id === "CW-04")!;
    expect(claim4.expectedStatus).toBe("corroborated"); // Automated token
    expect(claim4.keyEvidenceIds).toContain("STS-ISS-208");

    const claim5 = CASE_WALL_CLAIMS.find((c) => c.id === "CW-05")!;
    expect(claim5.expectedStatus).toBe("contradicted"); // Clock skew
    expect(claim5.keyEvidenceIds).toContain("ART-LOG-306");

    const claim6 = CASE_WALL_CLAIMS.find((c) => c.id === "CW-06")!;
    expect(claim6.expectedStatus).toBe("unverified"); // Malicious intent is unproven
  });

  it("verifies Jonah Pike's proxy statement is marked contradicted", () => {
    const pike = WITNESS_PROFILES.find((w) => w.id === "WIT-JP")!;
    const proxyStatement = pike.statements.find((s) => s.id === "ST-JP-06")!;
    expect(proxyStatement).toBeDefined();
    expect(proxyStatement.evidentiaryStatus).toBe("contradicted");
    expect(proxyStatement.linkedEvidenceIds).toContain("ART-PRX-312");
  });

  it("verifies Elena Rostova's web access statement is corroborated", () => {
    const elena = WITNESS_PROFILES.find((w) => w.id === "WIT-ER")!;
    const webAccessStatement = elena.statements.find((s) => s.id === "ST-ER-01")!;
    expect(webAccessStatement).toBeDefined();
    expect(webAccessStatement.evidentiaryStatus).toBe("corroborated");
    expect(webAccessStatement.linkedEvidenceIds).toContain("DOC-WEB-205");
  });

  it("verifies case conference choices contain optimal evidence-backed findings", () => {
    const optimalAccount = CONFERENCE_ACCOUNTS.find((a) => a.isOptimal);
    expect(optimalAccount).toBeDefined();
    expect(optimalAccount?.id).toBe("CONF-ACC-1");
    expect(optimalAccount?.label).toContain("external delivery remains unproven");

    const optimalUnresolved = CONFERENCE_UNRESOLVED.find((u) => u.isOptimal);
    expect(optimalUnresolved).toBeDefined();
    expect(optimalUnresolved?.id).toBe("CONF-UNRES-1");
    expect(optimalUnresolved?.label).toContain(
      "negligent operational oversight or intentional insider sabotage",
    );

    const optimalExplained = CONFERENCE_EXPLAINED_CONTRADICTIONS.find((e) => e.isOptimal);
    expect(optimalExplained).toBeDefined();
    expect(optimalExplained?.id).toBe("CONF-EXP-1");
    expect(optimalExplained?.label).toContain("NTP clock skew");

    const optimalInquiry = CONFERENCE_NEXT_INQUIRIES.find((i) => i.isOptimal);
    expect(optimalInquiry).toBeDefined();
    expect(optimalInquiry?.id).toBe("CONF-INQ-1");
    expect(optimalInquiry?.label).toContain("GitLab commit a94f2b1 branch telemetry");
  });
});
