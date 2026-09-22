/*

 * CivicTrail deterministic rule engine.
 *
 * This engine is deliberately INDEPENDENT of the LLM. It imports no agent
 * code, makes no model calls, and produces the same result for the same
 * input every time. Final CivicTrail readiness can only come from here.
 *
 * Phase 2: the cyber rules validate the verified official checklist items
 * from the National Cyber Crime Reporting Portal (Sources.md), including the
 * 200-character incident-details minimum, conservative special-character
 * validation, the exactly-12-digit transaction ID / UTR, a valid positive
 * numeric fraud amount, and — only when real uploaded files are actually
 * supplied — the official file-size limits (5 MB identity document, 10 MB
 * per evidence file). No unverified requirement is invented.
 */
import type {
  AnyEvidenceField,
  EvidenceRecord,
  ImplementedWorkflowId,
  RuleDefinition,
  RuleEvaluation,
  RuleResult,
} from "../types/civictrail";

/** Longest chain of whitespace-only characters is treated as "empty". */
const WHITESPACE_ONLY = /^\s*$/;

/** Whitespace padding + optional wrapping quotes/backticks are stripped. */
const WRAPPER_CHARS = /^[\s"'`]+|[\s"'`]+$/g;

/* ------------------------------------------------------------------ */
/* Verified official checklist constants (Sources.md §1)                */
/* ------------------------------------------------------------------ */

/** Official checklist: incident details minimum of 200 characters. */
export const CYBER_MIN_INCIDENT_DETAILS_CHARS = 200;

/** Official checklist: identity document maximum upload size of 5 MB. */
export const CYBER_ID_MAX_BYTES = 5 * 1024 * 1024;

/** Official checklist: each supporting evidence file maximum 10 MB. */
export const CYBER_EVIDENCE_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** Official checklist: "12-digit Transaction ID / UTR No." — exactly 12 digits. */
export const CYBER_UTR_PATTERN = /^\d{12}$/;

/**
 * Conservative deterministic set of special characters treated as prohibited
 * in the incident-details field.
 *
 * SOURCE LIMITATION (UNKNOWN): Sources.md verifies that the portal's
 * incident-details field "lists special characters that are not allowed" but
 * does NOT enumerate the list. The exact official list could not be machine
 * verified, so this conservative set is applied deterministically and every
 * matched character is surfaced in the Evidence Ledger for human verification.
 * The *existence* of the restriction is verified; this exact set is a
 * CivicTrail product check pending verification of the official list.
 */
export const PROHIBITED_INCIDENT_DETAILS_CHARS: readonly string[] = [
  "#", "$", "%", "^", "&", "*", "<", ">", "|", "\\", "~", "`",
  "{", "}", "[", "]", "=", "+",
];

export function findProhibitedCharacters(value: string): string[] {
  return [...new Set([...value].filter((ch) => PROHIBITED_INCIDENT_DETAILS_CHARS.includes(ch)))];
}

/**
 * Parse a fraud amount as a valid positive numeric value (deterministic).
 * Accepts plain integers/decimals with optional thousands separators.
 */
export function parseValidFraudAmount(value: string | undefined): number | null {
  if (!isProvided(value)) return null;
  const cleaned = (value as string).replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isProvided(value: string | undefined): boolean {
  if (value === undefined) return false;
  const cleaned = value.replace(WRAPPER_CHARS, "");
  if (cleaned.length === 0) return false;
  if (WHITESPACE_ONLY.test(cleaned)) return false;
  // "null", "undefined", "n/a" placeholders do not count as evidence.
  if (/^(null|undefined|na|n\/a|none|unknown)$/i.test(cleaned)) return false;
  return true;
}

function truncate(value: string, max = 80): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 3)}...` : cleaned;
}

export function makePresenceRule(config: {
  ruleId: string;
  description: string;
  field: AnyEvidenceField;
  label: string;
  requirementKind: "official_checklist" | "civictrail_intake_requirement";
  workflow: ImplementedWorkflowId;
  sourceId?: string;
  reference: string;
}): RuleDefinition {
  const { ruleId, description, field, label, requirementKind, workflow, sourceId, reference } = config;
  return {
    ruleId,
    description,
    requirementKind,
    workflow,
    sourceId,
    reference,
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const raw = input[field];
      if (isProvided(raw)) {
        return {
          status: "pass",
          evidence: `Provided: "${truncate(raw as string)}".`,
          confidence: 1,
        };
      }
      return {
        status: "fail",
        evidence: `Not provided. "${label}" is required by this CivicTrail check.`,
        confidence: 1,
      };
    },
  };
}

function makeMinLengthRule(config: {
  ruleId: string;
  description: string;
  minLength: number;
  sourceId?: string;
  reference: string;
}): RuleDefinition {
  const { ruleId, description, minLength, sourceId, reference } = config;
  return {
    ruleId,
    description,
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId,
    reference,
    // Only applies when the field itself is provided; rule 002 covers absence.
    applies: (input) => isProvided(input.incidentDetails),
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const raw = input.incidentDetails as string;
      const length = raw.trim().length;
      if (length < minLength) {
        return {
          status: "fail",
          evidence: `Provided incident details are ${length} characters; the official checklist requires a minimum of ${minLength} characters.`,
          confidence: 1,
        };
      }
      return {
        status: "pass",
        evidence: `Incident details provided: ${length} characters (official minimum ${minLength}).`,
        confidence: 1,
      };
    },
  };
}

function makeProhibitedCharsRule(config: {
  ruleId: string;
  description: string;
  sourceId?: string;
  reference: string;
}): RuleDefinition {
  const { ruleId, description, sourceId, reference } = config;
  return {
    ruleId,
    description,
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId,
    reference,
    applies: (input) => isProvided(input.incidentDetails),
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const raw = input.incidentDetails as string;
      const matched = findProhibitedCharacters(raw);
      if (matched.length === 0) {
        return {
          status: "pass",
          evidence: "No characters from the conservative prohibited special-character set were found in the incident details.",
          confidence: 1,
        };
      }
      return {
        status: "fail",
        evidence: `Incident details contain characters from CivicTrail's conservative prohibited special-character set: ${matched.join(" ")}. The official portal field does not allow certain special characters; the exact official list is pending verification — confirm directly on the portal.`,
        confidence: 1,
      };
    },
  };
}

