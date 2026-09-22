/**
 * CivicTrail Phase 3 tests — Consumer Grievance workflow (NCH / e-Jagriti).
 *
 * Run with: npm test  (tsx tests/phase3.test.ts)
 *
 * Phase 3 facts come ONLY from the verified NCH / e-Jagriti content recorded
 * in Sources.md section 5. Nothing here may invent eligibility rules,
 * deadlines, fees, document lists, or outcome promises.
 */
import assert from "node:assert/strict";
import { computeReadiness } from "../lib/readiness/engine";
import { evaluateRules } from "../lib/rules/engine";
import { CONSUMER_ROUTE, getRouteForWorkflow } from "../lib/routes";
import { applyClassificationGuard } from "../lib/agent/classification";
import { CONSUMER_ROUTE_CHOICES } from "../lib/types/civictrail";
import {
  NCH_ROUTE,
  EJAGRITI_ROUTE,
  CASE_N1_EVIDENCE,
  CASE_N2_EVIDENCE,
  CASE_E1_EVIDENCE,
  CASE_E2_EVIDENCE,
  CASE_G_DESCRIPTION,
  CASE_H_DESCRIPTION,
  CASE_H_EVIDENCE,
} from "../lib/demo/consumer-demo";

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("consumer route choices use one consistent identifier set", () => {
  assert.deepEqual(CONSUMER_ROUTE_CHOICES, ["not_sure", "nch_grievance", "e_jagriti_complaint"]);
  assert.equal(NCH_ROUTE, "nch_grievance");
  assert.equal(EJAGRITI_ROUTE, "e_jagriti_complaint");
  // Route identifiers used by the rules must come from the same set.
  for (const evidence of [CASE_N1_EVIDENCE, CASE_E1_EVIDENCE]) {
    assert.ok(
      evidence.consumerRouteRequested === undefined ||
        CONSUMER_ROUTE_CHOICES.includes(evidence.consumerRouteRequested),
    );
  }
});

test("CASE N1 (NCH route, complete intake) is READY", () => {
  const readiness = computeReadiness({
    workflow: "consumer_grievance",
    evidence: CASE_N1_EVIDENCE,
  });
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.blockingCount, 0);
  assert.equal(readiness.reviewCount, 0);
  assert.equal(readiness.findings.length, 6);
  assert.ok(readiness.findings.every((f) => f.status === "pass"));
  const ids = readiness.findings.map((f) => f.ruleId);
  assert.ok(ids.includes("CONSUMER-ROUTE-001"));
  assert.ok(ids.includes("CONSUMER-NCH-DOCS-001"));
  // The e-Jagriti affidavit rule does not apply on the NCH route.
  assert.ok(!ids.includes("CONSUMER-EJAGRITI-AFFIDAVIT-001"));
});

test("NCH document rule is informational and never blocks", () => {
  const nchRules = evaluateRules("consumer_grievance", CASE_N1_EVIDENCE);
  const docsRule = nchRules.find((f) => f.ruleId === "CONSUMER-NCH-DOCS-001");
  assert.ok(docsRule);
  assert.equal(docsRule.status, "pass");
  assert.equal(docsRule.requirementKind, "official_checklist");
  assert.equal(docsRule.sourceId, "national-consumer-helpline");

  // On the blocked N2 case the NCH document rule STILL passes: documents are
  // "necessary documents, if any" — never a deterministic blocker.
  const n2 = computeReadiness({ workflow: "consumer_grievance", evidence: CASE_N2_EVIDENCE });
  assert.equal(n2.status, "blocked");
  const failing = n2.findings.filter((f) => f.status === "fail");
  assert.deepEqual(failing.map((f) => f.ruleId), ["CONSUMER-INTAKE-003"]);
  const n2Docs = n2.findings.find((f) => f.ruleId === "CONSUMER-NCH-DOCS-001");
  assert.ok(n2Docs);
  assert.equal(n2Docs.status, "pass");
});

