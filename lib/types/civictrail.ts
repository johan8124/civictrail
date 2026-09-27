/**
 * CivicTrail shared domain types.
 *
 * Zod schemas validate all external / user-supplied data.
 * These types are shared between server (agent + rules) and client (UI) code.
 * This module must stay dependency-light: only `zod` is imported.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Workflows                                                           */
/* ------------------------------------------------------------------ */

export const WORKFLOW_IDS = ["consumer_grievance", "cyber_financial_fraud", "unknown"] as const;

export type WorkflowId = (typeof WORKFLOW_IDS)[number];

/** Workflows the agent may classify into ("unknown" included). */
export const WorkflowIdSchema = z.enum(WORKFLOW_IDS);

/** Workflows that have a deterministic rule set wired up. */
export const IMPLEMENTED_WORKFLOW_IDS = ["consumer_grievance", "cyber_financial_fraud"] as const;

export type ImplementedWorkflowId = (typeof IMPLEMENTED_WORKFLOW_IDS)[number];

export const ImplementedWorkflowIdSchema = z.enum(IMPLEMENTED_WORKFLOW_IDS);

/* ------------------------------------------------------------------ */
/* Official consumer routes (Phase 3)                                  */
/* ------------------------------------------------------------------ */

/**
 * Which official consumer route the person is preparing for.
 *
 * SOURCE RULE (Sources.md section 5): the verified NCH and e-Jagriti facts
 * describe two DIFFERENT official routes — NCH is a pre-litigation grievance
 * mechanism, while e-Jagriti is the online complaint route before a Consumer
 * Commission. The verified sources do NOT state which of the two applies to a
 * given consumer problem, so CivicTrail never infers it: the person selects it,
 * and "not_sure" resolves to HUMAN_REVIEW.
 */
export const CONSUMER_ROUTE_CHOICES = ["not_sure", "nch_grievance", "e_jagriti_complaint"] as const;

export type ConsumerRouteChoice = (typeof CONSUMER_ROUTE_CHOICES)[number];

export const ConsumerRouteChoiceSchema = z.enum(CONSUMER_ROUTE_CHOICES);

/* ------------------------------------------------------------------ */
/* Evidence intake                                                     */
/* ------------------------------------------------------------------ */

/**
 * Real uploaded file metadata. Only present when an actual file upload is
 * supplied; absence means no real upload exists and file-size rules must not
 * pretend to validate anything.
 */
export const UPLOADED_FILE_META_SCHEMA = z.object({
  name: z.string().min(1).max(255),
  /** Real byte size of the uploaded file. */
  size: z.number().int().min(0).max(1024 * 1024 * 1024),
  mimeType: z.string().max(128).optional(),
});

export type UploadedFileMeta = z.infer<typeof UPLOADED_FILE_META_SCHEMA>;

/**
 * Structured evidence supplied by the citizen.
 *
 * SECURITY: every value here is UNTRUSTED user input. It is only ever:
 * - validated with Zod,
 * - echoed back as plain text,
 * - evaluated by deterministic presence checks.
 * It is never executed, never treated as instructions, never sent anywhere.
 */
