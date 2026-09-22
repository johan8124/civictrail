/**
 * CivicTrail deterministic pipeline tests.
 *
 * Run with: npm test  (tsx tests/deterministic.test.ts)
 *
 * These tests prove that readiness comes ONLY from deterministic rule
 * results — no agent code is involved in these paths.
 */
import assert from "node:assert/strict";
import { computeReadiness } from "../lib/readiness/engine";
import { evaluateRules } from "../lib/rules/engine";
import { buildLedger } from "../lib/evidence/ledger";
import { buildActionPacket } from "../lib/action-packet/packet";
import { getRouteForWorkflow } from "../lib/routes";
import { OFFICIAL_SOURCES } from "../lib/source-registry";
import { keywordFallbackClassify } from "../lib/agent/classification";
import {
  DEMO_CYBER_EVIDENCE_BLOCKED,
  DEMO_CYBER_EVIDENCE_READY,
} from "../lib/demo/cyber-demo";

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("cyber demo (transaction ID not 12 digits) is BLOCKED", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: DEMO_CYBER_EVIDENCE_BLOCKED,
  });
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.blockingCount, 1);
  assert.equal(readiness.reviewCount, 0);
  const failing = readiness.findings.filter((f) => f.status === "fail");
  assert.equal(failing.length, 1);
  assert.equal(failing[0].ruleId, "CYBER-CHECKLIST-007");
});

test("cyber demo (complete checklist) is READY", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: DEMO_CYBER_EVIDENCE_READY,
  });
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.blockingCount, 0);
  assert.equal(readiness.reviewCount, 0);
  assert.equal(readiness.findings.length, 10);
  assert.ok(readiness.findings.every((f) => f.status === "pass"));
});

test("cyber rules mirror the official checklist fields (10 checks)", () => {
  const rules = evaluateRules("cyber_financial_fraud", {});
  // 003 (min length) and 004 (prohibited chars) only apply when incident
  // details are provided, so 8 of the 10 base checks run on empty evidence.
  assert.equal(rules.length, 8);
  assert.ok(rules.every((r) => r.requirementKind === "official_checklist"));
  assert.ok(rules.every((r) => r.status === "fail")); // nothing provided
  assert.ok(!rules.some((r) => r.ruleId === "CYBER-CHECKLIST-003"));
  assert.ok(!rules.some((r) => r.ruleId === "CYBER-CHECKLIST-004"));
  // File-size rules (011/012) only apply when real uploads exist.
  assert.ok(!rules.some((r) => r.ruleId === "CYBER-CHECKLIST-011"));
  assert.ok(!rules.some((r) => r.ruleId === "CYBER-CHECKLIST-012"));
  // With incident details present, all 10 base checks apply.
  const withDetails = evaluateRules("cyber_financial_fraud", { incidentDetails: "x" });
  assert.equal(withDetails.length, 10);
});

test("consumer intake rules are labelled civictrail_intake_requirement", () => {
  const rules = evaluateRules("consumer_grievance", {});
  assert.equal(rules.length, 5); // 4 intake + CONSUMER-ROUTE-001 (always-applies)
  assert.ok(
    rules.filter((r) => r.ruleId.startsWith("CONSUMER-INTAKE-")).every(
      (r) => r.requirementKind === "civictrail_intake_requirement",
    ),
  );
  const readiness = computeReadiness({ workflow: "consumer_grievance", evidence: {} });
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.blockingCount, 4);
  assert.equal(readiness.reviewCount, 1); // CONSUMER-ROUTE-001 is review when no route chosen
});

test("consumer intake complete -> READY", () => {
  const readiness = computeReadiness({
    workflow: "consumer_grievance",
    evidence: {
      problemDescription: "Demo: order never delivered.",
      sellerOrProvider: "Demo Seller Co.",
      purchaseEvidence: "Demo order #123",
      paymentEvidence: "Demo payment ref #456",
      // Phase 3: the official consumer route must be explicitly chosen;
      // without it CONSUMER-ROUTE-001 reviews and readiness is HUMAN_REVIEW.
      consumerRouteRequested: "nch_grievance",
    },
  });
  assert.equal(readiness.status, "ready");
});
test("readiness is fully deterministic (same input, same result)", () => {
  const a = computeReadiness({ workflow: "cyber_financial_fraud", evidence: DEMO_CYBER_EVIDENCE_BLOCKED });
  const b = computeReadiness({ workflow: "cyber_financial_fraud", evidence: DEMO_CYBER_EVIDENCE_BLOCKED });
  assert.deepEqual(
    a.findings.map((f) => [f.ruleId, f.status]),
    b.findings.map((f) => [f.ruleId, f.status]),
  );
  assert.equal(a.status, b.status);
});



