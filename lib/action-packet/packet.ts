/**
 * Action Packet builder.
 *
 * The packet is assembled deterministically from the route and the rule
 * results. It never submits anything anywhere; `requiresHumanConfirmation`
 * is always true.
 */
import type {
  ActionPacket,
  AgentClassification,
  AnyEvidenceField,
  EvidenceIndexEntry,
  EvidenceRecord,
  ImplementedWorkflowId,
  OfficialRoute,
  ReadinessResult,
} from "../types/civictrail";
import { DISCLAIMER } from "../types/civictrail";
import { isProvided } from "../rules/engine";

export interface EvidenceFieldSpec {
  field: AnyEvidenceField;
  label: string;
}

export const CYBER_EVIDENCE_FIELDS: EvidenceFieldSpec[] = [
  { field: "incidentDateTime", label: "Incident date/time" },
  { field: "incidentDetails", label: "Incident details" },
  { field: "identityDocument", label: "Identity document" },
  { field: "bankWalletMerchant", label: "Bank / wallet / merchant" },
  { field: "transactionId", label: "12-digit transaction ID / UTR" },
  { field: "transactionDate", label: "Transaction date" },
  { field: "fraudAmount", label: "Fraud amount" },
  { field: "supportingEvidence", label: "Relevant supporting evidence" },
];

export const CONSUMER_EVIDENCE_FIELDS: EvidenceFieldSpec[] = [
  { field: "problemDescription", label: "Problem description" },
  { field: "sellerOrProvider", label: "Seller or service provider" },
  { field: "purchaseEvidence", label: "Purchase evidence" },
  { field: "paymentEvidence", label: "Payment evidence" },
];

export function getEvidenceFieldSpecs(workflow: ImplementedWorkflowId): EvidenceFieldSpec[] {
  return workflow === "cyber_financial_fraud" ? CYBER_EVIDENCE_FIELDS : CONSUMER_EVIDENCE_FIELDS;
}

function buildEvidenceIndex(
  workflow: ImplementedWorkflowId,
  evidence: EvidenceRecord,
): EvidenceIndexEntry[] {
  return getEvidenceFieldSpecs(workflow).map((spec) => ({
    field: spec.field,
    label: spec.label,
    provided: isProvided(evidence[spec.field]),
    requirementKind:
      workflow === "cyber_financial_fraud" ? "official_checklist" : "civictrail_intake_requirement",
  }));
}

function buildNextActions(input: {
  route: OfficialRoute;
  readiness: ReadinessResult;
  workflow: ImplementedWorkflowId;
}): string[] {
  const actions: string[] = [];
  const missing = input.readiness.findings
    .filter((f) => f.status === "fail")
    .map((f) => f.description);

  if (missing.length > 0) {
    actions.push(`Collect the missing items before proceeding: ${missing.join("; ")}.`);
  }

  const underReview = input.readiness.findings.filter((f) => f.status === "review");
  if (underReview.length > 0) {
    actions.push(`Have a person double-check items flagged for review: ${underReview.map((f) => f.description).join("; ")}.`);
  }

  actions.push(
    `Review the official page for this route: ${input.route.sources[0].officialUrl} (verify requirements directly on the official site).`,
  );

  if (input.workflow === "cyber_financial_fraud") {
    actions.push(
      "For immediate reporting of cyber financial fraud, the official portal instructs reporting via 1930 (as stated on cybercrime.gov.in).",
    );
  }

  if (input.readiness.status !== "blocked") {
    actions.push(
      "A human must review and confirm this packet before any official action is taken. CivicTrail never submits anything automatically.",
    );
  }

  return actions;
}

export function buildActionPacket(input: {
  workflow: ImplementedWorkflowId;
  route: OfficialRoute;
  evidence: EvidenceRecord;
  readiness: ReadinessResult;
  issueSummary: string;
}): ActionPacket {
  const readinessSnapshot = {
    status: input.readiness.status,
    blockingCount: input.readiness.blockingCount,
    reviewCount: input.readiness.reviewCount,
  };

  return {
    packetId: `ct-packet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    issueSummary: input.issueSummary,
    workflow: input.workflow,
    route: input.route,
    evidenceIndex: buildEvidenceIndex(input.workflow, input.evidence),
    sourceReferences: input.route.sources,
    readiness: readinessSnapshot,
    nextActions: buildNextActions({
      route: input.route,
      readiness: input.readiness,
      workflow: input.workflow,
    }),
    disclaimer: DISCLAIMER,
    requiresHumanConfirmation: true,
  };
}

export type { AgentClassification };
