# CivicTrail Rules and Guardrails

## 1. Legal/civic safety
Never represent CivicTrail as:
- an AI lawyer;
- a lawyer replacement;
- legal representation;
- an authority that determines legal rights;
- a guarantee of legal/government outcomes.

Use informational/workflow-assistance wording.

## 2. Source truth
A claim may drive authoritative product logic only when it is supported by a verified official source recorded in Sources.md.

Never invent:
- laws;
- legal conclusions;
- filing requirements;
- deadlines;
- fees;
- eligibility rules;
- jurisdiction rules;
- government APIs;
- government integration capabilities;
- guaranteed outcomes.

Unknown means UNKNOWN.

## 3. AI authority
Correct:
Agent suggestion -> validation -> deterministic rules -> readiness

Wrong:
LLM says READY -> application says READY

## 4. Classification safety
Agent may suggest:
- consumer_grievance
- cyber_financial_fraud
- unknown

A deterministic guard must validate the suggestion.

Strong supported signals are required before assigning a supported workflow.

Ambiguous or unsupported cases -> HUMAN_REVIEW.

Agent confidence alone is never sufficient.

## 5. Government actions
Never:
- file a complaint automatically;
- submit a report automatically;
- impersonate a user;
- bypass CAPTCHA/OTP;
- automate government authentication;
- claim something was submitted when only a draft was prepared.

Human remains responsible for review/submission.

## 6. Evidence
Do not treat an LLM statement as evidence. Distinguish:
- user-provided evidence;
- official-source information;
- deterministic validation;
- LLM explanation.

## 7. Uploaded files
Treat uploads as hostile/untrusted.
Never execute them.
Validate type/size before processing.

## 8. Secrets
Never put GROQ_API_KEY in client code, print it, return it, or commit .env.local.

## 9. Dependencies
Before adding any dependency:
- justify it;
- check existing packages;
- check licensing/compatibility.

## 10. Scope
Do not add:
- auth;
- DB;
- vector DB;
- multi-agent swarm;
- unrestricted search;
- broad legal knowledge graph;
- automatic submission
unless a later approved phase explicitly requires it.

## 11. UX
The product must be understandable to non-lawyers.
Avoid chat-only design, dense developer dashboards, unexplained legal jargon, and decorative effects that obscure important information.

## 12. Evidence wording
Public evidence descriptions must match the actual source:
- GitHub inspection -> public GitHub repository
- local inspection -> local repository
- none -> no repository-inspection claim

## 13. Testing
At minimum:
- deterministic unit tests;
- READY;
- BLOCKED;
- HUMAN_REVIEW;
- malformed input;
- ambiguous classification;
- secret-safety check.

## 14. Demo
Synthetic information only. Never expose real identity/financial data, credentials, or secrets.

## 15. Change control
Do not alter PRD/Architecture/Rules casually. If architecture changes:
1. explain why;
2. update the relevant document;
3. update memory.md;
4. then implement.
