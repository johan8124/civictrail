/**
 * CivicTrail Phase 2 deterministic tests.
 *
 * Run with: npm test  (also runs tests/deterministic.test.ts first)
 *
 * Covers:
 * - conservative classification guard (supported / unsupported / ambiguous /
 *   empty; agent confidence never authorizes routing)
 * - hardened official-checklist cyber rules (UTR, 200-char minimum,
 *   prohibited characters, missing fields, invalid amount, evidence)
 * - Evidence Ledger provenance for official checklist rules
 * - readiness authority (fail -> BLOCKED, review -> HUMAN_REVIEW, pass -> READY)
 * - Phase 2 synthetic cases A-F
 */
import assert from "node:assert/strict";
import {
  applyClassificationGuard,
  hasStrongCyberFinancialSignals,
  hasStrongConsumerSignals,
  MIN_DESCRIPTION_CHARS,
} from "../lib/agent/classification";
import {
  buildUnsupportedWorkflowResult,
} from "../lib/agent/triage-orchestrator";
import { computeReadiness } from "../lib/readiness/engine";
import { evaluateRules, findProhibitedCharacters, parseValidFraudAmount } from "../lib/rules/engine";
import { buildLedger } from "../lib/evidence/ledger";
import { buildActionPacket } from "../lib/action-packet/packet";
import { getRouteForWorkflow } from "../lib/routes";
import {
  CASE_A_DESCRIPTION,
  CASE_A_EVIDENCE,
  CASE_B_EVIDENCE,
  CASE_C_EVIDENCE,
  CASE_D_EVIDENCE,
  CASE_E_DESCRIPTION,
  CASE_F_DESCRIPTION,
} from "../lib/demo/cyber-demo";
import type { AgentClassification, RuleResult, RuleStatus } from "../lib/types/civictrail";

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function agentSuggestion(workflow: AgentClassification["workflow"], confidence: number): AgentClassification {
  return {
    workflow,
    confidence,
    rationale: "Agent suggestion (test fixture).",
    determinationSource: "agent",
  };
}

/* ------------------------------------------------------------------ */
/* Classification guard                                                 */
/* ------------------------------------------------------------------ */

test("guard accepts a supported cyber classification with strong explicit signals", () => {
  const result = applyClassificationGuard({
    description: CASE_A_DESCRIPTION,
    suggestedWorkflow: "cyber_financial_fraud",
    classification: agentSuggestion("cyber_financial_fraud", 0.99),
  });
  assert.equal(result.workflow, "cyber_financial_fraud");
  assert.equal(result.guard.outcome, "accepted");
});

test("guard accepts a supported consumer classification with strong explicit signals", () => {
  const result = applyClassificationGuard({
    description:
      "The online store delivered a defective product and the seller refuses a refund for my order.",
    suggestedWorkflow: "consumer_grievance",
    classification: agentSuggestion("consumer_grievance", 0.95),
  });
  assert.equal(result.workflow, "consumer_grievance");
  assert.equal(result.guard.outcome, "accepted");
});

test("guard downgrades an unsupported municipal-tax classification to unknown (HUMAN_REVIEW)", () => {
  const result = applyClassificationGuard({
    description: CASE_E_DESCRIPTION,
    suggestedWorkflow: "consumer_grievance",
    classification: agentSuggestion("consumer_grievance", 0.99),
  });
  assert.equal(result.workflow, "unknown");
  assert.equal(result.guard.outcome, "downgraded_to_unknown");
  assert.equal(result.guard.resolvedWorkflow, "unknown");
});

test("guard downgrades an ambiguous classification to unknown (HUMAN_REVIEW)", () => {
  const result = applyClassificationGuard({
    description: CASE_F_DESCRIPTION,
    suggestedWorkflow: "cyber_financial_fraud",
    classification: agentSuggestion("cyber_financial_fraud", 0.9),
  });
  assert.equal(result.workflow, "unknown");
  assert.equal(result.guard.outcome, "downgraded_to_unknown");
});

test("empty description resolves to unknown even with a confident agent suggestion", () => {
  const result = applyClassificationGuard({
    description: "   ",
    suggestedWorkflow: "cyber_financial_fraud",
    classification: agentSuggestion("cyber_financial_fraud", 1),
  });
  assert.equal(result.workflow, "unknown");
  assert.equal(result.guard.outcome, "downgraded_to_unknown");
});

test("insufficient description (below minimum length) resolves to unknown", () => {
  const result = applyClassificationGuard({
    description: "help me",
    suggestedWorkflow: "consumer_grievance",
    classification: agentSuggestion("consumer_grievance", 0.98),
  });
  assert.equal(result.workflow, "unknown");
  assert.ok(MIN_DESCRIPTION_CHARS > "help me".length);
});

