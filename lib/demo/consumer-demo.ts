/**
 * Clearly SYNTHETIC demo cases for the Consumer Grievance workflow.
 *
 * Contains no real personal information. Every value is invented for
 * demonstration and testing only.
 *
 * - CASE N1: NCH consumer grievance, all intake fields present -> READY
 *   (route chosen, all 4 intake checks pass, e-Jagriti affidavit rule
 *   does not apply, NCH-DOCS-001 passes, CONSUMER-ROUTE-001 passes).
 * - CASE N2: NCH consumer grievance missing purchase evidence -> BLOCKED.
 * - CASE E1: e-Jagriti complaint with affidavit provided + all intake
 *   fields -> READY (route chosen, intake passes, affidavit rule passes).
 * - CASE E2: e-Jagriti complaint with affidavit missing -> BLOCKED
 *   (CONSUMER-EJAGRITI-AFFIDAVIT-001 fails).
 * - CASE G: ambiguous consumer problem -> HUMAN_REVIEW (guard downgrades).
 * - CASE H: a clear cyber financial fraud description routed through
 *   consumer_grievance selection -> still goes to cyber workflow
 *   (consumer guard does not steal cyber cases).
 */

import type { EvidenceRecord } from "../types/civictrail";

/** NCH route explicitly requested (demonstrates route choice). */
export const NCH_ROUTE: EvidenceRecord["consumerRouteRequested"] =
  "nch_grievance";

/** e-Jagriti route explicitly requested. */
export const EJAGRITI_ROUTE: EvidenceRecord["consumerRouteRequested"] =
  "e_jagriti_complaint";

/* ------------------------------------------------------------------ */
/* CASE N1 - NCH consumer grievance, all intake fields present.
 * Expected: READY - all 4 intake checks pass, route chosen (NCH),
 * affidavit rule does not apply, NCH-DOCS-001 passes.
 * ------------------------------------------------------------------ */
export const CASE_N1_EVIDENCE: EvidenceRecord = {
  problemDescription:
    "The online grocery store delivered a damaged appliance and the seller is refusing a replacement under the promised warranty.",
  sellerOrProvider: "Demo online grocery store VendorDemo",
  purchaseEvidence: "Demo order #ORD-7721, delivery receipt available",
  paymentEvidence: "Demo UPI payment ref P-2026-09-1918",
  consumerRouteRequested: NCH_ROUTE,
};

/* ------------------------------------------------------------------ */
/* CASE N2 - NCH consumer grievance with purchase evidence MISSING.
 * Expected: BLOCKED (CONSUMER-INTAKE-003 fails).
 * ------------------------------------------------------------------ */
export const CASE_N2_EVIDENCE: EvidenceRecord = {
  ...CASE_N1_EVIDENCE,
  purchaseEvidence: undefined,
};

/* ------------------------------------------------------------------ */
/* CASE E1 - e-Jagriti complaint, affidavit PROVIDED + all intake.
 * Expected: READY - route chosen, intake passes, affidavit rule passes.
 * ------------------------------------------------------------------ */
export const CASE_E1_EVIDENCE: EvidenceRecord = {
  problemDescription:
    "A service provider performed defective electrical work and the billing invoice was not corrected despite repeated requests.",
  sellerOrProvider: "Demo electrical services provider ServiceFix Co",
  purchaseEvidence: "Demo invoice INV-3312, dated 2026-09-12",
  paymentEvidence: "Demo bank transfer ref BK-2026-09-903",
  consumerRouteRequested: EJAGRITI_ROUTE,
  notarizedAffidavit:
    "Demo: signed notarized affidavit prepared and available as required before filing before the Consumer Commission.",
};

/* ------------------------------------------------------------------ */
/* CASE E2 - e-Jagriti complaint, affidavit MISSING.
 * Expected: BLOCKED (CONSUMER-EJAGRITI-AFFIDAVIT-001 fails).
 * ------------------------------------------------------------------ */
export const CASE_E2_EVIDENCE: EvidenceRecord = {
  ...CASE_E1_EVIDENCE,
  notarizedAffidavit: undefined,
};

/* ------------------------------------------------------------------ */
/* CASE G - ambiguous consumer problem (no strong signals).
 * Expected: HUMAN_REVIEW (guard downgrades to unknown).
 * ------------------------------------------------------------------ */
export const CASE_G_DESCRIPTION =
  "I bought something recently and there is a problem I want sorted.";

/* ------------------------------------------------------------------ */
/* CASE H - clear cyber financial fraud description, but user
 * selects consumer_grievance in the form. The guard must still
 * route it to cyber (cyber takes precedence).
 * Expected: cyber_financial_fraud workflow, READY with cyber checks.
 * ------------------------------------------------------------------ */
export const CASE_H_DESCRIPTION =
  "Someone stole money from my account using an OTP scam and I want to report the online fraud.";

export const CASE_H_EVIDENCE: EvidenceRecord = {
  ...CASE_N1_EVIDENCE, // fill intake fields so they don't block (won't be evaluated for cyber)
  incidentDateTime: "2026-09-18 09:14 IST",
  incidentDetails:
    "An OTP-based fraud caller obtained account access and debited funds from the citizen's bank account before the citizen could block the transaction. The caller posed as a bank customer-care executive and asked for the one-time password sent to the citizen's registered mobile number, and the debit happened immediately after that code was shared.",
  identityDocument: "Demo identity metadata: government photo ID available.",
  bankWalletMerchant:
    "Demo bank DemoBank, fraud amount debited to unknown account.",
  transactionId: "987654321098", // synthetic 12-digit
  transactionDate: "2026-09-18",
  fraudAmount: "15000",
  supportingEvidence: "Demo: OTP log screenshot available.",
};
