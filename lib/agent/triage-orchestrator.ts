/**
 * CivicTrail triage orchestrator (server-side).
 *
 * Wires the Strands agent run into the deterministic pipeline:
 *
 *   user description
 *     -> Strands classify_issue  (agent decision, recorded via tool)
 *     -> Strands lookup_official_route (verified registry only)
 *     -> deterministic evidence checks (rule engine, LLM-independent)
 *     -> Evidence Ledger
 *     -> READY / BLOCKED / HUMAN_REVIEW   (deterministic only)
 *     -> Action Packet
 *
 * The agent never decides readiness. Even in degraded mode (agent failure),
 * the deterministic pipeline still produces a valid result.
 */
import type {
  AgentClassification,
  ClassificationGuardOutcome,
  ImplementedWorkflowId,
  ReadinessResult,
  RuleResult,
  TriageRequest,
  TriageResponse,
} from "../types/civictrail";
import { ImplementedWorkflowIdSchema } from "../types/civictrail";
import { computeReadiness } from "../readiness/engine";
import { buildLedger } from "../evidence/ledger";
import { buildActionPacket } from "../action-packet/packet";
import { getRouteForWorkflow } from "../routes";
import { runTriageAgent } from "./triage-agent";
import type { AgentRunCollector } from "./agent-tools";
import {
  applyClassificationGuard,
  keywordFallbackClassify,
  resolveWorkflow,
  unclassifiedReviewFinding,
} from "./classification";

function assembleReadiness(
  findings: RuleResult[],
  ledgerExtras: Parameters<typeof buildLedger>[0],
): ReadinessResult {
  const failing = findings.filter((f) => f.status === "fail");
  const reviewing = findings.filter((f) => f.status === "review");
  const status = failing.length > 0 ? "blocked" : reviewing.length > 0 ? "human_review" : "ready";
  return {
    status,
    blockingCount: failing.length,
    reviewCount: reviewing.length,
    findings,
    ledger: buildLedger(ledgerExtras),
  };
}

/**
 * Deterministic result for an unsupported / unknown classification.
 *
 * Exported pure (no agent involvement) so tests can prove that unsupported
 * and ambiguous cases always resolve to HUMAN_REVIEW.
 */
export function buildUnsupportedWorkflowResult(input: {
  classification: AgentClassification | null;
  guard: ClassificationGuardOutcome;
  agentUsed: boolean;
  agentSummary: string;
  agentError?: string;
}): TriageResponse {
  const note = input.guard
    ? `${input.guard.reason} Suggested workflow "${input.guard.suggestedWorkflow}" was not accepted by the deterministic classification guard.`
    : "No classification could be resolved.";
  const reviewFinding = unclassifiedReviewFinding(note);
  const readiness = assembleReadiness([reviewFinding], {
    classification: input.classification
      ? {
          claim: "Issue classified by the triage agent",
          evidence: `${input.classification.workflow} — ${input.classification.rationale}`,
          confidence: input.classification.confidence,
          determinationSource: input.classification.determinationSource,
        }
      : null,
    route: null,
    ruleResults: [reviewFinding],
  });

  return {
    ok: true,
    agentUsed: input.agentUsed,
    agentSummary: input.agentSummary,
    agentError: input.agentError,
    workflowResolved: "unknown",
    classification: input.classification,
    classificationGuard: input.guard,
    route: null,
    readiness,
    actionPacket: null,
  };
}

export async function runTriage(request: TriageRequest): Promise<TriageResponse> {
  let collector: AgentRunCollector | null = null;
  let agentSummary = "";
  let agentError: string | undefined;

  try {
    const run = await runTriageAgent({
      description: request.description,
      userSelection: request.workflow,
      evidence: request.evidence,
    });
    collector = run.collector;
    agentSummary = run.agentSummary;
    if (run.agentCompletedNormally === false) {
      // Honest fallback UX: the wall-clock deadline fired and the agent run
      // did not complete, so the UI must not claim that it did.
      agentError =
        "Agent analysis was stopped at the interactive time limit — deterministic checks still applied.";
    }
  } catch {
    agentError = "Agent run failed or unavailable — deterministic checks still applied.";
  }

  const { classification, workflow } = resolveWorkflow(request, collector);
  const resolved = ImplementedWorkflowIdSchema.safeParse(workflow);

  // CONSERVATIVE CLASSIFICATION GUARD (deterministic, runs after the agent).
  // Agent confidence alone never authorizes routing; strong explicit signals
  // in the description are required for either supported workflow.
  const guarded = applyClassificationGuard({
    description: request.description,
    suggestedWorkflow: workflow,
    classification,
  });

  if (!resolved.success || guarded.workflow === "unknown") {
    // Unsupported / ambiguous / insufficient: deterministic HUMAN_REVIEW.
    return buildUnsupportedWorkflowResult({
      classification,
      guard: guarded.guard,
      agentUsed: collector !== null,
      agentSummary,
      agentError,
    });
  }

  const workflowResolved: ImplementedWorkflowId = resolved.data;

  // Deterministic readiness — computed directly from the rule engine.
  const readiness = computeReadiness({ workflow: workflowResolved, evidence: request.evidence });
  const route = getRouteForWorkflow(workflowResolved);

  const fullReadiness: ReadinessResult = {
    ...readiness,
    ledger: buildLedger({
      classification: classification
        ? {
            claim: "Issue classified by the triage agent",
            evidence: `${classification.workflow} — ${classification.rationale}`,
            confidence: classification.confidence,
            determinationSource: classification.determinationSource,
          }
        : null,
      route: {
        claim: `Official route identified for ${workflowResolved}`,
        evidence: route.verifiedGuidance.join(" "),
        sourceId: route.sources[0]?.sourceId ?? "official-source",
        reference:
          route.sources[0]?.officialReferences?.[0] ?? route.sources[0]?.officialUrl ?? "unknown",
      },
      ruleResults: readiness.findings,
    }),
  };

  const issueSummary =
    agentSummary.trim().length > 0
      ? agentSummary.trim()
      : `CivicTrail triaged the reported problem under the ${route.label} workflow.`;

  const actionPacket = buildActionPacket({
    workflow: workflowResolved,
    route,
    evidence: request.evidence,
    readiness: fullReadiness,
    issueSummary,
  });

  return {
    ok: true,
    agentUsed: collector !== null,
    agentSummary,
    agentError,
    workflowResolved: workflowResolved,
    classification,
    classificationGuard: guarded.guard,
    route,
    readiness: fullReadiness,
    actionPacket,
  };
}

export { keywordFallbackClassify };