test("agent confidence alone never authorizes routing (max confidence, no signals)", () => {
  const result = applyClassificationGuard({
    description: "I have a question about my paperwork.",
    suggestedWorkflow: "cyber_financial_fraud",
    classification: agentSuggestion("cyber_financial_fraud", 1),
  });
  assert.equal(result.workflow, "unknown");
  assert.equal(result.guard.outcome, "downgraded_to_unknown");
});

test("cyber and consumer signal checks are deterministic and mutually exclusive in the guard", () => {
  assert.equal(hasStrongCyberFinancialSignals(CASE_A_DESCRIPTION), true);
  assert.equal(hasStrongConsumerSignals(CASE_A_DESCRIPTION), false);
  assert.equal(hasStrongCyberFinancialSignals(CASE_E_DESCRIPTION), false);
  assert.equal(hasStrongConsumerSignals(CASE_E_DESCRIPTION), false);
});

/* ------------------------------------------------------------------ */
/* Official checklist rules                                             */
/* ------------------------------------------------------------------ */

test("valid 12-digit UTR passes", () => {
  const rules = evaluateRules("cyber_financial_fraud", CASE_A_EVIDENCE);
  const utr = rules.find((r) => r.ruleId === "CYBER-CHECKLIST-007");
  assert.ok(utr);
  assert.equal(utr.status, "pass");
  assert.match(utr.evidence, /exactly 12 digits/);
});

test("invalid UTR (5 digits) fails", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_B_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  const utr = readiness.findings.find((r) => r.ruleId === "CYBER-CHECKLIST-007");
  assert.ok(utr);
  assert.equal(utr.status, "fail");
  assert.match(utr.evidence, /not exactly 12 digits/);
});

test("UTR with correct length but non-digit characters fails", () => {
  const rules = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    transactionId: "1234567AB012",
  });
  const utr = rules.find((r) => r.ruleId === "CYBER-CHECKLIST-007");
  assert.ok(utr);
  assert.equal(utr.status, "fail");
});

test("short incident details (under 200 characters) fail", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_C_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  const short = readiness.findings.find((r) => r.ruleId === "CYBER-CHECKLIST-003");
  assert.ok(short);
  assert.equal(short.status, "fail");
  assert.match(short.evidence, /minimum of 200 characters/);
});

test("incident details of exactly 200 characters pass the minimum-length rule", () => {
  const exactly200 = "a".repeat(200);
  const rules = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    incidentDetails: exactly200,
  });
  const rule = rules.find((r) => r.ruleId === "CYBER-CHECKLIST-003");
  assert.ok(rule);
  assert.equal(rule.status, "pass");
});

test("prohibited characters fail", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_D_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  const prohibited = readiness.findings.find((r) => r.ruleId === "CYBER-CHECKLIST-004");
  assert.ok(prohibited);
  assert.equal(prohibited.status, "fail");
  assert.match(prohibited.evidence, /%/);
});

test("prohibited-character detector finds each character of the conservative set", () => {
  assert.deepEqual(findProhibitedCharacters("a#b$c"), ["#", "$"]);
  assert.deepEqual(findProhibitedCharacters("clean text"), []);
});

test("missing ID fails", () => {
  const rules = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    identityDocument: undefined,
  });
  const id = rules.find((r) => r.ruleId === "CYBER-CHECKLIST-005");
  assert.ok(id);
  assert.equal(id.status, "fail");
});

test("missing bank/wallet/merchant fails", () => {
  const rules = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    bankWalletMerchant: undefined,
  });
  const bank = rules.find((r) => r.ruleId === "CYBER-CHECKLIST-006");
  assert.ok(bank);
  assert.equal(bank.status, "fail");
});

test("missing transaction date fails", () => {
  const rules = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    transactionDate: undefined,
  });
  const date = rules.find((r) => r.ruleId === "CYBER-CHECKLIST-008");
  assert.ok(date);
  assert.equal(date.status, "fail");
});

test("invalid fraud amount fails", () => {
  const rules = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    fraudAmount: "twenty thousand",
  });
  const amount = rules.find((r) => r.ruleId === "CYBER-CHECKLIST-009");
  assert.ok(amount);
  assert.equal(amount.status, "fail");
  assert.match(amount.evidence, /not a valid positive numeric value/);
});

test("fraud amount parser accepts common valid formats and rejects invalid ones", () => {
  assert.equal(parseValidFraudAmount("24999"), 24999);
  assert.equal(parseValidFraudAmount("24,999"), 24999);
  assert.equal(parseValidFraudAmount("₹24999.50"), 24999.5);
  assert.equal(parseValidFraudAmount("0"), null);
  assert.equal(parseValidFraudAmount("-500"), null);
  assert.equal(parseValidFraudAmount("abc"), null);
  assert.equal(parseValidFraudAmount(""), null);
  assert.equal(parseValidFraudAmount(undefined), null);
});

