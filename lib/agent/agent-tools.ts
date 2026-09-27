/**
 * Per-run tool factory. Wraps the four standalone CivicTrail tools so each
 * invocation records its authoritative, tool-computed result into a shared
 * collector. Downstream code uses these recorded tool results — never LLM
 * prose — for classification and route lookup.
 */
import type {
  AgentClassification,
  ImplementedWorkflowId,
  OfficialRoute,
} from "../types/civictrail";
import {
  classifyIssueTool,
  classifyIssueInputSchema,
  lookupOfficialRouteTool,
  lookupRouteInputSchema,
  inspectEvidenceTool,
  inspectEvidenceInputSchema,
  validateActionPacketTool,
  validatePacketInputSchema,
  type EvidenceInspectionResult,
  type PacketValidationResult,
  type RouteLookupResult,
} from "./tool-definitions";
import { tool } from "@strands-agents/sdk";
import type { z } from "zod";

export interface AgentRunCollector {
  classification?: AgentClassification;
  routeLookup?: { workflow: ImplementedWorkflowId; route: OfficialRoute };
  evidenceInspection?: EvidenceInspectionResult;
  packetValidation?: PacketValidationResult;
  toolsCalled: string[];
}

export function createCollector(): AgentRunCollector {
  return { toolsCalled: [] };
}

/* ------------------------------------------------------------------ */
/* Agent completion gate (deterministic)                                */
/* ------------------------------------------------------------------ */

/**
 * The one authoritative required agent tool sequence. An agent run counts as
 * COMPLETE only when all four tools have executed successfully in this order:
 * records below are written exclusively by the tools' own callbacks, so a run
 * that stops early, runs tools out of order, or fails a tool's validation can
 * never be reported as a completed agent analysis.
 */
export const REQUIRED_TOOL_SEQUENCE = [
  "classify_issue",
  "lookup_official_route",
  "inspect_evidence",
  "validate_action_packet",
] as const;

export type RequiredToolName = (typeof REQUIRED_TOOL_SEQUENCE)[number];

export interface AgentCompletionStatus {
  /** Tools actually executed during the run, in call order (successful executions only). */
  toolsCalled: string[];
  /** True only when every required tool completed successfully, in order. */
  sequenceComplete: boolean;
  /** Number of required tools that completed with a recorded result (0-4). */
  completedCount: number;
  /** First required tool that did not complete, or null when the sequence is complete. */
  missingTool: RequiredToolName | null;
  /** Deterministic, human-readable explanation of the outcome. */
  reason: string;
}

/**
 * Evaluates a run's recorded tool results against the required sequence.
 *
 * Order is checked on each tool's FIRST call: a required tool whose first
 * invocation happens before an earlier required tool's is treated as out of
 * order. Duplicate re-invocations after the sequence is satisfied (e.g. a
 * retry following a validation error) do not invalidate a run.
 *
 * "Completed successfully" means the tool's own callback recorded its result —
 * classification, route lookup, evidence inspection and packet validation —
 * so a rejected tool call is never counted as complete.
 */
export function evaluateAgentCompletion(collector: AgentRunCollector): AgentCompletionStatus {
  const toolsCalled = [...collector.toolsCalled];
  const recorded: Record<RequiredToolName, boolean> = {
    classify_issue: collector.classification !== undefined,
    lookup_official_route: collector.routeLookup !== undefined,
    inspect_evidence: collector.evidenceInspection !== undefined,
    validate_action_packet: collector.packetValidation !== undefined,
  };

  let previousIndex = -1;
  let completedCount = 0;
  for (const tool of REQUIRED_TOOL_SEQUENCE) {
    if (!recorded[tool]) {
      return {
        toolsCalled,
        sequenceComplete: false,
        completedCount,
        missingTool: tool,
        reason: `${tool} did not complete`,
      };
    }
    const firstCallIndex = toolsCalled.indexOf(tool);
    if (firstCallIndex <= previousIndex) {
      return {
        toolsCalled,
        sequenceComplete: false,
        completedCount,
        missingTool: tool,
        reason: `${tool} completed out of the required order`,
      };
    }
    previousIndex = firstCallIndex;
    completedCount += 1;
  }

  return {
    toolsCalled,
    sequenceComplete: true,
    completedCount,
    missingTool: null,
    reason: "all four required tools completed in order",
  };
}

export function createCivicTrailTools(collector: AgentRunCollector) {
  const classifyIssue = tool({
    name: classifyIssueTool.name,
    description: classifyIssueTool.description,
    inputSchema: classifyIssueInputSchema,
    callback: async (input: z.infer<typeof classifyIssueInputSchema>) => {
      const result = await classifyIssueTool.invoke(input);
      collector.toolsCalled.push("classify_issue");
      collector.classification = result.classification;
      return result;
    },
  });

  const lookupRoute = tool({
    name: lookupOfficialRouteTool.name,
    description: lookupOfficialRouteTool.description,
    inputSchema: lookupRouteInputSchema,
    callback: async (input: z.infer<typeof lookupRouteInputSchema>): Promise<RouteLookupResult> => {
      const result = await lookupOfficialRouteTool.invoke(input);
      collector.toolsCalled.push("lookup_official_route");
      collector.routeLookup = { workflow: input.workflow, route: result.route };
      return result;
    },
  });

  const inspectEvidence = tool({
    name: inspectEvidenceTool.name,
    description: inspectEvidenceTool.description,
    inputSchema: inspectEvidenceInputSchema,
    callback: async (
      input: z.infer<typeof inspectEvidenceInputSchema>,
    ): Promise<EvidenceInspectionResult> => {
      const result = await inspectEvidenceTool.invoke(input);
      collector.toolsCalled.push("inspect_evidence");
      collector.evidenceInspection = result;
      return result;
    },
  });

  const validatePacket = tool({
    name: validateActionPacketTool.name,
    description: validateActionPacketTool.description,
    inputSchema: validatePacketInputSchema,
    callback: async (
      input: z.infer<typeof validatePacketInputSchema>,
    ): Promise<PacketValidationResult> => {
      const result = await validateActionPacketTool.invoke(input);
      collector.toolsCalled.push("validate_action_packet");
      collector.packetValidation = result;
      return result;
    },
  });

  return [classifyIssue, lookupRoute, inspectEvidence, validatePacket] as const;
}
