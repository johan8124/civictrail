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

export function createCivicTrailTools(collector: AgentRunCollector) {
  const classifyIssue = tool({
    name: classifyIssueTool.name,
    description: classifyIssueTool.description,
    inputSchema: classifyIssueInputSchema,
    callback: async (input: z.infer<typeof classifyIssueInputSchema>) => {
      collector.toolsCalled.push("classify_issue");
      const result = await classifyIssueTool.invoke(input);
      collector.classification = result.classification;
      return result;
    },
  });

  const lookupRoute = tool({
    name: lookupOfficialRouteTool.name,
    description: lookupOfficialRouteTool.description,
    inputSchema: lookupRouteInputSchema,
    callback: async (input: z.infer<typeof lookupRouteInputSchema>): Promise<RouteLookupResult> => {
      collector.toolsCalled.push("lookup_official_route");
      const result = await lookupOfficialRouteTool.invoke(input);
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
      collector.toolsCalled.push("inspect_evidence");
      const result = await inspectEvidenceTool.invoke(input);
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
      collector.toolsCalled.push("validate_action_packet");
      const result = await validateActionPacketTool.invoke(input);
      collector.packetValidation = result;
      return result;
    },
  });

  return [classifyIssue, lookupRoute, inspectEvidence, validatePacket] as const;
}