function makeUtrRule(config: {
  ruleId: string;
  description: string;
  sourceId?: string;
  reference: string;
}): RuleDefinition {
  const { ruleId, description, sourceId, reference } = config;
  return {
    ruleId,
    description,
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId,
    reference,
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const raw = input.transactionId;
      if (!isProvided(raw)) {
        return {
          status: "fail",
          evidence: "Not provided. The official checklist asks for a 12-digit Transaction ID / UTR No.",
          confidence: 1,
        };
      }
      const cleaned = (raw as string).replace(/\s+/g, "");
      if (!CYBER_UTR_PATTERN.test(cleaned)) {
        const digits = cleaned.replace(/\D/g, "").length;
        return {
          status: "fail",
          evidence: `Provided transaction ID / UTR "${truncate(cleaned)}" is not exactly 12 digits (found ${digits} digit characters). The official checklist requires a 12-digit Transaction ID / UTR No.`,
          confidence: 1,
        };
      }
      return {
        status: "pass",
        evidence: "Provided transaction ID / UTR is exactly 12 digits.",
        confidence: 1,
      };
    },
  };
}

function makeFraudAmountRule(config: {
  ruleId: string;
  description: string;
  sourceId?: string;
  reference: string;
}): RuleDefinition {
  const { ruleId, description, sourceId, reference } = config;
  return {
    ruleId,
    description,
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId,
    reference,
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const raw = input.fraudAmount;
      if (!isProvided(raw)) {
        return {
          status: "fail",
          evidence: "Not provided. The official checklist asks for the fraud amount.",
          confidence: 1,
        };
      }
      const parsed = parseValidFraudAmount(raw);
      if (parsed === null) {
        return {
          status: "fail",
          evidence: `Provided fraud amount "${truncate(raw as string)}" is not a valid positive numeric value.`,
          confidence: 1,
        };
      }
      return {
        status: "pass",
        evidence: `Provided fraud amount ${parsed} is a valid positive numeric value.`,
        confidence: 1,
      };
    },
  };
}

