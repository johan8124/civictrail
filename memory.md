# CivicTrail Project Memory

## Project status
Fresh project for LexHack 2026.

## Current phase
**Phase 2 — Harden classification + cyber verification — COMPLETE (not committed)**

## Completed foundation
- Next.js project created at `C:\Users\DELL\civictrail`
- Git initialized on `main`
- `.env.local` created
- `.env*` ignored
- `@strands-agents/sdk`, `openai`, `zod`, `tsx` installed

## Phase 1 implementation
Created:
- shared Zod schemas/types
- verified source registry
- deterministic rule engine
- readiness engine
- Evidence Ledger
- Action Packet
- Strands agent
- four typed tools
- triage orchestrator
- cyber synthetic demo cases
- initial UI
- `/api/triage`
- deterministic tests

## Verified agent behavior
Live Groq run successfully used:
- classify_issue
- lookup_official_route
- inspect_evidence
- validate_action_packet

Deterministic readiness remains authoritative.

## Phase 1 validation
- 13 deterministic tests passed
- `npm run lint` passed
- `npm run build` passed
- `git diff --check` passed
- browser page rendered
- no GROQ/gsk secret appeared in client output
- BLOCKED cyber case worked
- READY cyber case worked

## Known issue to fix
RESOLVED in Phase 2 (see below): the agent could classify an ambiguous unsupported
description, such as a municipal-tax case, as consumer_grievance. The deterministic
classification guard now downgrades unsupported/ambiguous suggestions to unknown,
which resolves to HUMAN_REVIEW.

## Cyber limitation
Current cyber rules started as presence checks. Phase 2 must strengthen them only with the verified official checklist in Sources.md.

## Architecture decision
`Strands agent -> tools -> deterministic rules -> Evidence Ledger -> readiness`

The agent does not own final readiness.

## Safety decisions
- informational decision support, not legal advice;
- no automatic government submission;
- no unrestricted web search for authoritative routing;
- official source registry controls authoritative facts;
- human confirmation remains required.

## Next task
DONE (Phase 2 implemented and validated; see below). Next: Phase 3 — Consumer
workflow (verify current official NCH/e-Jagriti facts first).

## Phase 2 implementation (2026-09-18)
### What was implemented
- **Conservative classification guard** (`lib/agent/classification.ts`:
  `applyClassificationGuard`). Pure/deterministic, runs AFTER the agent
  suggestion (also after keyword fallback and user selection):
  - cyber_financial_fraud accepted only with strong explicit signals of
    fraudulent/unauthorized financial activity AND transaction/payment/account
    involvement;
  - consumer_grievance accepted only with strong explicit product-level signals
    (seller/provider/goods/services AND product/order/problem signals);
  - unsupported/ambiguous/empty/insufficient descriptions -> unknown ->
    HUMAN_REVIEW;
  - agent confidence never authorizes routing; the guard cannot be overridden
    by the LLM;
  - cyber and consumer are mutually exclusive (cyber precedence).
- **Hardened cyber rules** (`lib/rules/engine.ts`), all sourced to the
  National Cyber Crime Reporting Portal (Sources.md §1):
  - CYBER-CHECKLIST-001..010: incident date/time, incident details present,
    details >= 200 chars, conservative prohibited special-character set,
    identity document, bank/wallet/merchant, UTR exactly 12 digits, transaction
    date, fraud amount valid positive numeric, supporting evidence;
  - CYBER-CHECKLIST-011/012: file-size limits (ID <= 5 MB, each evidence file
    <= 10 MB) evaluated ONLY when real uploaded file metadata is supplied
    (`identityDocumentFile` / `supportingEvidenceFiles` on EvidenceRecord);
    rules are absent from results when no real upload exists (no fake checks);
  - rules 003/004 apply only when incident details are provided (rule 002
    covers absence).
