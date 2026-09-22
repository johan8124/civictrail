/**
 * CivicTrail official source registry.
 *
 * CRITICAL SOURCE RULE: this registry contains ONLY the facts that were
 * explicitly verified from the official sources listed below. Nothing is
 * invented here: no laws, deadlines, fees, eligibility rules, procedures,
 * API endpoints or guarantees.
 *
 * Any fact that has not been verified must be represented as UNKNOWN
 * elsewhere in the product — never as a plausible guess.
 */
import type { OfficialSource, SourceCategory } from "../types/civictrail";

export const NATIONAL_CONSUMER_HELPLINE: OfficialSource = {
  sourceId: "national-consumer-helpline",
  name: "National Consumer Helpline (NCH)",
  category: "consumer_grievance",
  jurisdiction: "India",
  officialUrl: "https://consumerhelpline.gov.in/",
  verifiedFacts: [
    "NCH is a consumer grievance mechanism.",
    "Consumers can register grievances through the official portal and other official channels.",
    "NCH is described by the Department of Consumer Affairs as a pre-litigation alternate dispute resolution mechanism.",
  ],
  sourceStatus: "verified",
  officialReferences: ["https://consumerhelpline.gov.in/public/about"],
};

export const E_JAGRITI: OfficialSource = {
  sourceId: "e-jagriti",
  name: "e-Jagriti",
  category: "consumer_grievance",
  jurisdiction: "India",
  officialUrl: "https://e-jagriti.gov.in/",
  verifiedFacts: [
    "The platform supports online consumer complaint filing before Consumer Commissions.",
    "The official FAQ says consumers can file online complaints and upload necessary documents.",
  ],
  sourceStatus: "verified",
  officialReferences: ["https://e-jagriti.gov.in/faq"],
};

export const NATIONAL_CYBER_CRIME_PORTAL: OfficialSource = {
  sourceId: "national-cyber-crime-portal",
  name: "National Cyber Crime Reporting Portal",
  category: "cyber_financial_fraud",
  jurisdiction: "India",
  officialUrl: "https://www.cybercrime.gov.in/",
  verifiedFacts: [
    "For cyber financial fraud, the official portal instructs immediate reporting via 1930.",
    "The official complainant checklist asks for: incident date/time, incident details, identity document, bank/wallet/merchant, 12-digit transaction ID / UTR, transaction date, fraud amount, and relevant supporting evidence.",
  ],
  sourceStatus: "verified",
  officialReferences: [
    "https://www.cybercrime.gov.in/Accept.aspx",
    "https://www.cybercrime.gov.in/Webform/Crime_AuthoLogin.aspx",
  ],
};

export const CYBER_HELPLINE_1930: OfficialSource = {
  sourceId: "cyber-helpline-1930",
  name: "1930 cyber financial fraud reporting helpline",
  category: "cyber_financial_fraud",
  jurisdiction: "India",
  officialUrl: "https://www.cybercrime.gov.in/",
  verifiedFacts: [
    "1930 is the cyber financial fraud reporting channel associated with the National Cyber Crime Reporting Portal.",
    "The official portal instructs immediate reporting of cyber financial fraud via 1930.",
  ],
  sourceStatus: "verified",
  officialReferences: ["https://www.cybercrime.gov.in/Accept.aspx"],
};

/** All registry entries. Only sources with explicitly verified facts. */
export const OFFICIAL_SOURCES: readonly OfficialSource[] = [
  NATIONAL_CONSUMER_HELPLINE,
  E_JAGRITI,
  NATIONAL_CYBER_CRIME_PORTAL,
  CYBER_HELPLINE_1930,
];

export function getSourcesByCategory(category: SourceCategory): OfficialSource[] {
  return OFFICIAL_SOURCES.filter((source) => source.category === category);
}
