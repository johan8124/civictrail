# CivicTrail

**CivicTrail is an evidence-first AI workflow assistant that helps people reach the correct official legal/civic process and checks whether their action packet is ready.**

---

## The Problem

People often know something went wrong — a faulty product, a fraudulent transaction — but still do not know:

- which official process applies to their situation;
- what information and evidence they need;
- what is still missing from their case;
- how to turn scattered facts into an organized next action.

A generic chatbot can produce a confident-sounding paragraph. It cannot reliably bridge the gap between a messy real-world problem and an action-ready case — and it cannot show you *why* it reached its conclusion.

## The Core Workflow

```text
Problem
   ↓
Official Route
   ↓
Evidence Check
   ↓
Readiness
   ↓
Action Packet
   ↓
Human Confirmation
```

## Why CivicTrail

Generic AI assistants answer questions. CivicTrail is built around a different promise: **evidence-first action readiness**.

| Generic chatbot | CivicTrail |
|---|---|
| Produces prose that *sounds* authoritative | Produces a readiness result backed by deterministic checks |
| You cannot inspect why it said something | Every check is recorded in an inspectable Evidence Ledger |
| LLM output is treated as the answer | LLM prose is never treated as authoritative evidence |
| No clear next step | A structured Action Packet with explicit next actions |
| Decision made by the model | READY/BLOCKED authority owned by deterministic code, not the LLM |

CivicTrail is designed so it can say:

> **BLOCKED** — a specific piece of information/evidence is missing.

And after that item is supplied:

> **READY** — the defined checklist is complete.

The user can always inspect *why* the result occurred.

## What It Does

1. **Classifies the issue** — the Strands agent interprets the user's description and suggests a supported workflow.
2. **Identifies the official route** — maps the classified issue to a verified official channel.
3. **Inspects evidence** — typed tools check the user's facts against the verified official checklist.
4. **Determines readiness** — a deterministic rule engine (never the LLM) produces READY, BLOCKED, or HUMAN_REVIEW.
5. **Produces an Action Packet** — a structured, source-referenced draft of the next action.
6. **Keeps the final action under human control** — every packet requires explicit human confirmation. Nothing is ever submitted automatically.

## Supported MVP Workflows

### 🛡️ Cyber Financial Fraud

For people dealing with cyber financial fraud, CivicTrail:

- classifies the issue and identifies the official cybercrime route (National Cyber Crime Reporting Portal, with 1930 as the officially associated reporting channel);
- checks the case against the verified official portal checklist:
  - incident date and time;
  - incident details (minimum 200 characters, with prohibited-character validation);
  - identity document upload (JPEG/JPG/PNG, maximum 5 MB);
  - Bank / Wallet / Merchant payment channel;
  - 12-digit Transaction ID / UTR;
  - transaction date;
  - fraud amount;
  - supporting evidence (maximum 10 MB per file);
- produces an evidence-backed readiness result;
- generates an Action Packet for human review.

### 🧾 Consumer Grievance

For Indian consumers with unresolved product/service disputes, CivicTrail takes a deliberately conservative approach:

- routes to verified official sources only — the National Consumer Helpline (pre-litigation grievance redressal) and e-Jagriti (filing a complaint before a Consumer Commission);
- provides evidence assistance without overstating requirements: intake checks are **not** presented as universal legal requirements unless an official source supports them;
- where the official source does not state a requirement (for example, the full per-case-type document checklist for e-Jagriti), CivicTrail treats it as UNKNOWN rather than inventing one.

## How It Works

CivicTrail separates *investigation* from *verification*. The AI agent investigates; deterministic code verifies; the Evidence Ledger shows the proof; a human decides when uncertainty remains.

```text
User
  |
  v
Next.js Web App
  |
  v
POST /api/triage  (Zod input validation, secrets server-side)
  |
  v
Strands Agent
  |
  +--> classify_issue
  +--> lookup_official_route
  +--> inspect_evidence
  +--> validate_action_packet
  |
  v
Deterministic Rule Engine   (never calls an LLM)
  |
  +--> pass / fail / review
  |
  v
Evidence Ledger
  |
  v
READY / BLOCKED / HUMAN_REVIEW
  |
  v
Action Packet
  |
  v
Human Confirmation
```

