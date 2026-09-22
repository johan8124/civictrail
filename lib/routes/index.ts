/**
 * Official routes per workflow.
 *
 * Every route is assembled exclusively from verified facts in the source
 * registry. Nothing here may claim eligibility, deadlines, fees, or legal
 * conclusions.
 */
import type { ImplementedWorkflowId, OfficialRoute } from "../types/civictrail";
import {
  E_JAGRITI,
  NATIONAL_CONSUMER_HELPLINE,
  NATIONAL_CYBER_CRIME_PORTAL,
  CYBER_HELPLINE_1930,
  getSourcesByCategory,
} from "../source-registry";

export const CONSUMER_ROUTE: OfficialRoute = {
  routeId: "route-consumer-grievance",
  workflow: "consumer_grievance",
  label: "Consumer grievance",
  jurisdiction: "India",
  verifiedGuidance: [
    "The National Consumer Helpline is a consumer grievance mechanism run by the Department of Consumer Affairs, Government of India.",
    "The Department of Consumer Affairs describes the National Consumer Helpline as a pre-litigation alternate dispute resolution mechanism.",
    "e-Jagriti supports online consumer complaint filing before Consumer Commissions; the official FAQ says consumers can file online complaints and upload necessary documents.",
  ],
  sources: [NATIONAL_CONSUMER_HELPLINE, E_JAGRITI],
};

export const CYBER_ROUTE: OfficialRoute = {
  routeId: "route-cyber-financial-fraud",
  workflow: "cyber_financial_fraud",
  label: "Cyber financial fraud",
  jurisdiction: "India",
  verifiedGuidance: [
    "For cyber financial fraud, the National Cyber Crime Reporting Portal instructs immediate reporting via 1930.",
    "The official complainant checklist on the portal asks for: incident date/time, incident details, identity document, bank/wallet/merchant, 12-digit transaction ID / UTR, transaction date, fraud amount, and relevant supporting evidence.",
  ],
  sources: [NATIONAL_CYBER_CRIME_PORTAL, CYBER_HELPLINE_1930],
};

export function getRouteForWorkflow(workflow: ImplementedWorkflowId): OfficialRoute {
  switch (workflow) {
    case "cyber_financial_fraud":
      return CYBER_ROUTE;
    case "consumer_grievance":
      return CONSUMER_ROUTE;
  }
}

export { getSourcesByCategory };