export const RULES: readonly RuleDefinition[] = [
  // e-Jagriti: Sources.md section 5.2 (FAQ 4) states "submission of a
  // Notarized affidavit is mandatory while filing a complaint before the
  // Consumer Commission". This is the ONLY consumer document CivicTrail
  // treats as a deterministic requirement.
  //
  // CONSUMER-EJAGRITI-AFFIDAVIT-001 only APPLIES when e-Jagriti is the
  // chosen route. If the person does not claim to be preparing an e-Jagriti
  // complaint, this rule never runs.
  {
    ruleId: "CONSUMER-EJAGRITI-AFFIDAVIT-001",
    description:
      "e-Jagriti route: a signed, notarized affidavit is required before filing a complaint before the Consumer Commission (verified official requirement)",
    requirementKind: "official_checklist",
    workflow: "consumer_grievance",
    sourceId: "e-jagriti",
    reference:
      "official-checklist:e-jagriti.gov.in:notarized affidavit mandatory FAQ 4",
    applies: (input) => input.consumerRouteRequested === "e_jagriti_complaint",
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const raw = input.notarizedAffidavit;
      if (isProvided(raw)) {
        return {
          status: "pass",
          evidence:
            "Person confirms a signed, notarized affidavit is available for filing before the Consumer Commission (verified official requirement from e-Jagriti FAQ 4).",
          confidence: 1,
        };
      }
      return {
        status: "fail",
        evidence:
          "e-Jagriti route chosen but no notarized affidavit provided. The official FAQ states 'submission of a Notarized affidavit is mandatory while filing a complaint before the Consumer Commission' (e-Jagriti.gov.in FAQ 4).",
        confidence: 1,
      };
    },
  },
  makePresenceRule({
    ruleId: "CONSUMER-INTAKE-001",
    description: "Problem description provided",
    field: "problemDescription",
    label: "What went wrong (problem description)",
    requirementKind: "civictrail_intake_requirement",
    workflow: "consumer_grievance",
    reference: "civictrail_intake_requirement:problemDescription",
  }),
  makePresenceRule({
    ruleId: "CONSUMER-INTAKE-002",
    description: "Seller or service provider identified",
    field: "sellerOrProvider",
    label: "Seller or service provider",
    requirementKind: "civictrail_intake_requirement",
    workflow: "consumer_grievance",
    reference: "civictrail_intake_requirement:sellerOrProvider",
  }),
  makePresenceRule({
    ruleId: "CONSUMER-INTAKE-003",
    description: "Purchase evidence referenced",
    field: "purchaseEvidence",
    label: "Purchase evidence (e.g. order id / invoice reference)",
    requirementKind: "civictrail_intake_requirement",
    workflow: "consumer_grievance",
    reference: "civictrail_intake_requirement:purchaseEvidence",
  }),
  makePresenceRule({
    ruleId: "CONSUMER-INTAKE-004",
    description: "Payment evidence referenced",
    field: "paymentEvidence",
    label: "Payment evidence (e.g. payment reference)",
    requirementKind: "civictrail_intake_requirement",
    workflow: "consumer_grievance",
    reference: "civictrail_intake_requirement:paymentEvidence",
  }),

  // --- Phase 3 — Consumer route choice (verified sources, Sources.md §5) ---
  // The consumer route must be explicitly chosen (NCH or e-Jagriti) for the case
  // to be routable. "not_sure" (or absent) means the route is UNRESOLVED ->
  // HUMAN_REVIEW, because CivicTrail must not claim a specific official route
  // when the person has not decided.
  {
    ruleId: "CONSUMER-ROUTE-001",
    description:
      "Consumer route explicitly chosen (NCH pre-litigation grievance or e-Jagriti complaint before a Consumer Commission)",
    requirementKind: "civictrail_intake_requirement",
    workflow: "consumer_grievance",
    reference: "civictrail_intake_requirement:consumerRouteRequested",
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const route = input.consumerRouteRequested;
      if (route === "nch_grievance") {
        return {
          status: "pass",
          evidence:
            "Person has chosen the National Consumer Helpline pre-litigation grievance route (consumerhelpline.gov.in).",
          confidence: 1,
        };
      }
      if (route === "e_jagriti_complaint") {
        return {
          status: "pass",
          evidence:
            "Person has chosen the e-Jagriti online complaint route before a Consumer Commission (e-jagriti.gov.in).",
          confidence: 1,
        };
      }
      // "not_sure" (or absent) -> route unresolved -> review (HUMAN_REVIEW).
      return {
        status: "review",
        evidence:
          "Consumer route was not explicitly chosen ('not_sure' or absent). CivicTrail cannot claim a specific official route (NCH vs e-Jagriti) without the person's decision; a human must resolve the route.",
        confidence: 1,
      };
    },
  },


  // --- Phase 3 — NCH documents NOT required by default (Sources.md §5.1) ---
  // The official NCH wording is "necessary documents, if any". CivicTrail does
  // NOT treat documents as mandatory for NCH; this rule records that choice and
  // always passes when NCH is the route. It is informational, not a blocker.
  {
    ruleId: "CONSUMER-NCH-DOCS-001",
    description:
      "NCH grievance: documents are described by the official portal as 'necessary documents, if any' — not mandatory by default",
    requirementKind: "official_checklist",
    workflow: "consumer_grievance",
    sourceId: "national-consumer-helpline",
    reference:
      "official-checklist:consumerhelpline.gov.in:necessary documents if any (NCH)",
    applies: (input) =>
      input.consumerRouteRequested === "nch_grievance",
    evaluate(): RuleEvaluation {
      return {
        status: "pass",
        evidence:
          "NCH describes required documents as 'necessary documents, if any'. No document is treated as mandatory for the NCH route.",
        confidence: 1,
      };
    },
  },

  // -------- CYBER: verified National Cyber Crime Reporting Portal checklist --------
  makePresenceRule({
    ruleId: "CYBER-CHECKLIST-001",
    description: "Incident date and time provided",
    field: "incidentDateTime",
    label: "Incident date and time",
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:incident date and time",
  }),
  makePresenceRule({
    ruleId: "CYBER-CHECKLIST-002",
    description: "Incident details provided",
    field: "incidentDetails",
    label: "Incident details",
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:incident details",
  }),
  makeMinLengthRule({
    ruleId: "CYBER-CHECKLIST-003",
    description: "Incident details contain at least 200 characters",
    minLength: CYBER_MIN_INCIDENT_DETAILS_CHARS,
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:incident details minimum 200 characters",
  }),
  makeProhibitedCharsRule({
    ruleId: "CYBER-CHECKLIST-004",
    description: "Incident details free of prohibited special characters (conservative set)",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:incident details prohibited special characters",
  }),
  makePresenceRule({
    ruleId: "CYBER-CHECKLIST-005",
    description: "Identity document referenced",
    field: "identityDocument",
    label: "Identity document",
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:identity document",
  }),
  makePresenceRule({
    ruleId: "CYBER-CHECKLIST-006",
    description: "Bank / wallet / merchant identified",
    field: "bankWalletMerchant",
    label: "Bank / wallet / merchant",
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:bank/wallet/merchant",
  }),
  makeUtrRule({
    ruleId: "CYBER-CHECKLIST-007",
    description: "Transaction ID / UTR is exactly 12 digits",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:12-digit transaction ID / UTR",
  }),
  makePresenceRule({
    ruleId: "CYBER-CHECKLIST-008",
    description: "Transaction date provided",
    field: "transactionDate",
    label: "Transaction date",
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:transaction date",
  }),
  makeFraudAmountRule({
    ruleId: "CYBER-CHECKLIST-009",
    description: "Fraud amount is present and a valid positive numeric value",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:fraud amount",
  }),
  makePresenceRule({
    ruleId: "CYBER-CHECKLIST-010",
    description: "Relevant supporting evidence referenced",
    field: "supportingEvidence",
    label: "Relevant supporting evidence",
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:relevant supporting evidence",
  }),
  // File-size rules: only run when a REAL uploaded file is actually supplied.
  // No result is faked when no upload exists.
  {
    ruleId: "CYBER-CHECKLIST-011",
    description: "Identity document file within the official 5 MB limit",
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:identity document maximum 5 MB",
    applies: (input) => input.identityDocumentFile !== undefined,
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const file = input.identityDocumentFile!;
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      if (file.size > CYBER_ID_MAX_BYTES) {
        return {
          status: "fail",
          evidence: `Identity document "${file.name}" is ${mb} MB; the official checklist states a maximum size of 5 MB.`,
          confidence: 1,
        };
      }
      return {
        status: "pass",
        evidence: `Identity document "${file.name}" (${mb} MB) is within the official 5 MB limit.`,
        confidence: 1,
      };
    },
  },
  {
    ruleId: "CYBER-CHECKLIST-012",
    description: "Each supporting evidence file within the official 10 MB limit",
    requirementKind: "official_checklist",
    workflow: "cyber_financial_fraud",
    sourceId: "national-cyber-crime-portal",
    reference: "official-checklist:cybercrime.gov.in:supporting evidence maximum 10 MB each",
    applies: (input) => (input.supportingEvidenceFiles?.length ?? 0) > 0,
    evaluate(input: EvidenceRecord): RuleEvaluation {
      const files = input.supportingEvidenceFiles!;
      const oversized = files.filter((f) => f.size > CYBER_EVIDENCE_FILE_MAX_BYTES);
      if (oversized.length > 0) {
        return {
          status: "fail",
          evidence: `Evidence file(s) exceeding the official 10 MB limit: ${oversized
            .map((f) => `${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`)
            .join(", ")}.`,
          confidence: 1,
        };
      }
      return {
        status: "pass",
        evidence: `All ${files.length} evidence file(s) are within the official 10 MB limit.`,
        confidence: 1,
      };
    },
  },
];

/** All rules for a given workflow. */
export function getRulesForWorkflow(workflow: ImplementedWorkflowId): RuleDefinition[] {
  return RULES.filter((rule) => rule.workflow === workflow);
}

/**
 * Run every applicable rule for a workflow, deterministically. Rules whose
 * `applies` predicate does not hold (e.g. file-size rules without a real
 * upload) are excluded — no result is invented for them.
 */
export function evaluateRules(
  workflow: ImplementedWorkflowId,
  evidence: EvidenceRecord,
): RuleResult[] {
  return getRulesForWorkflow(workflow)
    .filter((rule) => rule.applies?.(evidence) ?? true)
    .map((rule) => ({
      ruleId: rule.ruleId,
      description: rule.description,
      requirementKind: rule.requirementKind,
      workflow: rule.workflow,
      sourceId: rule.sourceId,
      reference: rule.reference,
      ...rule.evaluate(evidence),
    }));
}