**Responsibility boundaries:**

| Component | Responsibility |
|---|---|
| Strands Agent | Interprets descriptions, classifies likely workflows, calls typed tools, reasons from tool observations, explains verified results. Does **not** own final readiness. |
| Deterministic Rule Engine | Validates explicit structured requirements and produces pass/fail/review. Never calls an LLM. |
| Official Source Registry | Holds verified official sources and verified facts used for routing and authoritative checks. |
| Evidence Ledger | Links claims to evidence and rules, preserves source references, keeps passing and failing evidence. |
| Action Packet | A structured draft for human review. Never automatically submitted. |

## Evidence-First Design

The LLM does not own READY/BLOCKED decisions — by architecture, not by prompt etiquette.

- The agent's suggestion is only a *suggestion*. A deterministic guard validates every classification before it can drive product logic, and strong supported signals are required before a workflow is assigned.
- Agent confidence alone is never sufficient. Ambiguous or unsupported cases go to HUMAN_REVIEW.
- An LLM statement is never treated as evidence. CivicTrail distinguishes between user-provided evidence, official-source information, deterministic validation, and LLM explanation — and only the first three can support a readiness result.
- The rule engine never calls an LLM. Given the same structured input, it always produces the same result.

This is what makes the readiness result auditable: a reviewer can trace every READY or BLOCKED outcome back to explicit rules and recorded evidence, not to model confidence.

## Readiness States

| State | Meaning |
|---|---|
| **READY** | The defined checklist is complete. The Action Packet is prepared for human review. |
| **BLOCKED** | A specific piece of required information or evidence is missing. The ledger names exactly what. |
| **HUMAN_REVIEW** | The case is ambiguous, unsupported, or otherwise uncertain. A deterministic rule alone cannot resolve it, so a human decides. |

## Evidence Ledger

Every important verification is recorded with:

| Field | Purpose |
|---|---|
| claim | What is being verified |
| evidence | The supporting (or failing) evidence |
| official/source reference | Where the requirement comes from |
| rule | The deterministic rule applied |
| status | Pass / fail |
| confidence | Verification confidence |
| timestamp | When it was recorded |

The ledger keeps both passing **and** failing evidence. This matters because a BLOCKED result is only useful if the user can see precisely which claim failed, against which rule, from which official source — and confirm that supplying the missing item changes the result.

## Action Packet

The Action Packet is the structured output of a completed workflow. It contains:

- issue summary;
- official route;
- evidence index;
- source references;
- readiness status;
- next actions;
- an informational disclaimer;
- `requiresHumanConfirmation: true`.

**Submission is never automatic.** CivicTrail does not file complaints, submit reports, impersonate users, or interact with government authentication on anyone's behalf. The packet is a preparation artifact — the human remains responsible for review and submission.

## Safety and Boundaries

CivicTrail is informational decision-support and workflow assistance. It is **not**:

- a lawyer;
- legal representation;
- an authority that determines legal rights;
- a guarantee of any legal or government outcome;
- a replacement for official instructions;
- an automatic filing service.

Additional boundaries enforced in the product:

- **Source truth:** a claim may drive authoritative product logic only when supported by a verified official source. Laws, legal conclusions, filing requirements, deadlines, fees, eligibility and jurisdiction rules are never invented. Unknown means UNKNOWN.
- **AI authority:** the agent suggests; deterministic rules verify and decide readiness. "The LLM said so" is never a reason.
- **Government actions:** no automatic filing, no automatic submission, no CAPTCHA/OTP bypass, no claims that a draft was submitted.
- **Uploads:** treated as untrusted. Never executed. Type and size validated before processing.
- **Secrets:** the API key is server-side only — never in client code, never printed, never returned in responses, never committed.
- **Demo data:** synthetic information only. No real identity or financial data.

