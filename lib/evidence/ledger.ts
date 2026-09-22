/**
 * Evidence Ledger.
 *
 * Every important check performed by CivicTrail becomes a ledger entry.
 * The ledger is append-only within a triage run and is a core product
 * feature: it makes each claim auditable down to its source and rule.
 */
import type {
  LedgerEntry,
  LedgerStatus,
  ReadinessResult,
  RuleResult,
} from "../types/civictrail";
import { OFFICIAL_SOURCES } from "../source-registry/registry";

const DISCLAIMER_REF = "CivicTrail safety policy";

/**
 * Resolve the human-readable source label for a rule result.
 * Official-checklist rules must reference the verified official source
 * (e.g. the National Cyber Crime Reporting Portal) by name and URL.
 */
function sourceLabelForRule(rule: RuleResult): string {
  if (rule.requirementKind !== "official_checklist") {
    return "civictrail_intake_requirement";
  }
  const source = OFFICIAL_SOURCES.find((s) => s.sourceId === rule.sourceId);
  if (!source) return rule.sourceId ?? "official-source";
  return `${source.name} (${source.officialUrl})`;
}

export function createLedgerEntry(
  entry: Omit<LedgerEntry, "timestamp"> & { timestamp?: string },
): LedgerEntry {
  return {
    timestamp: new Date().toISOString(),
    ...entry,
  };
}

/** Convert a deterministic rule result into a ledger entry. */
export function ledgerEntryFromRule(rule: RuleResult): LedgerEntry {
  const status: LedgerStatus = rule.status;
  return createLedgerEntry({
    id: `ledger_${rule.ruleId}`,
    claim: `${rule.description}`,
    evidence: rule.evidence,
    source: sourceLabelForRule(rule),
    ruleId: rule.ruleId,
    status,
    confidence: rule.confidence,
    reference: rule.reference,
  });
}

export interface LedgerRuleGroup {
  entries: LedgerEntry[];
}

/** Build the full ledger for a triage run. */
export function buildLedger(input: {
  classification: {
    claim: string;
    evidence: string;
    confidence: number;
    determinationSource: string;
  } | null;
  route: { claim: string; evidence: string; sourceId: string; reference: string } | null;
  ruleResults: RuleResult[];
}): LedgerRuleGroup["entries"] {
  const entries: LedgerEntry[] = [];

  if (input.classification) {
    entries.push(
      createLedgerEntry({
        id: "ledger_classification",
        claim: input.classification.claim,
        evidence: input.classification.evidence,
        source: `CivicTrail agent (${input.classification.determinationSource})`,
        ruleId: null,
        status: "info",
        confidence: input.classification.confidence,
        reference: "CivicTrail classify_issue tool",
      }),
    );
  }

  if (input.route) {
    entries.push(
      createLedgerEntry({
        id: "ledger_route",
        claim: input.route.claim,
        evidence: input.route.evidence,
        source: input.route.sourceId,
        ruleId: null,
        status: "info",
        confidence: 0.99,
        reference: input.route.reference,
      }),
    );
  }

  for (const rule of input.ruleResults) {
    entries.push(ledgerEntryFromRule(rule));
  }

  return entries;
}

/**
 * Roll the ledger up into a summary used in the UI.
 * Note: this never changes readiness — it only summarises it.
 */
export function summarizeLedger(entries: LedgerEntry[]): ReadinessResult["ledger"] {
  return entries;
}

export const LEDGER_DISCLAIMER_REFERENCE = DISCLAIMER_REF;