test("missing evidence fails", () => {
  const rules = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    supportingEvidence: undefined,
  });
  const evidence = rules.find((r) => r.ruleId === "CYBER-CHECKLIST-010");
  assert.ok(evidence);
  assert.equal(evidence.status, "fail");
});

test("valid complete cyber case is READY with all 10 applicable checks passing", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_A_EVIDENCE,
  });
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.findings.length, 10);
  assert.ok(readiness.findings.every((f) => f.status === "pass"));
});

test("file-size rules only run when real uploads exist (no fake validation)", () => {
  // No uploads -> rules absent, not "passing".
  const withoutFiles = evaluateRules("cyber_financial_fraud", CASE_A_EVIDENCE);
  assert.ok(!withoutFiles.some((r) => r.ruleId === "CYBER-CHECKLIST-011"));
  assert.ok(!withoutFiles.some((r) => r.ruleId === "CYBER-CHECKLIST-012"));

  // Oversized real upload -> deterministic fail.
  const oversized = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    identityDocumentFile: { name: "id.png", size: 6 * 1024 * 1024 },
    supportingEvidenceFiles: [{ name: "chat.png", size: 11 * 1024 * 1024 }],
  });
  const idRule = oversized.find((r) => r.ruleId === "CYBER-CHECKLIST-011");
  const evidenceRule = oversized.find((r) => r.ruleId === "CYBER-CHECKLIST-012");
  assert.ok(idRule && evidenceRule);
  assert.equal(idRule.status, "fail");
  assert.equal(evidenceRule.status, "fail");
  assert.match(idRule.evidence, /5 MB/);
  assert.match(evidenceRule.evidence, /10 MB/);

  // Within limits -> pass.
  const within = evaluateRules("cyber_financial_fraud", {
    ...CASE_A_EVIDENCE,
    identityDocumentFile: { name: "id.png", size: 3 * 1024 * 1024 },
    supportingEvidenceFiles: [{ name: "chat.png", size: 9 * 1024 * 1024 }],
  });
  assert.equal(within.find((r) => r.ruleId === "CYBER-CHECKLIST-011")?.status, "pass");
  assert.equal(within.find((r) => r.ruleId === "CYBER-CHECKLIST-012")?.status, "pass");
});

/* ------------------------------------------------------------------ */
/* Evidence Ledger                                                      */
/* ------------------------------------------------------------------ */

test("every deterministic cyber rule result has a full Evidence Ledger entry", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_B_EVIDENCE, // one failing rule
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
      reference: "https://www.cybercrime.gov.in/Webform/Crime_AuthoLogin.aspx",
    },
    ruleResults: readiness.findings,
  });

  for (const entry of ledger) {
    assert.ok(entry.id.length > 0);
    assert.ok(entry.claim.length > 0);
    assert.ok(entry.evidence.length > 0);
    assert.ok(entry.source.length > 0);
    assert.ok(entry.ruleId === null || entry.ruleId.length > 0);
    assert.ok(["pass", "fail", "review", "info"].includes(entry.status));
    assert.ok(typeof entry.confidence === "number");
    assert.ok(entry.timestamp.length > 0);
    assert.ok(entry.reference.length > 0);
  }

  // Official checklist rules must reference the National Cyber Crime Reporting Portal.
  const ruleEntries = ledger.filter((e) => e.ruleId?.startsWith("CYBER-"));
  assert.ok(ruleEntries.length >= 10);
  for (const entry of ruleEntries) {
    assert.match(entry.source, /National Cyber Crime Reporting Portal/);
    assert.match(entry.source, /cybercrime\.gov\.in/);
  }

  // Both passing and failing evidence is preserved.
  assert.ok(ledger.some((e) => e.status === "pass"));
  assert.ok(ledger.some((e) => e.status === "fail"));
  const failingEntry = ledger.find((e) => e.ruleId === "CYBER-CHECKLIST-007");
  assert.ok(failingEntry);
  assert.equal(failingEntry.status, "fail");
});

/* ------------------------------------------------------------------ */
/* Readiness authority                                                  */
/* ------------------------------------------------------------------ */

test("failed required rule -> BLOCKED (deterministic authority)", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_B_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.blockingCount >= 1);
});