## Official Sources

CivicTrail routes to these verified official sources only:

| Source | Role | Official URL |
|---|---|---|
| National Cyber Crime Reporting Portal | Official reporting route for cyber financial fraud | [cybercrime.gov.in](https://www.cybercrime.gov.in/) |
| National Consumer Helpline | Pre-litigation consumer grievance redressal (Department of Consumer Affairs) | [consumerhelpline.gov.in](https://consumerhelpline.gov.in/) |
| e-Jagriti | Official platform for filing a complaint before a Consumer Commission | [e-jagriti.gov.in](https://e-jagriti.gov.in/) |

No third-party website is used as an authoritative source. Where an official source does not state a fact, CivicTrail treats it as UNKNOWN.

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js](https://nextjs.org) 16.3.5 | Web app and server API |
| [React](https://react.dev) 19 | UI |
| [TypeScript](https://www.typescriptlang.org) | Type safety across the workflow |
| [Tailwind CSS](https://tailwindcss.com) 4 | Styling |
| [Strands Agents SDK](https://github.com/strands-agents) 1.18.0 | Agent orchestration and typed tool calling |
| [OpenAI SDK](https://github.com/openai/openai-node) | Model provider client (Groq-compatible endpoint) |
| [Zod](https://zod.dev) | Input validation at the API boundary |

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/johan8124/civictrail.git

# 2. Enter the directory
cd civictrail

# 3. Install dependencies
npm install

# 4. Create the environment file
#    (create a file named .env.local in the project root)

# 5. Provide the required key in .env.local:
GROQ_API_KEY=your-key-here

# 6. Optionally specify a model in .env.local:
GROQ_MODEL=your-model-name

# 7. Run the development server
npm run dev
```

**Note:** `GROQ_API_KEY` is used server-side only. It is never included in client code, API responses, or the repository. Do not commit `.env.local`.

## Testing

```bash
npm test            # deterministic, phase 2, phase 3, and hermetic agent tests
npx tsc --noEmit    # type check
npm run lint        # ESLint
npm run build       # production build
```

Validation snapshot at the time of this README: **63/63 tests passing**, with TypeScript, ESLint, and the production build all passing. This is a point-in-time validation result for the current MVP, not a permanent guarantee.

## Project Structure

```text
app/          Next.js app (UI, components, /api/triage)
lib/          Business logic (agent, rules, evidence, readiness,
              routes, source-registry, action-packet, types)
tests/        Deterministic, phase, and agent reliability tests
PRD.md            Product requirements
Architecture.md   System architecture
Rules.md          Safety rules and guardrails
Sources.md        Verified official sources
Design.md         Design system
Phases.md         Build phases
```

## Documentation

- [PRD.md](PRD.md) — product requirements and scope
- [Architecture.md](Architecture.md) — system architecture and data flow
- [Rules.md](Rules.md) — safety rules and guardrails
- [Sources.md](Sources.md) — verified official sources and their exact supported facts
- [Design.md](Design.md) — design system
- [Phases.md](Phases.md) — build phases

## Project Status

CivicTrail is an **MVP / prototype** built for evaluation and demonstration. It is not a production legal service, not affiliated with any government body, and not a substitute for official portals or professional advice. Scope, workflows, and safety boundaries are documented in [PRD.md](PRD.md) and [Rules.md](Rules.md).

## Demo

- [Live Demo](https://civictrail.vercel.app)
- [Demo Video](INSERT_DEMO_VIDEO_URL)

## Disclaimer

CivicTrail is an informational decision-support and workflow-assistance tool. It is not a lawyer and does not provide legal representation, advice, or guarantees of outcome. It does not replace official government portals or authorities, and it never submits anything on a user's behalf. All output requires human review and confirmation before any action is taken. LLM-generated explanations within CivicTrail are not authoritative evidence.

## License

No license has been added to this repository yet. The absence of a license means default copyright protections apply; the project should not be assumed to be open source until a license file is added.
