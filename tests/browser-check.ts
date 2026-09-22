/**
 * Phase 2 browser-flow validation (run while `npm run dev` is serving).
 * Drives POST /api/triage — the exact endpoint the real UI posts to — with
 * the six Phase 2 synthetic cases, and asserts the expected readiness.
 */
import {
  CASE_A_DESCRIPTION,
  CASE_A_EVIDENCE,
  CASE_B_EVIDENCE,
  CASE_C_EVIDENCE,
  CASE_D_EVIDENCE,
  CASE_E_DESCRIPTION,
  CASE_F_DESCRIPTION,
} from "../lib/demo/cyber-demo";
import type { EvidenceRecord, TriageResponse } from "../lib/types/civictrail";

const BASE = process.env.CIVICTRAIL_BASE_URL ?? "http://localhost:3000";

const CASES: Array<{
  name: string;
  description: string;
  workflow: "auto" | "cyber_financial_fraud" | "consumer_grievance";
  evidence: EvidenceRecord;
  expect: "ready" | "blocked" | "human_review";
}> = [
  { name: "CASE A (valid cyber)", description: CASE_A_DESCRIPTION, workflow: "cyber_financial_fraud", evidence: CASE_A_EVIDENCE, expect: "ready" },
  { name: "CASE B (UTR 12345)", description: CASE_A_DESCRIPTION, workflow: "cyber_financial_fraud", evidence: CASE_B_EVIDENCE, expect: "blocked" },
  { name: "CASE C (short details)", description: CASE_A_DESCRIPTION, workflow: "cyber_financial_fraud", evidence: CASE_C_EVIDENCE, expect: "blocked" },
  { name: "CASE D (prohibited chars)", description: CASE_A_DESCRIPTION, workflow: "cyber_financial_fraud", evidence: CASE_D_EVIDENCE, expect: "blocked" },
  { name: "CASE E (municipal tax)", description: CASE_E_DESCRIPTION, workflow: "auto", evidence: {}, expect: "human_review" },
  { name: "CASE F (ambiguous)", description: CASE_F_DESCRIPTION, workflow: "auto", evidence: {}, expect: "human_review" },
];

let failures = 0;
async function main(): Promise<void> {
for (const testCase of CASES) {
  const response = await fetch(`${BASE}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: testCase.description,
      workflow: testCase.workflow,
      evidence: testCase.evidence,
    }),
  });
  if (!response.ok) {
    failures += 1;
    console.log(`FAIL - ${testCase.name}: HTTP ${response.status}`);
    continue;
  }
  const data = (await response.json()) as TriageResponse;
  const failingRules = data.readiness.findings
    .filter((f) => f.status === "fail")
    .map((f) => f.ruleId)
    .join(",");
  const guard = data.classificationGuard
    ? `${data.classificationGuard.outcome}`
    : "no-guard-info";
  const pass = data.readiness.status === testCase.expect;
  if (!pass) failures += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"} - ${testCase.name}: status=${data.readiness.status} (expected ${testCase.expect}) | agentUsed=${data.agentUsed} | guard=${guard} | blocking=${data.readiness.blockingCount} review=${data.readiness.reviewCount} | failedRules=[${failingRules}] | packet=${data.actionPacket ? "yes" : "none"} | humanConfirmation=${data.actionPacket?.requiresHumanConfirmation ?? "n/a"} | ledgerEntries=${data.readiness.ledger.length}`,
  );
}

console.log(failures === 0 ? "\nALL BROWSER-FLOW CHECKS PASSED" : `\n${failures} BROWSER-FLOW CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("Browser-flow check crashed:", error);
  process.exitCode = 1;
});