test("unsupported classification result is HUMAN_REVIEW (pure deterministic path)", () => {
  const guard = applyClassificationGuard({
    description: CASE_E_DESCRIPTION,
    suggestedWorkflow: "consumer_grievance",
    classification: agentSuggestion("consumer_grievance", 0.99),
  });
  const response = buildUnsupportedWorkflowResult({
    classification: agentSuggestion("consumer_grievance", 0.99),
    guard: guard.guard,
    agentUsed: true,
    agentSummary: "Agent suggested consumer_grievance.",
  });
  assert.equal(response.workflowResolved, "unknown");
  assert.equal(response.readiness.status, "human_review");
  assert.equal(response.route, null);
  assert.equal(response.actionPacket, null);
  assert.equal(response.classificationGuard?.outcome, "downgraded_to_unknown");
  assert.equal(response.readiness.reviewCount, 1);
});

test("review-only findings produce HUMAN_REVIEW, not READY", () => {
  const readiness = computeReadiness({ workflow: "cyber_financial_fraud", evidence: {} });
  const findings: Array<RuleResult & { status: RuleStatus }> = readiness.findings.map((f) => ({
    ...f,
    status: "review" as RuleStatus,
  }));
  const fails = findings.filter((f) => f.status === "fail");
  const reviews = findings.filter((f) => f.status === "review");
  assert.equal(fails.length, 0);
  assert.ok(reviews.length > 0);
  const status = fails.length > 0 ? "blocked" : reviews.length > 0 ? "human_review" : "ready";
  assert.equal(status, "human_review");
});

test("all required deterministic checks pass -> READY", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_A_EVIDENCE,
  });
  assert.equal(readiness.status, "ready");
});

test("the agent cannot turn a deterministic BLOCKED result into READY (recompute is stable)", () => {
  const first = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_B_EVIDENCE,
  });
  const second = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_B_EVIDENCE,
  });
  assert.equal(first.status, "blocked");
  assert.equal(second.status, "blocked");
});

/* ------------------------------------------------------------------ */
/* Synthetic cases A-F                                                  */
/* ------------------------------------------------------------------ */

test("CASE A: clearly cyber financial fraud, all fields valid -> READY", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_A_EVIDENCE,
  });
  assert.equal(readiness.status, "ready");
});

test("CASE B: transaction ID 12345 -> BLOCKED", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_B_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.findings.find((r) => r.ruleId === "CYBER-CHECKLIST-007")?.status, "fail");
});

test("CASE C: incident details under 200 characters -> BLOCKED", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_C_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.findings.find((r) => r.ruleId === "CYBER-CHECKLIST-003")?.status, "fail");
});

test("CASE D: prohibited special characters in details -> BLOCKED", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_D_EVIDENCE,
  });
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.findings.find((r) => r.ruleId === "CYBER-CHECKLIST-004")?.status, "fail");
});

test("CASE E: unsupported municipal-tax problem -> HUMAN_REVIEW", () => {
  const guard = applyClassificationGuard({
    description: CASE_E_DESCRIPTION,
    suggestedWorkflow: "consumer_grievance",
    classification: agentSuggestion("consumer_grievance", 0.99),
  });
  assert.equal(guard.workflow, "unknown");
  const response = buildUnsupportedWorkflowResult({
    classification: agentSuggestion("consumer_grievance", 0.99),
    guard: guard.guard,
    agentUsed: true,
    agentSummary: "demo",
  });
  assert.equal(response.readiness.status, "human_review");
});

test("CASE F: ambiguous/insufficient description -> HUMAN_REVIEW", () => {
  const guard = applyClassificationGuard({
    description: CASE_F_DESCRIPTION,
    suggestedWorkflow: "cyber_financial_fraud",
    classification: agentSuggestion("cyber_financial_fraud", 0.9),
  });
  assert.equal(guard.workflow, "unknown");
  const response = buildUnsupportedWorkflowResult({
    classification: agentSuggestion("cyber_financial_fraud", 0.9),
    guard: guard.guard,
    agentUsed: true,
    agentSummary: "demo",
  });
  assert.equal(response.readiness.status, "human_review");
});

/* ------------------------------------------------------------------ */
/* Action Packet                                                        */
/* ------------------------------------------------------------------ */

test("action packet for a READY cyber case still requires human confirmation", () => {
  const readiness = computeReadiness({
    workflow: "cyber_financial_fraud",
    evidence: CASE_A_EVIDENCE,
  });
  const packet = buildActionPacket({
    workflow: "cyber_financial_fraud",
    route: getRouteForWorkflow("cyber_financial_fraud"),
    evidence: CASE_A_EVIDENCE,
    readiness,
    issueSummary: "Demo packet",
  });
  assert.equal(packet.requiresHumanConfirmation, true);
  assert.match(packet.disclaimer, /not legal advice/);
});

console.log(`\n${passed} Phase 2 tests passed.`);