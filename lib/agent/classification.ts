/**
 * Workflow resolution helpers (deterministic where possible) plus the
 * Phase 2 CONSERVATIVE CLASSIFICATION GUARD.
 *
 * GUARD CONTRACT (Rules.md §4):
 * - The Strands agent may only SUGGEST a workflow; agent confidence alone
 *   never authorizes routing.
 * - consumer_grievance is accepted only when strong explicit product-level
 *   signals support a consumer transaction/problem involving a seller,
 *   provider, goods or services.
 * - cyber_financial_fraud is accepted only when strong explicit signals
 *   support fraudulent/unauthorized financial activity involving a
 *   transaction, payment or account.
 * - Unsupported or ambiguous descriptions deterministically resolve to
 *   "unknown" (readiness HUMAN_REVIEW).
 * - Empty or insufficient descriptions deterministically resolve to
 *   HUMAN_REVIEW.
 * - The guard is a pure function: deterministic, testable, and impossible
 *   for the LLM to override.
 */
import type {
  AgentClassification,
  ClassificationGuardOutcome,
  RuleResult,
  TriageRequest,
  WorkflowId,
} from "../types/civictrail";
import type { AgentRunCollector } from "./agent-tools";

/** Descriptions shorter than this are treated as empty/insufficient. */
export const MIN_DESCRIPTION_CHARS = 10;

/* ------------------------------------------------------------------ */
/* Strong explicit signal sets (documented, deterministic)             */
/* ------------------------------------------------------------------ */

/** Fraudulent / unauthorized activity signals. */
const CYBER_FRAUD_SIGNALS: readonly RegExp[] = [
  /fraud/i,
  /scam/i,
  /cheat/i,
  /deceiv/i,
  /swindle/i,
  /unauthori[sz]ed/i,
  /without (my |the |any )?(permission|consent|authori[sz]ation|knowledge|approval)/i,
  /hacked/i,
  /phish/i,
  /vishing/i,
  /\botp\b/i,
  /sextortion/i,
  /blackmail/i,
  /impersonat/i,
  /fake (call|customer ?care|website|link|app|invoice|sms|profile)/i,
  /stolen/i,
  /siphon/i,
];

/** Financial-transaction / payment / account involvement signals. */
const CYBER_FINANCIAL_SIGNALS: readonly RegExp[] = [
  /\btransactions?\b/i,
  /\bpayments?\b/i,
  /\bpaid\b/i,
  /\bdebit(ed)?\b/i,
  /\bdeduct(ed)?\b/i,
  /\btransfer(red|ed)?\b/i,
  /\butr\b/i,
  /\bupi\b/i,
  /\bbank\b/i,
  /\baccounts?\b/i,
  /\bwallets?\b/i,
  /\bcards?\b/i,
  /net ?banking/i,
  /\bmoney\b/i,
  /\bamount\b/i,
];

/** Seller / provider / goods / services involvement signals. */
const CONSUMER_PROVIDER_SIGNALS: readonly RegExp[] = [
  /\bsellers?\b/i,
  /\bvendors?\b/i,
  /\bproviders?\b/i,
  /\bshops?\b/i,
  /\bstores?\b/i,
  /\bcompany\b/i,
  /e-?commerce/i,
  /service (provider|centre|center)/i,
  /\bgoods\b/i,
  /\bonline (shop|store|seller)\b/i,
];

/** Product-level transaction / problem signals. */
const CONSUMER_PRODUCT_PROBLEM_SIGNALS: readonly RegExp[] = [
  /\borders?\b/i,
  /\bordered\b/i,
  /purchas/i,
  /\bbought\b/i,
  /\bbuy\b/i,
  /deliver/i,
  /defective/i,
  /damaged/i,
  /faulty/i,
  /broken/i,
  /warranty/i,
  /guarantee/i,
  /refund/i,
  /\breturns?\b/i,
  /\breturned\b/i,
  /replacem/i,
  /\brepair/i,
  /subscription/i,
  /\binvoices?\b/i,
  /\bbill(ed|ing)?\b/i,
  /\bprice\b/i,
];

export function hasStrongCyberFinancialSignals(text: string): boolean {
  const fraud = CYBER_FRAUD_SIGNALS.some((re) => re.test(text));
  const financial = CYBER_FINANCIAL_SIGNALS.some((re) => re.test(text));
  return fraud && financial;
}

export function hasStrongConsumerSignals(text: string): boolean {
  const provider = CONSUMER_PROVIDER_SIGNALS.some((re) => re.test(text));
  const problem = CONSUMER_PRODUCT_PROBLEM_SIGNALS.some((re) => re.test(text));
  return provider && problem;
}

/* ------------------------------------------------------------------ */
/* Deterministic keyword fallback (agent-unavailable path)             */
/* ------------------------------------------------------------------ */

/** Deterministic keyword fallback if the agent fails to classify. */
const CYBER_KEYWORDS = [
  "fraud", "scam", "unauthori", "otp", "upi", "phishing", "hacked", "debit",
  "transaction", "money transferred", "blackmail", "sextortion", "wallet",
  "fake call", "bank transfer", "cyber",
];

