# CivicTrail

### Evidence-first AI that turns messy civic and consumer problems into verified, action-ready workflows.

CivicTrail combines an AI triage agent with verified official routes and a deterministic evidence engine to help people understand **where to act, what evidence is missing, and whether their action packet is ready.**

> **AI investigates. Deterministic rules verify. Humans decide.**

[🚀 Live Demo](https://civictrail.vercel.app)
[🎥 Demo Video](https://youtu.be/dqyAe9PzKac)

## Why CivicTrail Is Different

Most AI assistants stop at an answer.

CivicTrail turns a real-world problem into an auditable workflow:

**Problem → Classification → Verified Official Route → Evidence Check → Deterministic Readiness → Action Packet → Human Confirmation**

The LLM does **not** control the final READY / BLOCKED / HUMAN_REVIEW decision.

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

The agent is built on the **Strands Agents SDK**. Its primary model provider is the native **Strands `GoogleModel`** using Google Gemini, integrated through **`@google/genai`**. Groq is kept only as a fallback for legacy-compatible configurations and is used only when `GEMINI_API_KEY` is not configured.

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
Strands Agent   (GoogleModel -> Google Gemini)
  |
  |  Required tool sequence — exact order:
  v
classify_issue
  |
  v
lookup_official_route
  |
  v
inspect_evidence
  |
  v
validate_action_packet
  |
  v
Deterministic Readiness Engine   (never calls an LLM; authoritative)
  |
  v
Evidence Ledger
  |
  v
READY / BLOCKED / HUMAN_REVIEW
  |
  v
Action Packet   (requiresHumanConfirmation: true)
  |
  v
Human Confirmation   — nothing is filed or submitted automatically
```

**Responsibility boundaries:**

| Component | Responsibility |
|---|---|
| Strands Agent | Interprets the case, classifies likely workflows, calls the typed tools in the required order, reasons from tool observations, explains verified results. Does **not** own readiness and cannot override it. |
| Deterministic Rule Engine | Validates explicit structured requirements and produces pass/fail/review. Never calls an LLM. |
| Official Source Registry | Holds verified official sources and verified facts used for routing and authoritative checks. |
| Evidence Ledger | Links claims to evidence and rules, preserves source references, keeps passing and failing evidence. |
| Action Packet | A structured draft for human review. Never automatically submitted. |

**Architecture guarantees:**

- **The agent interprets; typed tools act.** The agent reads the case description and calls four typed tools — `classify_issue` → `lookup_official_route` → `inspect_evidence` → `validate_action_packet` — in that exact order. Workflow and route data in the response come from recorded tool results, never from free-form model prose.
- **The deterministic engine remains authoritative for readiness.** `validate_action_packet` returns the READY / BLOCKED / HUMAN_REVIEW verdict, computed by deterministic rules that never call an LLM.
- **The agent cannot override readiness.** The readiness value used in the response is the one recorded by the tool; model prose cannot change, reinterpret, or supersede it.
- **Human confirmation is required before any action.** Every Action Packet carries `requiresHumanConfirmation: true`. CivicTrail does not file, submit, or send anything automatically.

## Evidence-First Design

The LLM does not own READY/BLOCKED decisions — by architecture, not by prompt etiquette.

The agent does not extract readiness evidence from free-form prose. Structured evidence is supplied through the intake schema and passed to deterministic validation.

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
| Google Gemini via Strands `GoogleModel` | Primary model provider (native Gemini GenerateContent API) |
| [@google/genai](https://github.com/googleapis/js-genai) 2.24.0 | Gemini integration used by the Strands GoogleModel provider |
| [Zod](https://zod.dev) | Input validation at the API boundary |
| [Vercel](https://vercel.com) | Hosting for the live demo |
| [OpenAI SDK](https://github.com/openai/openai-node) + Groq | Legacy fallback provider path — used only when `GEMINI_API_KEY` is absent |

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/johan8124/civictrail.git

# 2. Enter the directory
cd civictrail

# 3. Install dependencies
npm install

# 4. Create a file named .env.local in the project root
```

Configure `.env.local` for the Gemini provider:

```bash
# Required — Gemini API key (primary provider)
GEMINI_API_KEY=your-key-here

# Recommended — Gemini model used by the agent
GEMINI_MODEL=gemini-3.5-flash-lite

# Optional runtime controls (interactive latency budgets)
CIVICTRAIL_AGENT_DEADLINE_MS=90000   # wall-clock deadline for one agent run (default: 30000)
CIVICTRAIL_MODEL_TIMEOUT_MS=20000    # timeout for a single model request (default: 30000)
CIVICTRAIL_MODEL_MAX_TOKENS=1200     # output-token budget per agent turn (default: 1200)
CIVICTRAIL_MODEL_MAX_RETRIES=1       # one short retry for transient throttling (default: 1)
```

Then start the development server:

```bash
npm run dev
```

**Secrets and environment files:**

- `.env.local` is local only and gitignored — never commit it, and never commit API keys.
- `GEMINI_API_KEY` is used server-side only. It is never included in client code, API responses, logs, or the repository.
- If `GEMINI_MODEL` is unset, the runner defaults to `gemini-3.5-flash-lite`.
- Fallback (legacy-compatible): when `GEMINI_API_KEY` is absent, the runner uses Groq via `GROQ_API_KEY` (optional `GROQ_MODEL` override).

## Testing

```bash
npm test            # full suite: deterministic, phase 2, phase 3,
                    # agent completion, agent latency
npx tsc --noEmit    # type check
npm run lint        # ESLint
npm run build       # production build
```

Verified suite — **74 tests total**:

| Suite | Tests |
|---|---|
| Deterministic | 13 |
| Phase 2 | 36 |
| Phase 3 | 11 |
| Agent completion | 9 |
| Agent latency | 5 |

Latest verification run passed:

- **74/74 tests**
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` (production build)
- fresh clone: `npm ci` + `npm test` — 74/74 passing with no credentials and no API key present
- fresh clone: `npm run build` — production build passing with no credentials and no API key present

A prior local run (before this verification snapshot) also completed a live `POST /api/triage` agent smoke against the dev server: all four tools ran in order with `agentUsed=true` and a deterministic readiness verdict of `READY`. That live check was not re-run for this snapshot.

These are point-in-time validation results for the current MVP, not permanent guarantees.

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

## AI-Assisted Development

ChatGPT, Cline, and Antigravity were used during development for design discussion, implementation drafts, and debugging. The resulting implementation was reviewed, tested, and integrated by the project author; every change in this repository was validated through the test suite and verification runs described above.

## Limitations & Verification Status

- The current MVP browser UI does not upload or inspect binary files.
- The intake UI records file-related metadata (fields are explicitly labeled as metadata, e.g. "Identity document (metadata)" and "Supporting evidence (metadata)").
- File-size rules are evaluated only when structured upload metadata is actually supplied.
- The exact prohibited-character list used by the official cybercrime portal is not reproduced, because the verified source establishes that such characters are restricted but does not provide a complete verified list in Sources.md.
- CivicTrail uses a conservative product-level check for this and surfaces the result for human verification.
- Classification uses a deterministic guard after the agent suggestion; ambiguous/unsupported cases go to HUMAN_REVIEW.
- The agent does not extract transaction IDs, amounts, dates, or other readiness fields from free-form prose. Structured evidence is supplied through the intake schema and validated deterministically.
- External model latency and availability depend on Gemini service/quota conditions; CivicTrail has bounded request/deadline controls and a deterministic fallback.

Verification results are recorded under [Testing](#testing).

## Project Status

CivicTrail is an **MVP / prototype** built for evaluation and demonstration. It is not a production legal service, not affiliated with any government body, and not a substitute for official portals or professional advice. Scope, workflows, and safety boundaries are documented in [PRD.md](PRD.md) and [Rules.md](Rules.md).

## Disclaimer

CivicTrail is an informational decision-support and workflow-assistance tool. It is not a lawyer and does not provide legal representation, advice, or guarantees of outcome. It does not replace official government portals or authorities, and it never submits anything on a user's behalf. All output requires human review and confirmation before any action is taken. LLM-generated explanations within CivicTrail are not authoritative evidence.

## License

MIT. See [LICENSE](LICENSE).
