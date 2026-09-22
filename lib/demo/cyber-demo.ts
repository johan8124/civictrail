/**
 * Clearly SYNTHETIC demo cases for the cyber financial fraud workflow.
 *
 * Contains no real personal information. Every value is invented for
 * demonstration and testing only.
 *
 * Phase 2 synthetic cases:
 * - CASE A: clearly cyber financial fraud, all required fields valid -> READY
 * - CASE B: same case, transaction ID "12345" (not 12 digits) -> BLOCKED
 * - CASE C: same case, incident details under 200 characters -> BLOCKED
 * - CASE D: same case, incident details contain prohibited special characters -> BLOCKED
 * - CASE E: unsupported municipal-tax problem -> HUMAN_REVIEW
 * - CASE F: ambiguous / insufficient description -> HUMAN_REVIEW
 */
import type { EvidenceRecord } from "../types/civictrail";

/** CASE A / B / C / D description: strongly and explicitly cyber financial fraud. */
export const CASE_A_DESCRIPTION =
  "[SYNTHETIC DEMO - not a real case] I searched for a customer-care number online and called a fake support line. The caller asked me to approve a 'refund verification' on my payments app. I approved two collect requests and money was debited from my demo wallet to an unknown merchant. I realised it was a scam within minutes and want to report the online financial fraud.";

/** CASE A incident details: >= 200 characters, no prohibited special characters. */
const CASE_A_INCIDENT_DETAILS =
  "A caller posing as a customer-care executive was reached through a search result. The caller asked the citizen to approve a refund verification and two collect requests were approved on the payments app. Money was debited from the demo wallet to an unknown merchant before the citizen realised the call was a scam.";

/** CASE C incident details: present but under 200 characters. */
const CASE_C_INCIDENT_DETAILS =
  "A fake customer-care caller asked for a refund verification and two collect requests were approved on the payments app before the citizen realised it was a scam.";

/** CASE D incident details: >= 200 characters and contains a prohibited character (%). */
const CASE_D_INCIDENT_DETAILS =
  "A caller posing as a customer-care executive was reached through a search result. The caller asked the citizen to approve a refund verification and two collect requests were approved on the payments app. 100% of the debited wallet amount went to an unknown merchant before the citizen realised the call was a scam.";

/** CASE A: clearly cyber financial fraud, all required fields valid -> READY. */
export const CASE_A_EVIDENCE: EvidenceRecord = {
  incidentDateTime: "2026-09-10 14:32 IST",
  incidentDetails: CASE_A_INCIDENT_DETAILS,
  identityDocument: "Demo identity metadata: government photo ID available (type not shown).",
  bankWalletMerchant: "Demo wallet provider PayDemo Wallet, merchant listed as unknown merchant.",
  transactionId: "123456789012", // synthetic 12-digit demo value
  transactionDate: "2026-09-10",
  fraudAmount: "24999",
  supportingEvidence: "Demo placeholder: screenshots of the fake support chat are available.",
};

/** CASE B: same case, transaction ID is "12345" -> BLOCKED (UTR rule). */
export const CASE_B_EVIDENCE: EvidenceRecord = {
  ...CASE_A_EVIDENCE,
  transactionId: "12345",
};

/** CASE C: same case, incident details under 200 characters -> BLOCKED. */
export const CASE_C_EVIDENCE: EvidenceRecord = {
  ...CASE_A_EVIDENCE,
  incidentDetails: CASE_C_INCIDENT_DETAILS,
};

/** CASE D: same case, incident details contain prohibited special characters -> BLOCKED. */
export const CASE_D_EVIDENCE: EvidenceRecord = {
  ...CASE_A_EVIDENCE,
  incidentDetails: CASE_D_INCIDENT_DETAILS,
};

/** CASE E: unsupported municipal-tax problem -> HUMAN_REVIEW. */
export const CASE_E_DESCRIPTION =
  "The municipal corporation has billed the wrong property tax amount on my family plot and I want the assessment corrected.";

/** CASE F: ambiguous / insufficient description -> HUMAN_REVIEW. */
export const CASE_F_DESCRIPTION =
  "Something went wrong and I need help sorting it out.";

/* ------------------------------------------------------------------ */
/* Backward-compatible aliases used by the Phase 1 UI and tests         */
/* ------------------------------------------------------------------ */

export const DEMO_DESCRIPTION = CASE_A_DESCRIPTION;
export const DEMO_CYBER_EVIDENCE_READY = CASE_A_EVIDENCE;
export const DEMO_CYBER_EVIDENCE_BLOCKED = CASE_B_EVIDENCE;
