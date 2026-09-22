/**
 * CivicTrail readiness computation.
 *
 * DETERMINISTIC AUTHORITY: readiness is derived ONLY from deterministic rule
 * results. No LLM output can influence these states. The agent may classify,
 * inspect, reason and explain — it can never flip a fail to a pass.
 */
import type {
  ReadinessResult,
  RuleResult,
} from "../types/civictrail";
import { buildLedger } from "../evidence/ledger";
import { evaluateRules } from "../rules/engine";
import type { EvidenceRecord, ImplementedWorkflowId } from "../types/civictrail";

export interface ReadinessInput {
  workflow: ImplementedWorkflowId;
  evidence: EvidenceRecord;
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const findings: RuleResult[] = evaluateRules(input.workflow, input.evidence);

  const failing = findings.filter((f) => f.status === "fail");
  const reviewing = findings.filter((f) => f.status === "review");

  // Deterministic aggregation:
  // - any fail              -> blocked
  // - else any review       -> human_review
  // - else                  -> ready
  const status = failing.length > 0 ? "blocked" : reviewing.length > 0 ? "human_review" : "ready";

  const ledger = buildLedger({
    classification: null,
    route: null,
    ruleResults: findings,
  });

  return {
    status,
    blockingCount: failing.length,
    reviewCount: reviewing.length,
    findings,
    ledger,
  };
}