export const EvidenceRecordSchema = z.object({
  // Consumer grievance intake fields (product intake requirements).
  // Those marked "product intake requirement" are CivicTrail intake checks,
  // NOT claims about mandatory legal filing requirements.
  problemDescription: z.string().optional(),
  sellerOrProvider: z.string().optional(),
  purchaseEvidence: z.string().optional(),
  paymentEvidence: z.string().optional(),

  // Phase 3 — official consumer route the person is preparing for.
  // "not_sure" (or absent) keeps the route UNRESOLVED -> HUMAN_REVIEW.
  consumerRouteRequested: ConsumerRouteChoiceSchema.optional(),

  // Phase 3 — e-Jagriti verified requirement (Sources.md section 5.2, FAQ 4):
  // "submission of a Notarized affidavit is mandatory while filing a complaint
  // before the Consumer Commission". Presence means the person confirms a
  // signed, notarized affidavit is available. This is the ONLY consumer
  // document CivicTrail treats as a deterministic requirement, because it is
  // the only one the verified official source states as mandatory.
  notarizedAffidavit: z.string().optional(),

  // Cyber financial fraud fields (official complainant checklist on
  // cybercrime.gov.in — presence checks only).
  incidentDateTime: z.string().optional(),
  incidentDetails: z.string().optional(),
  identityDocument: z.string().optional(),
  bankWalletMerchant: z.string().optional(),
  transactionId: z.string().optional(),
  transactionDate: z.string().optional(),
  fraudAmount: z.string().optional(),
  supportingEvidence: z.string().optional(),

  // Real uploaded file metadata — only present when an actual upload exists.
  identityDocumentFile: UPLOADED_FILE_META_SCHEMA.optional(),
  supportingEvidenceFiles: z.array(UPLOADED_FILE_META_SCHEMA).max(20).optional(),
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export type CyberEvidenceField =
  | "incidentDateTime"
  | "incidentDetails"
  | "identityDocument"
  | "bankWalletMerchant"
  | "transactionId"
  | "transactionDate"
  | "fraudAmount"
  | "supportingEvidence";

export type ConsumerEvidenceField =
  | "problemDescription"
  | "sellerOrProvider"
  | "purchaseEvidence"
  | "paymentEvidence";

export type AnyEvidenceField = CyberEvidenceField | ConsumerEvidenceField;
/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export const RULE_STATUSES = ["pass", "fail", "review"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

/**
 * Where a rule's requirement comes from.
 * - "official_checklist": mirrors a field named in a verified official source.
 * - "civictrail_intake_requirement": a CivicTrail product intake requirement.
 *   These are NOT claims about mandatory legal filing requirements.
 */
export type RequirementKind = "official_checklist" | "civictrail_intake_requirement";

export interface RuleEvaluation {
  status: RuleStatus;
  /** Human-readable factual explanation of what was checked and found. */
  evidence: string;
  /** Deterministic checks carry confidence 1. */
  confidence: number;
}

export interface RuleResult extends RuleEvaluation {
  ruleId: string;
  description: string;
  requirementKind: RequirementKind;
  /** Workflow the rule belongs to (omitted for general classification rules). */
  workflow?: ImplementedWorkflowId;
  /** Verified source backing the requirement, when applicable. */
  sourceId?: string;
  /** Where this check comes from, e.g. a registry reference string. */
  reference: string;
}

export interface RuleDefinition {
  ruleId: string;
  description: string;
  requirementKind: RequirementKind;
  workflow: ImplementedWorkflowId;
  sourceId?: string;
  reference: string;
  /**
   * When provided, the rule only applies (and only appears in results) when
   * this predicate holds — e.g. file-size rules only run when a real upload
   * exists. No result is faked when the rule does not apply.
   */
  applies?: (input: EvidenceRecord) => boolean;
  evaluate(input: EvidenceRecord): RuleEvaluation;
}

/* ------------------------------------------------------------------ */
/* Evidence ledger                                                     */
/* ------------------------------------------------------------------ */

export const LEDGER_STATUSES = ["pass", "fail", "review", "info"] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export interface LedgerEntry {
  id: string;
  claim: string;
  evidence: string;
  source: string;
  ruleId: string | null;
  status: LedgerStatus;
  confidence: number;
  timestamp: string;
  reference: string;
}

/* ------------------------------------------------------------------ */
/* Readiness                                                           */
/* ------------------------------------------------------------------ */

export const READINESS_STATUSES = ["ready", "blocked", "human_review"] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export interface ReadinessResult {
  status: ReadinessStatus;
  blockingCount: number;
  reviewCount: number;
  findings: RuleResult[];
  ledger: LedgerEntry[];
}


/* ------------------------------------------------------------------ */
/* Source registry                                                     */
/* ------------------------------------------------------------------ */

export const SOURCE_STATUSES = ["verified"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SOURCE_CATEGORIES = [
  "consumer_grievance",
  "cyber_financial_fraud",
] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

export interface OfficialSource {
  sourceId: string;
  name: string;
  category: SourceCategory;
  jurisdiction: string;
  officialUrl: string;
  verifiedFacts: string[];
  sourceStatus: SourceStatus;
  /** Extra official reference URLs for this source, when verified. */
  officialReferences?: string[];
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export interface OfficialRoute {
  routeId: string;
  workflow: ImplementedWorkflowId;
  label: string;
  jurisdiction: string;
  /** Only verified facts from the source registry appear here. */
  verifiedGuidance: string[];
  sources: OfficialSource[];
}

/* ------------------------------------------------------------------ */
/* Action packet                                                       */
/* ------------------------------------------------------------------ */

export interface EvidenceIndexEntry {
  field: string;
  label: string;
  provided: boolean;
  requirementKind: RequirementKind;
}

export interface ActionPacket {
  packetId: string;
  generatedAt: string;
  issueSummary: string;
  workflow: ImplementedWorkflowId;
  route: OfficialRoute;
  evidenceIndex: EvidenceIndexEntry[];
  sourceReferences: OfficialSource[];
  readiness: {
    status: ReadinessStatus;
    blockingCount: number;
    reviewCount: number;
  };
  nextActions: string[];
  disclaimer: string;
  requiresHumanConfirmation: true;
}

export const DISCLAIMER =
  "CivicTrail provides informational and workflow assistance, not legal advice or legal representation. Verify official requirements before taking action.";

/* ------------------------------------------------------------------ */
/* Classification guard (Phase 2)                                       */
/* ------------------------------------------------------------------ */

/**
 * Result of the deterministic classification guard. The guard runs after the
 * agent's suggestion (or the keyword fallback / user selection) and its
 * decision cannot be overridden by the agent. Confidence never authorizes
 * routing on its own.
 */
export interface ClassificationGuardOutcome {
  suggestedWorkflow: WorkflowId;
  resolvedWorkflow: WorkflowId;
  outcome: "accepted" | "downgraded_to_unknown";
  reason: string;
}

/* ------------------------------------------------------------------ */
/* API contracts                                                       */
/* ------------------------------------------------------------------ */

export const TRIAGE_REQUEST_SCHEMA = z.object({
  description: z.string().min(1, "A problem description is required.").max(6000),
  /** "auto" lets the Strands agent classify the issue. */
  workflow: z.enum(["auto", ...IMPLEMENTED_WORKFLOW_IDS]).default("auto"),
  evidence: EvidenceRecordSchema.default({}),
});

export type TriageRequest = z.infer<typeof TRIAGE_REQUEST_SCHEMA>;

export interface AgentClassification {
  workflow: WorkflowId;
  confidence: number;
  rationale: string;
  determinationSource: "agent" | "keyword_fallback" | "user_selection";
}

export interface TriageResponse {
  ok: true;
  /**
   * True only when the Strands agent completed the required four-tool sequence
   * (classify_issue, lookup_official_route, inspect_evidence,
   * validate_action_packet) in that order, each recording its result. It is
   * never true merely because an agent run was attempted, and it is never
   * derived from model prose.
   */
  agentUsed: boolean;
  agentSummary: string;
  agentError?: string;
  workflowResolved: WorkflowId;
  classification: AgentClassification | null;
  /** Deterministic guard outcome applied after the classification. */
  classificationGuard: ClassificationGuardOutcome | null;
  route: OfficialRoute | null;
  readiness: ReadinessResult;
  /** Null when the issue could not be classified into a supported workflow. */
  actionPacket: ActionPacket | null;
}