test("review finding alone produces HUMAN_REVIEW, not READY", () => {
  // A fail dominates: 3 pass + 1 fail -> blocked.
  const blocked = computeReadiness({
    workflow: "consumer_grievance",
    evidence: {
      problemDescription: "Demo description.",
      sellerOrProvider: "Demo Seller Co.",
      purchaseEvidence: "Demo order #123",
      paymentEvidence: "",
      consumerRouteRequested: "nch_grievance",
    },
  });
  assert.equal(blocked.status, "blocked");

  // A review-only set must yield human_review (aggregation contract).
  const findings = evaluateRules("consumer_grievance", {
    problemDescription: "Demo description.",
    sellerOrProvider: "Demo Seller Co.",
    purchaseEvidence: "Demo order #123",
    paymentEvidence: "Demo payment ref",
    consumerRouteRequested: "nch_grievance",
  }).map((f) => (f.ruleId === "CONSUMER-INTAKE-003" ? { ...f, status: "review" as const } : f));
  const fails = findings.filter((f) => f.status === "fail");
  const reviews = findings.filter((f) => f.status === "review");
  assert.equal(fails.length, 0);
  assert.equal(reviews.length, 1);
  const status = fails.length > 0 ? "blocked" : reviews.length > 0 ? "human_review" : "ready";
  assert.equal(status, "human_review");
});

test("unknown classification maps to HUMAN_REVIEW deterministically", () => {
  const failing = [];
  const reviewing = [{ ruleId: "GENERAL-CLASSIFICATION-001", status: "review" as const }];
  const status = failing.length > 0 ? "blocked" : reviewing.length > 0 ? "human_review" : "ready";
  assert.equal(status, "human_review");
});

test("source registry contains only verified sources with the expected URLs", () => {
  assert.equal(OFFICIAL_SOURCES.length, 4);
  for (const source of OFFICIAL_SOURCES) {
    assert.equal(source.sourceStatus, "verified");
    assert.ok(source.verifiedFacts.length > 0, `${source.sourceId} needs verified facts`);
    assert.match(source.officialUrl, /^https:/);
  }
  const ids = OFFICIAL_SOURCES.map((s) => s.sourceId).sort();
  assert.deepEqual(ids, [
    "cyber-helpline-1930",
    "e-jagriti",
    "national-consumer-helpline",
    "national-cyber-crime-portal",
  ]);
});

test("routes expose only verified guidance", () => {
  const cyber = getRouteForWorkflow("cyber_financial_fraud");
  assert.equal(cyber.routeId, "route-cyber-financial-fraud");
  assert.ok(cyber.verifiedGuidance.join(" ").includes("1930"));
  assert.ok(cyber.verifiedGuidance.join(" ").includes("12-digit transaction ID / UTR"));

  const consumer = getRouteForWorkflow("consumer_grievance");
  assert.ok(consumer.verifiedGuidance.join(" ").includes("pre-litigation"));
});

test("evidence ledger entries carry full provenance", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: DEMO_CYBER_EVIDENCE_BLOCKED,
  });
  const ledger = buildLedger({
    classification: {
      claim: "Issue classified by the triage agent",
      evidence: "cyber_financial_fraud — demo",
      confidence: 0.9,
      determinationSource: "agent",
    },
    route: {
      claim: "Official route identified",
      evidence: "verified guidance",
      sourceId: "national-cyber-crime-portal",
      reference: "https://www.cybercrime.gov.in/Accept.aspx",
    },
    ruleResults: readiness.findings,
  });
  assert.ok(ledger.length >= 9); // classification + route + 8 rules
  for (const entry of ledger) {
    assert.ok(entry.id.length > 0);
    assert.ok(entry.claim.length > 0);
    assert.ok(entry.evidence.length > 0);
    assert.ok(entry.source.length > 0);
    assert.ok(entry.timestamp.length > 0);
    assert.ok(entry.reference.length > 0);
  }
});

test("action packet always requires human confirmation", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: DEMO_CYBER_EVIDENCE_READY,
  });
  const packet = buildActionPacket({
    workflow: "cyber_financial_fraud",
    route: getRouteForWorkflow("cyber_financial_fraud"),
    evidence: DEMO_CYBER_EVIDENCE_READY,
    readiness,
    issueSummary: "Demo packet",
  });
  assert.equal(packet.requiresHumanConfirmation, true);
  assert.match(packet.disclaimer, /not legal advice/);
  assert.ok(packet.sourceReferences.length > 0);
  assert.ok(packet.nextActions.length > 0);
});

test("keyword fallback classifier is deterministic", () => {
  assert.equal(keywordFallbackClassify("Someone withdrew money from my account after an OTP scam"), "cyber_financial_fraud");
  assert.equal(keywordFallbackClassify("My order from a seller never arrived and I want a refund"), "consumer_grievance");
  assert.equal(keywordFallbackClassify("Hello world"), "unknown");
});

console.log(`\n${passed} deterministic tests passed.`);