const CONSUMER_KEYWORDS = [
  "refund", "defective", "warranty", "seller", "order", "delivery",
  "subscription", "product", "service provider", "billing", "e-commerce", "purchase",
];

export function keywordFallbackClassify(description: string): WorkflowId {
  const text = description.toLowerCase();
  const cyber = CYBER_KEYWORDS.some((k) => text.includes(k));
  const consumer = CONSUMER_KEYWORDS.some((k) => text.includes(k));
  if (cyber && !consumer) return "cyber_financial_fraud";
  if (consumer && !cyber) return "consumer_grievance";
  return "unknown";
}

/** Review finding when no supported workflow could be resolved. */
export function unclassifiedReviewFinding(evidenceNote: string): RuleResult {
  return {
    ruleId: "GENERAL-CLASSIFICATION-001",
    description: "Problem classified into a supported CivicTrail workflow",
    status: "review",
    evidence: evidenceNote,
    confidence: 1,
    requirementKind: "civictrail_intake_requirement",
    reference: "CivicTrail triage: unsupported or unknown classification",
  };
}

/* ------------------------------------------------------------------ */
/* Conservative classification guard (deterministic authority)          */
/* ------------------------------------------------------------------ */

export function applyClassificationGuard(input: {
  description: string;
  suggestedWorkflow: WorkflowId;
  classification: AgentClassification | null;
}): { workflow: WorkflowId; guard: ClassificationGuardOutcome } {
  const { description, suggestedWorkflow } = input;

  function downgraded(reason: string): { workflow: WorkflowId; guard: ClassificationGuardOutcome } {
    return {
      workflow: "unknown",
      guard: {
        suggestedWorkflow,
        resolvedWorkflow: "unknown",
        outcome: "downgraded_to_unknown",
        reason,
      },
    };
  }

  function accepted(
    workflow: "cyber_financial_fraud" | "consumer_grievance",
    reason: string,
  ): { workflow: WorkflowId; guard: ClassificationGuardOutcome } {
    return {
      workflow,
      guard: {
        suggestedWorkflow,
        resolvedWorkflow: workflow,
        outcome: "accepted",
        reason,
      },
    };
  }

  // Empty or insufficient descriptions can never carry strong signals.
  const trimmed = description.trim();
  if (trimmed.length < MIN_DESCRIPTION_CHARS) {
    return downgraded(
      "Empty or insufficient problem description — strong explicit signals are required before any supported workflow can be routed.",
    );
  }

  const cyber = hasStrongCyberFinancialSignals(description);
  // A description with strong cyber-fraud signals is not treated as a plain
  // consumer grievance; the two classifications are mutually exclusive.
  const consumer = !cyber && hasStrongConsumerSignals(description);

  if (suggestedWorkflow === "cyber_financial_fraud") {
    if (cyber) {
      return accepted(
        "cyber_financial_fraud",
        "Strong explicit signals of fraudulent or unauthorized financial activity involving a transaction, payment or account support the classification.",
      );
    }
    return downgraded(
      "No strong explicit signals of fraudulent or unauthorized financial activity involving a transaction, payment or account were found in the description; the agent suggestion and its confidence are not sufficient on their own.",
    );
  }

  if (suggestedWorkflow === "consumer_grievance") {
    // Cyber financial fraud takes precedence: if the description carries strong
    // cyber signals, the case must route to the cyber workflow regardless of the
    // user's consumer selection — Consumer logic must not steal cyber cases.
    if (cyber) {
      return accepted(
        "cyber_financial_fraud",
        "Strong explicit signals of fraudulent or unauthorized financial activity involving a transaction, payment or account take precedence over the consumer selection.",
      );
    }
    if (consumer) {
      return accepted(
        "consumer_grievance",
        "Strong explicit product-level signals of a consumer transaction or problem involving a seller, provider, goods or services support the classification.",
      );
    }
    return downgraded(
      "No strong explicit product-level signals of a consumer transaction or problem involving a seller, provider, goods or services were found in the description; the agent suggestion and its confidence are not sufficient on their own.",
    );
  }

  return downgraded(
    "Suggested workflow was already unknown; no supported workflow can be assigned without strong explicit signals.",
  );
}

export function resolveWorkflow(
  request: TriageRequest,
  collector: AgentRunCollector | null,
): { classification: AgentClassification | null; workflow: WorkflowId } {
  if (request.workflow !== "auto") {
    return {
      workflow: request.workflow,
      classification: {
        workflow: request.workflow,
        confidence: 1,
        rationale: "Workflow selected by the user in the CivicTrail intake form.",
        determinationSource: "user_selection",
      },
    };
  }

  const agentClassification = collector?.classification;
  if (agentClassification) {
    return { workflow: agentClassification.workflow, classification: agentClassification };
  }

  // Deterministic fallback when the agent produced no classification.
  const fallback = keywordFallbackClassify(request.description);
  return {
    workflow: fallback,
    classification: {
      workflow: fallback,
      confidence: fallback === "unknown" ? 0.3 : 0.6,
      rationale: "Deterministic keyword fallback classification (agent classification unavailable).",
      determinationSource: "keyword_fallback",
    },
  };
}