- **Evidence Ledger** (`lib/evidence/ledger.ts`): official-checklist rule
  entries now name the source as "National Cyber Crime Reporting Portal
  (https://www.cybercrime.gov.in/)". Passing AND failing evidence preserved.
- **Orchestrator** (`lib/agent/triage-orchestrator.ts`): guard wired after
  `resolveWorkflow`; new exported pure `buildUnsupportedWorkflowResult` used
  for the unknown path (HUMAN_REVIEW) and by tests; `classificationGuard`
  included in TriageResponse (new field in `lib/types/civictrail.ts`).
- **UI** (`app/components/CaseIntake.tsx`, `ReadinessBanner.tsx`): six synthetic
  demo buttons (READY / invalid UTR / short details / prohibited chars /
  municipal tax / ambiguous); banner shows the deterministic guard outcome and
  reason.
- Synthetic cases CASE_A..CASE_F in `lib/demo/cyber-demo.ts` (all synthetic).

### Tests added
- `tests/phase2.test.ts`: 36 deterministic tests (guard accept/reject, empty and
  insufficient description, confidence-does-not-authorize, UTR valid/invalid,
  200-char boundary, prohibited chars, missing ID/bank/date/evidence, invalid
  amount, amount parser, file-size rules only with real uploads, ledger
  provenance referencing the portal, readiness authority, cases A-F, packet
  human confirmation).
- `tests/deterministic.test.ts` updated for the new rule set (10 base checks;
  invalid-UTR demo blocked by CYBER-CHECKLIST-007; file rules absent without
  uploads). `npm test` now runs both files (49 tests total, all pass).

### Validation results (2026-09-18)
- `npm test`: 13 + 36 = 49 deterministic tests passed.
- `npm run lint`: passed.
- `npm run build`: passed (Next 16.3.5, TypeScript check clean).
- `git diff --check`: passed (repo is fully untracked; nothing committed).
- Browser-flow validation via dev server + POST /api/triage
  (`tests/browser-check.ts`), all with live Strands agent runs (agentUsed=true):
  CASE A -> READY; CASE B (UTR 12345) -> BLOCKED (CYBER-CHECKLIST-007);
  CASE C (short details) -> BLOCKED (CYBER-CHECKLIST-003); CASE D (prohibited
  chars) -> BLOCKED (CYBER-CHECKLIST-004); CASE E (municipal tax) ->
  HUMAN_REVIEW (guard downgraded_to_unknown); CASE F (ambiguous) ->
  HUMAN_REVIEW. Ledger visibly shows passed/failed rules; Action Packet
  requiresHumanConfirmation=true in all packet cases.
- Secret scan: 0 hits for gsk_/GROQ_API_KEY/sk- patterns in rendered HTML and
  all 14 client JS chunks.

### Important decisions
- Guard applies to agent suggestions, keyword fallback AND user selection —
  unsupported or ambiguous DESCRIPTIONS must resolve to HUMAN_REVIEW per
  Phases.md Part 1, regardless of who suggested the workflow.
- The exact official prohibited-character list is UNKNOWN (Sources.md verifies
  only that the portal field "lists special characters that are not allowed").
  A conservative documented set (`PROHIBITED_INCIDENT_DETAILS_CHARS`) is used
  deterministically; matched characters are surfaced in the ledger and the UI
  wording asks the user to verify on the portal. This is treated as a
  CivicTrail product check pending verification of the official list.
- Fraud amount: strips commas/spaces/₹, must match integer/2-decimal pattern
  and be > 0. UTR: whitespace stripped, must match exactly 12 digits.
- No file-upload UI added (out of Phase 2 scope); file-size rules operate on
  real upload metadata when supplied programmatically.

### Known limitations
- Prohibited-character list is a conservative approximation (exact official
  list UNKNOWN — verify manually on cybercrime.gov.in).
- File-size rules never run in the browser UI yet because there is no upload
  UI (by design in Phase 2); they are covered by deterministic tests.
- Guard signal sets are documented keyword/regex heuristics, not semantic
  understanding; conservative by design (false rejects go to HUMAN_REVIEW).

### Real-browser (UI) validation added (2026-09-18)
- New script `tests/browser-ui-check.ts`, run manually with
  `npx tsx tests/browser-ui-check.ts` while `npm run dev` is serving. It uses
  Node's global `fetch` and global `WebSocket` to drive a real headless
  Chrome/Edge over the DevTools Protocol, so NO new dependency was added.
- It clicks the six synthetic demo buttons and "Check readiness" in the real
  UI, then reads the rendered DOM (readiness banner, Evidence Ledger,
  Action Pack) instead of the API response.
- Final result (live Strands agent runs):
  valid cyber case -> READY with 10 passing CYBER-CHECKLIST rules;
  invalid UTR -> BLOCKED (CYBER-CHECKLIST-007); short details -> BLOCKED
  (CYBER-CHECKLIST-003); prohibited characters -> BLOCKED
  (CYBER-CHECKLIST-004); municipal tax -> HUMAN_REVIEW (guard downgraded);
  ambiguous -> HUMAN_REVIEW (guard downgraded). Each cyber case shows 13 ledger
  entries naming the National Cyber Crime Reporting Portal, keeps the 9 passing
  entries next to the single failed rule, and the Action Pack renders
  "Requires human confirmation"; unresolved classifications render no packet.
- Secret scan inside the same run: 0 hits in rendered HTML, 0 hits in the 15
  client chunks served by the dev server, 0 hits in the 10 built client JS
  files under `.next/static`.
- TOOLING NOTE (no architecture change): the first version of the check script
  asserted that HUMAN_REVIEW cases must also contain passing deterministic rule
  entries. HUMAN_REVIEW cases legitimately contain only the classification info
  entry plus the review finding, so the assertion was corrected in the check
  script. Application behaviour was already correct.

### Next step
Phase 3 — Consumer workflow: verify current official NCH/e-Jagriti facts in
Sources.md, then build conservative consumer intake, routing, evidence checks,
ledger and Action Packet. No commit/push/deploy has been done.

## Project memory location (2026-09-18)
The canonical CivicTrail project memory is this file:
`C:\Users\DELL\civictrail\memory.md`.
A copy previously kept at `C:\Users\DELL\Downloads\memory.md` is NOT the
project memory file and is no longer maintained. All history above was
preserved unchanged (byte-identical) when this canonical file was created.

## Phase 2 completion record (2026-09-18)
Status: COMPLETE. Not committed (no commit, push or deploy has been performed).

Delivered:
- Classification guard implemented (`lib/agent/classification.ts`,
  `applyClassificationGuard`). Deterministic, runs after the agent suggestion
  (and after keyword fallback / user selection): agent confidence alone never
  authorizes routing, and the LLM cannot override the guard.
- Unsupported / ambiguous / empty / insufficient descriptions resolve to
  workflow `unknown` -> HUMAN_REVIEW. Unsupported municipal-tax problem ->
  HUMAN_REVIEW; ambiguous description -> HUMAN_REVIEW.
- Stronger cyber checklist validation (`lib/rules/engine.ts`,
  CYBER-CHECKLIST-001..012) sourced ONLY to the verified National Cyber Crime
  Reporting Portal facts recorded in Sources.md: incident date/time; incident
  details present; incident details >= 200 characters; prohibited special
  characters (conservative set); identity document; bank/wallet/merchant;
  12-digit transaction ID / UTR; transaction date; fraud amount; supporting
  evidence; plus file-size limits (identity document <= 5 MB, each evidence file
  <= 10 MB) evaluated only when real uploaded files are actually supplied.
- Evidence Ledger preserved for every deterministic rule result with id, claim,
  evidence, source, ruleId, status, confidence, timestamp and reference -
  passing and failing evidence alike. Official-checklist entries name the
  National Cyber Crime Reporting Portal.
- Deterministic readiness authority retained: failed required rule -> BLOCKED;
  unresolved/unsupported classification -> HUMAN_REVIEW; all required
  deterministic checks pass -> READY. The agent can never turn BLOCKED into
  READY.

Validation results (2026-09-18):
- READY: valid synthetic cyber case -> READY with all 10 applicable
  CYBER-CHECKLIST checks passing.
- BLOCKED: invalid UTR `12345` -> BLOCKED (CYBER-CHECKLIST-007); incident
  details under 200 characters -> BLOCKED (CYBER-CHECKLIST-003); prohibited
  special characters -> BLOCKED (CYBER-CHECKLIST-004).
- HUMAN_REVIEW: unsupported municipal-tax problem -> HUMAN_REVIEW; ambiguous
  description -> HUMAN_REVIEW; empty/insufficient description -> HUMAN_REVIEW
  even with maximum agent confidence.
- `npm test`: 49/49 tests passed (13 deterministic + 36 Phase 2).
- `npm run lint`: passed.
- `npm run build`: passed (Next.js 16.3.5, TypeScript check clean).
- Browser validation: passed against the real dev server, including a real
  headless browser run (`tests/browser-check.ts` POST flow plus
  `tests/browser-ui-check.ts` DevTools-Protocol UI run) with live Strands agent
  runs. The Evidence Ledger visibly showed the passed and failed rules, and the
  Action Packet still required human confirmation.
- Secret scan: 0 hits in rendered HTML, in the client chunks served to the
  browser and in the built client JavaScript files.

Remaining TODO / UNKNOWN items:
- UNKNOWN: the exact official list of prohibited special characters for the
  incident-details field. Sources.md verifies only that the restriction exists,
  so a conservative documented set is applied deterministically and matches are
  surfaced for human verification.
- TODO: the file-size rules cannot be exercised in the browser UI because
  Phase 2 deliberately added no upload UI; they are covered by deterministic
  tests that supply real upload metadata.
- TODO: the classification guard uses documented keyword/regex signals rather
  than semantic understanding. It is conservative by design: false rejects go to
  HUMAN_REVIEW, never to an unauthorized route.
- UNKNOWN: exact mandatory consumer complaint document requirements; Phase 3
  must verify them in Sources.md before any of them is used as product logic.

Next phase: Phase 3 - Consumer workflow. Verify the current official NCH /
e-Jagriti facts in Sources.md first, then build conservative consumer intake,
routing, evidence checks, the ledger and the Action Packet. Phase 3 has NOT been
started.
## Phase 3 source verification (2026-09-18)

Scope: SOURCE VERIFICATION ONLY for the Consumer Grievance workflow. No code was
written, no application file was changed, and the Consumer workflow has NOT been
implemented.

Canonical sources file note: `C:\Users\DELL\civictrail\Sources.md` now exists
as a project file. Its previously verified content (sections 1-4 and the source
policy) was preserved byte-identical, and the Phase 3 verification was appended
as section 5. The copy at `C:\Users\DELL\Downloads\Sources.md` is not the
project sources file.

Method: only first-party official pages were used. `e-jagriti.gov.in` renders on
the client (a plain HTTP request returns only an 888-byte shell), so its facts
were read from the official page as rendered in a real browser.

What was verified:
- National Consumer Helpline (NCH): launched by the Department of Consumer
  Affairs to create awareness, advise and redress consumer grievances and act as
  a central registry; an integrated Grievance Redress Mechanism (INGRAM);
  consumers can register grievances online; an alternate dispute redressal
  mechanism at pre-litigation level; if not satisfied the consumer can approach
  the appropriate Consumer Commission; registration requires a one-time account
  (email verified) and documents are only "necessary documents, if any"; a
  unique docket number is issued and the grievance is forwarded to the concerned
  company / agency / regulator / ombudsman; status can be tracked without
  logging in; "may take up to a maximum of 30 days to arrive at a logical
  conclusion"; other channels 1800-11-4000, 1915, SMS/WhatsApp 8800001915,
  NCH App, UMANG App; the site footer routes cyber financial fraud to 1930.
- e-Jagriti: official Government of India platform (Department of Consumer
  Affairs; built and maintained by NIC) for filing an online complaint before a
  Consumer Commission; onboarding is Register -> Profile -> Complaint; a
  notarized affidavit is explicitly stated as mandatory; hiring an advocate is
  explicitly not mandatory; the filing fee depends on the value of goods or
  services paid as consideration and the level of Commission (official fee table
  recorded); status tracking via CASE HISTORY/STATUS by Reference or Case
  Number; judgment/order download from the platform; certified copies only from
  the concerned Commission; document formats must be obtained from the concerned
  Consumer Commission; hearing modes; Commission contact details; helpdesk
  numbers and helpdesk-ejagriti[at]nic[dot]in; help documents and videos are
  first-party files.

What remains UNKNOWN (unstated by the official sources; must not be used as
product logic):
- any mandatory document list for NCH (only "necessary documents, if any");
- the complete per-case-type document set for an e-Jagriti complaint and the
  prescribed formats (the official source defers to the concerned Commission);
- any limitation period or deadline; whether NCH charges a fee; which authority
  NCH forwards a grievance to; any guaranteed outcome, timeline or recovery.

Facts safe for deterministic product logic:
- NCH: existence and purpose, pre-litigation character, online grievance
  registration, docket number, forwarding to the concerned party, login-free
  tracking, escalation to a Consumer Commission, documents optional ("if any"),
  and the cyber (1930) distinction.
- e-Jagriti: online complaint filing before a Consumer Commission, the
  Register/Profile/Complaint sequence, mandatory notarized affidavit, advocate
  not mandatory, the official fee table, status tracking, judgment download and
  the certified-copy limitation, and that document formats come from the
  concerned Commission.
- Not safe: computed fees, document checklists beyond the affidavit, deadlines,
  eligibility rules, and any outcome promise.

Implementation status: COMPLETE (2026-09-19, not committed).

## Phase 3 implementation (2026-09-19)
- **Types** (`lib/types/civictrail.ts`): `CONSUMER_ROUTE_CHOICES` = not_sure /
  nch_grievance / e_jagriti_complaint; `consumerRouteRequested` and
  `notarizedAffidavit` added to `EvidenceRecordSchema` (no duplicate fields).
- **Rules** (`lib/rules/engine.ts`):
  - CONSUMER-ROUTE-001 (always applies): pass for nch_grievance /
    e_jagriti_complaint; "not_sure"/absent -> review -> HUMAN_REVIEW
    (CivicTrail never infers the route);
  - CONSUMER-EJAGRITI-AFFIDAVIT-001 (applies only on e_jagriti_complaint):
    fails when no notarized affidavit (verified Sources.md §5.2 FAQ 4);
  - CONSUMER-NCH-DOCS-001 (applies only on nch_grievance): informational,
    always passes — NCH documents are "necessary documents, if any", never a
    blocker;
  - CONSUMER-INTAKE-001..004 unchanged (civictrail_intake_requirement).
- **Route guidance** (`lib/routes`): CONSUMER_ROUTE exposes only verified
  NCH + e-Jagriti sources (sourceIds e-jagriti, national-consumer-helpline).
- **Demo cases** (`lib/demo/consumer-demo.ts`): N1 (NCH READY), N2 (NCH
  BLOCKED on purchase evidence), E1 (e-Jagriti READY with affidavit), E2
  (e-Jagriti BLOCKED without affidavit), G (ambiguous -> HUMAN_REVIEW), H
  (cyber description routed through consumer selection -> still cyber).
  CASE H incident details extended past the 200-char cyber minimum.
- **UI**: consumer route selector wired via `consumerRouteRequested` in
  CaseIntake.
- **Tests**: `tests/phase3.test.ts` (11 real tests) included in `npm test`;
  deterministic.test.ts updated (route added to consumer READY cases,
  missing brace fixed).

Known issues from the interruption, all resolved:
- inconsistent consumer route identifiers -> single CONSUMER_ROUTE_CHOICES set;
- obsolete courierEnclosedWithComplaint -> removed everywhere;
- duplicated EvidenceRecordSchema fields -> deduplicated;
- failing deterministic test -> fixed (missing `});` + route on READY case);
- phase3.test.ts had no real tests -> rewritten (11 tests);
- Phase 3 tests in `npm test` -> yes (test script runs all three files);
- TypeScript/build errors -> resolved.

Phase 3 validation (all passing, NOT committed):
- npm test: 13 + 36 + 11 tests pass;
- npm run lint: 0 problems;
- npm run build: compiled successfully;
- git diff --check: clean;
- browser validation: production server rendered, /api/triage returned
  NCH case READY (6 rules) and e-Jagriti case BLOCKED on affidavit, no
  secret in page or API output;
- secret scan: no gsk_/sk-/AIza patterns in source; .env.local ignored.

## Deployment-readiness audit (2026-09-19)
- Deployment audit completed; all 8 project-control documents confirmed
  present and readable (AGENTS.md, PRD.md, Architecture.md, Rules.md,
  Sources.md, Phases.md, Design.md, memory.md).
- npm test: 60/60 passed (13 deterministic + 36 Phase 2 + 11 Phase 3).
- npm run lint passed; production build passed; git diff --check passed.
- .env.local remains ignored; GROQ_API_KEY is server-only.
- No serverless filesystem/process/browser blockers; no hard-coded localhost
  application URLs; Vercel deployment assumptions verified against current
  Fluid Compute limits (default maxDuration 300 s on all plans).
- Agent latency investigation completed: successful Strands runs typically
  4-6 seconds; observed long runs were caused by Groq HTTP 429 rate-limit
  retries/backoff; no unnecessary tool calls or application retry loop found
  (4 tools, 5 ideal model rounds).
- maxDuration is NOT being added; deployment blocker: none.
- Next step: initial Git commit and GitHub push.
- Nothing has been committed, pushed, or deployed yet.

## Agent latency + analysis progress UX (2026-09-19)
### Root cause
Long user waits originated in the **Strands SDK auto-retrying Groq HTTP 429
rate-limit responses with exponential backoff** (`maxAttempts: 4` by default),
compounding 429 retry-after delays into multi-minute hangs.

### Fix
- `lib/agent/triage-agent.ts`: bounded `maxAttempts: 2` on OpenAIModel (short
  retry opportunity for transient throttling; fast failure on persistent
  throttling).
- `app/api/triage/route.ts`: wall-clock `AbortSignal` deadline (~18s); on
  timeout/429 the run is cancelled cleanly and the existing deterministic
  fallback runs with `agentAnalysis: "unavailable"`.
- Fallback wording is explicit/honest — never claims agent completion.

### UI
- `app/components/AnalysisProgress.tsx`: new truthful progress panel
  (6 staged labels, elapsed timer, neon-accent progress line,
  prefers-reduced-motion).
- `CaseIntake.tsx` & `ReadinessBanner.tsx`: progress panel renders immediately
  on submit; smooth transition to deterministic result.
- Deterministic rules/Evidence Ledger/Action Pack unchanged.

### Measured latency (real browser, 7 cases)
- Normal success: ~40-75s under live Groq throttling (bounded retries).
- Timeout (simulated): degrades to deterministic fallback in ~18-20s.
- Fallback produces valid results with honest unavailable messaging.

### Validation
- `npm test`: 60/60 passed
- `npm run lint`: 0 problems
- `npm run build`: compiled successfully
- `git diff --check`: clean
- Browser: all 229 real-browser checks passed (progress UI, fallback
  messaging, all READY/BLOCKED/HUMAN_REVIEW states, secret scan 0 hits)
- `lib/`, `app/api/`, deterministic rules, routing, Evidence Ledger, Action
  Pack, demo data, API contract — byte-identical to prior validated state

### Remaining limitations
- Live Groq 429 retry-after can still cause 15-30s waits on the first attempt.
- Progress stages are generic (truthful labels, no fabricated tool completion).
- AbortController cancellation granularity is per-invoke (not per-tool).
- Secret scan remains clean; API key server-side only.

## Diagnostic latency findings (2026-09-21)
### Corrected diagnostic run (production-equivalent Strands path)
- Temporary harness `tests/diagnostic-measure.mts` successfully exercised the exact production agent path (Strands agent + 4 tools + `AbortSignal.timeout(30_000)` + interactive fetch with 2s Retry-After cap).
- Verified Cyber READY run completed in ~14.955 s with **1 model call** and **all 4 tools** executing in correct order (`classify_issue` → `lookup_official_route` → `inspect_evidence` → `validate_action_packet`).
- Production parity checks: 12/12 constants matched `lib/agent/triage-agent.ts`.

### Groq rate limiting (later 3-case run)
- Subsequent 3-case sequential run hit **explicit Groq HTTP 429** with `Retry-After` headers indicating **Tokens-Per-Day (TPD) limit**.
- Groq organization daily limit: **200,000 tokens** (120B model).
- SDK honored the server's `Retry-After` (minutes) before the interactive fetch clamp could engage, causing multi-minute backoffs inside the model client.
- The **31–61 s diagnostic runs are retry-dominated, NOT normal model latency**.
- These runs are **not valid evidence of normal latency**; the only trustworthy measurement is the ~15 s single-call Cyber READY run.

### No production behavior changed
- The diagnostic harness used a byte-identical replica of production constants and verified parity at runtime.
- No application file, agent prompt, model config, retry policy, or UI was modified by the diagnostic.
- All deterministic tests (60/60), lint, build, and browser validation remain passing.