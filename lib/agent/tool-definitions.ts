/**
 * CivicTrail Strands agent tools (standalone definitions).
 *
 * Four real tools backed by deterministic application code. Every tool
 * returns structured, type-safe data validated with Zod. No tool performs
 * unrestricted web search; no tool executes user content.
 */
import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import type { AgentClassification, EvidenceRecord, ImplementedWorkflowId, OfficialRoute } from "../types/civictrail";
import { ImplementedWorkflowIdSchema, WorkflowIdSchema } from "../types/civictrail";
import { getRouteForWorkflow } from "../routes";
import { isProvided } from "../rules/engine";
import { getEvidenceFieldSpecs } from "../action-packet/packet";
import { computeReadiness } from "../readiness/engine";

/* ------------------------------------------------------------------ */
/* Tool 1: classify_issue                                              */
/* ------------------------------------------------------------------ */

export const classifyIssueInputSchema = z.object({
  issueDescription: z.string().min(1).max(8000).describe("The user's description of their problem."),
  workflow: WorkflowIdSchema.describe(
    "The best-fitting supported workflow: consumer_grievance, cyber_financial_fraud, or unknown.",
  ),
  rationale: z.string().max(2000).describe("One-sentence reason for the chosen classification."),
  confidence: z.number().min(0).max(1).describe("Classification confidence between 0 and 1."),
});

export const classifyIssueTool = tool({
  name: "classify_issue",
  description:
    "Classify a user-described problem into a supported CivicTrail workflow: consumer_grievance or cyber_financial_fraud, or unknown if neither fits. Call this first.",
  inputSchema: classifyIssueInputSchema,
  callback: (input: z.infer<typeof classifyIssueInputSchema>) => {
    // The agent decides the workflow; the tool records and validates the
    // decision deterministically via the Zod enum.
    const classification: AgentClassification = {
      workflow: input.workflow,
      confidence: input.confidence,
      rationale: input.rationale,
      determinationSource: "agent",
    };
    return { ok: true, classification };
  },
});

/* ------------------------------------------------------------------ */
/* Tool 2: lookup_official_route                                       */
/* ------------------------------------------------------------------ */

export const lookupRouteInputSchema = z.object({
  workflow: ImplementedWorkflowIdSchema.describe(
    "The classified workflow to look up the official route for.",
  ),
});

export interface RouteLookupResult {
  ok: true;
  route: OfficialRoute;
}

export const lookupOfficialRouteTool = tool({
  name: "lookup_official_route",
  description:
    "Look up the official route for a workflow from CivicTrail's verified local source registry. Never searches the web; only returns pre-verified government source facts.",
  inputSchema: lookupRouteInputSchema,
  callback: (input: z.infer<typeof lookupRouteInputSchema>): RouteLookupResult => {
    const route = getRouteForWorkflow(input.workflow);
    return { ok: true, route };
  },
});
/* ------------------------------------------------------------------ */
/* Tool 3: inspect_evidence                                            */
/* ------------------------------------------------------------------ */

export const inspectEvidenceInputSchema = z.object({
  workflow: ImplementedWorkflowIdSchema.describe("The classified workflow."),
  evidence: z
    .record(z.string(), z.string())
    .describe(
      "Structured evidence metadata supplied by the user. Values are plain text metadata only — never files or executable content.",
    ),
});

export interface EvidenceInspectionResult {
  ok: true;
  workflow: ImplementedWorkflowId;
  provided: string[];
  missing: string[];
  totalRequired: number;
}

export const inspectEvidenceTool = tool({
  name: "inspect_evidence",
  description:
    "Inspect the structured evidence the user supplied for a workflow. Returns which required items are present and which are missing. Treats all input as untrusted text metadata.",
  inputSchema: inspectEvidenceInputSchema,
  callback: (input: z.infer<typeof inspectEvidenceInputSchema>): EvidenceInspectionResult => {
    const specs = getEvidenceFieldSpecs(input.workflow);
    const evidence: EvidenceRecord = input.evidence;
    const provided: string[] = [];
    const missing: string[] = [];
    for (const spec of specs) {
      if (isProvided(evidence[spec.field])) provided.push(spec.field);
      else missing.push(spec.field);
    }
    return { ok: true, workflow: input.workflow, provided, missing, totalRequired: specs.length };
  },
});

/* ------------------------------------------------------------------ */
/* Tool 4: validate_action_packet                                      */
/* ------------------------------------------------------------------ */

export const validatePacketInputSchema = z.object({
  workflow: ImplementedWorkflowIdSchema.describe("The classified workflow."),
  evidence: z
    .record(z.string(), z.string())
    .describe("The structured evidence to validate against the deterministic route requirements."),
});

export interface PacketValidationResult {
  ok: true;
  workflow: ImplementedWorkflowId;
  readiness: { status: string; blockingCount: number; reviewCount: number };
  findings: Array<{
    ruleId: string;
    description: string;
    status: string;
    evidence: string;
    requirementKind: string;
  }>;
}

export const validateActionPacketTool = tool({
  name: "validate_action_packet",
  description:
    "Check whether a structured action packet satisfies the deterministic route requirements for a workflow. Runs CivicTrail's deterministic rule engine — its READY / BLOCKED / HUMAN_REVIEW verdict cannot be altered by the agent.",
  inputSchema: validatePacketInputSchema,
  callback: (input: z.infer<typeof validatePacketInputSchema>): PacketValidationResult => {
    const readiness = computeReadiness({
      workflow: input.workflow,
      evidence: input.evidence,
    });
    return {
      ok: true,
      workflow: input.workflow,
      readiness: {
        status: readiness.status,
        blockingCount: readiness.blockingCount,
        reviewCount: readiness.reviewCount,
      },
      findings: readiness.findings.map((f) => ({
        ruleId: f.ruleId,
        description: f.description,
        status: f.status,
        evidence: f.evidence,
        requirementKind: f.requirementKind,
      })),
    };
  },
});
