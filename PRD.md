# CivicTrail Product Requirements Document

## Product
**Name:** CivicTrail

**One-line pitch:** An evidence-first AI agent that helps people reach the correct official legal/civic process and checks whether their action packet is ready.

## Problem
A person may know that something went wrong but still not know:
- which official process applies;
- what information is needed;
- what evidence they should collect;
- what is still missing;
- how to turn their facts into an organized action packet.

Generic legal chatbots can answer questions but do not reliably bridge the gap between a messy real-world problem and an action-ready case.

## Target users
Primary MVP:
- Indian consumers with unresolved product/service disputes.
- People dealing with cyber financial fraud.

## Product promise
Problem -> Official route -> Evidence check -> Readiness -> Action Packet

CivicTrail must not claim to replace lawyers, legal professionals, government portals, or official authorities.

## MVP workflows

### A. Cyber financial fraud
1. classify the issue;
2. identify the official cybercrime route;
3. check the verified official checklist;
4. create an evidence-backed readiness result;
5. generate an Action Packet for human review.

Possible outcomes:
- READY
- BLOCKED
- HUMAN_REVIEW

### B. Consumer grievance
Provide conservative intake and routing based only on verified sources. Product-level intake checks must not be presented as universal legal requirements unless an official source supports them.

## Signature feature
### Evidence-First Action Readiness
CivicTrail should be able to say:
> BLOCKED: a specific piece of information/evidence is missing.

After the missing item is supplied:
> READY: the defined checklist is complete.

The user must be able to inspect why the result occurred.

## Evidence Ledger
Each important verification records:
- claim
- evidence
- official/source reference
- rule
- status
- confidence
- timestamp

## Action Packet
Contains:
- issue summary
- official route
- evidence index
- source references
- readiness status
- next actions
- informational disclaimer
- requiresHumanConfirmation: true

It must never automatically submit to a government system.

## Safety
CivicTrail is informational decision-support and workflow assistance. It is not:
- a lawyer;
- legal representation;
- a guarantee of outcome;
- a replacement for official instructions;
- an automatic filing service.

## User experience
1. Tell us what happened
2. Identify the route
3. Check your evidence
4. Explain what is missing
5. Show READY / BLOCKED / HUMAN_REVIEW
6. Review an Action Packet

Avoid a chat-first interface.

## Success criteria
A judge can see:
1. A synthetic cyber-fraud case becomes BLOCKED because a defined official checklist condition is missing.
2. The missing condition appears in the Evidence Ledger.
3. Supplying it changes the deterministic result to READY.
4. The agent actually uses Strands tools.
5. An ambiguous/unsupported case goes to HUMAN_REVIEW.
6. The Action Packet remains subject to human confirmation.

## Out of scope
- Automatic government filing
- Broad legal advice
- Full case management
- Lawyer replacement
- Unrestricted legal web search
- Ten+ workflows
- Authentication
- Persistent database
- Vector database
- Multi-agent swarm
- Payments