test("CASE N2 (NCH route, purchase evidence missing) is BLOCKED", () => {
  const readiness = computeReadiness({
    workflow: "consumer_grievance",
    evidence: CASE_N2_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.blockingCount, 1);
});

test("CASE E1 (e-Jagriti route, affidavit provided) is READY", () => {
  const readiness = computeReadiness({
    workflow: "consumer_grievance",
    evidence: CASE_E1_EVIDENCE,
  });
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.blockingCount, 0);
  assert.equal(readiness.reviewCount, 0);
  const ids = readiness.findings.map((f) => f.ruleId);
  assert.ok(ids.includes("CONSUMER-EJAGRITI-AFFIDAVIT-001"));
  assert.ok(ids.includes("CONSUMER-ROUTE-001"));
  // The NCH document rule does not apply on the e-Jagriti route.
  assert.ok(!ids.includes("CONSUMER-NCH-DOCS-001"));
  const affidavit = readiness.findings.find((f) => f.ruleId === "CONSUMER-EJAGRITI-AFFIDAVIT-001");
  assert.equal(affidavit?.status, "pass");
  assert.equal(affidavit?.sourceId, "e-jagriti");
});

test("CASE E2 (e-Jagriti route, affidavit missing) is BLOCKED", () => {
  const readiness = computeReadiness({
    workflow: "consumer_grievance",
    evidence: CASE_E2_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  const failing = readiness.findings.filter((f) => f.status === "fail");
  assert.deepEqual(failing.map((f) => f.ruleId), ["CONSUMER-EJAGRITI-AFFIDAVIT-001"]);
  assert.match(failing[0].evidence, /Notarized affidavit is mandatory/i);
});

test("route-specific rules only apply on their own route", () => {
  const nchRules = evaluateRules("consumer_grievance", CASE_N1_EVIDENCE).map((f) => f.ruleId);
  const ejRules = evaluateRules("consumer_grievance", CASE_E1_EVIDENCE).map((f) => f.ruleId);
  assert.ok(!nchRules.includes("CONSUMER-EJAGRITI-AFFIDAVIT-001"));
  assert.ok(nchRules.includes("CONSUMER-NCH-DOCS-001"));
  assert.ok(!ejRules.includes("CONSUMER-NCH-DOCS-001"));
  assert.ok(ejRules.includes("CONSUMER-EJAGRITI-AFFIDAVIT-001"));
});

test("'not_sure' route is unresolved -> HUMAN_REVIEW, never READY", () => {
  const readiness = computeReadiness({
    workflow: "consumer_grievance",
    evidence: {
      ...CASE_N1_EVIDENCE,
      consumerRouteRequested: "not_sure" as const,
    },
  });
  assert.equal(readiness.status, "human_review");
  assert.equal(readiness.blockingCount, 0);
  assert.equal(readiness.reviewCount, 1);
  const reviews = readiness.findings.filter((f) => f.status === "review");
  assert.deepEqual(reviews.map((f) => f.ruleId), ["CONSUMER-ROUTE-001"]);
  assert.ok(!readiness.findings.some((f) => f.ruleId === "CONSUMER-NCH-DOCS-001"));
});

test("consumer route exposes only the verified official NCH / e-Jagriti sources", () => {
  const route = getRouteForWorkflow("consumer_grievance");
  assert.equal(route, CONSUMER_ROUTE);
  assert.deepEqual(
    route.sources.map((s) => s.sourceId).sort(),
    ["e-jagriti", "national-consumer-helpline"],
  );
  for (const source of route.sources) {
    assert.equal(source.sourceStatus, "verified");
  }
  const guidance = route.verifiedGuidance.join(" ");
  assert.match(guidance, /pre-litigation/);
});

test("CASE G ambiguous description is downgraded to unknown by the guard", () => {
  const { workflow, guard } = applyClassificationGuard({
    description: CASE_G_DESCRIPTION,
    suggestedWorkflow: "consumer_grievance",
    classification: null,
  });
  assert.equal(workflow, "unknown");
  assert.equal(guard.outcome, "downgraded_to_unknown");
  assert.equal(guard.suggestedWorkflow, "consumer_grievance");
  assert.equal(guard.resolvedWorkflow, "unknown");
});

test("CASE H cyber description stays cyber even with a consumer selection", () => {
  const { workflow, guard } = applyClassificationGuard({
    description: CASE_H_DESCRIPTION,
    suggestedWorkflow: "consumer_grievance",
    classification: null,
  });
  assert.equal(workflow, "cyber_financial_fraud");
  assert.equal(guard.outcome, "accepted");

  // With the full cyber checklist supplied, the case is READY under the
  // cyber rules (consumer intake fields are not evaluated for cyber).
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_H_EVIDENCE,
  });
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.findings.length, 10);
  assert.ok(readiness.findings.every((f) => f.status === "pass"));
});

console.log(`\n${passed} Phase 3 tests passed.`);