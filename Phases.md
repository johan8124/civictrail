# CivicTrail Build Phases

## Current phase
**Phase 2 — Harden classification + cyber verification**

Phase 1 foundation is complete.

## Phase 0 — Foundation [DONE]
- Next.js created
- TypeScript / React / Tailwind configured
- Strands SDK installed
- OpenAI SDK installed
- Zod installed
- environment variables created
- Git initialized

## Phase 1 — Foundation architecture [DONE]
Completed:
- shared types
- source registry
- deterministic rule engine
- readiness engine
- Evidence Ledger
- Action Packet
- Strands agent
- four typed tools
- triage orchestrator
- cyber synthetic demo
- initial UI
- /api/triage
- deterministic tests

Validation:
- 13 deterministic tests passed
- lint passed
- build passed
- diff check passed
- browser rendered
- real Strands tool calling verified
- no secret in client output

## Phase 2 — Harden classification + cyber verification [CURRENT]

### Goal
Make routing conservative and cyber validation reflect the verified official portal checklist.

### Tasks
1. Add deterministic classification guard.
2. Supported classifications:
   - consumer_grievance
   - cyber_financial_fraud
   - unknown
3. Unsupported/ambiguous cases -> HUMAN_REVIEW.
4. Agent confidence never overrides the guard.
5. Add deterministic cyber checks:
   - incident date/time
   - incident details present
   - incident details >= 200 characters
   - prohibited-character validation
   - identity document present
   - bank/wallet/merchant
   - 12-digit transaction ID/UTR
   - transaction date
   - fraud amount
   - supporting evidence
6. Validate actual file sizes only when real uploads are supplied:
   - identity document <= 5 MB
   - each evidence file <= 10 MB
7. Preserve the Evidence Ledger.
8. Add READY, BLOCKED and HUMAN_REVIEW synthetic cases.
9. Browser-test every state.
10. Run all validation commands.

### Definition of done
- obvious cyber case -> correct supported route
- obvious consumer case -> correct supported route
- unsupported municipal-tax case -> HUMAN_REVIEW
- ambiguous case -> HUMAN_REVIEW
- invalid UTR -> BLOCKED
- short incident details -> BLOCKED
- prohibited characters -> BLOCKED
- valid cyber case -> READY
- agent tool usage still occurs
- deterministic readiness remains authoritative
- all tests/lint/build pass

## Phase 3 — Consumer workflow
- verify current official NCH/e-Jagriti facts;
- build conservative consumer intake;
- route to official source;
- evidence checks;
- ledger;
- Action Packet.

## Phase 4 — Action Packet
- polished structured packet;
- source references;
- evidence index;
- human confirmation;
- no automatic filing.

## Phase 5 — Human Review
- show why classification/evidence is uncertain;
- allow user correction;
- rerun validation.

## Phase 6 — Evaluation
Synthetic benchmark:
- clear supported cases
- ambiguous cases
- incomplete evidence
- unsupported cases

Measure:
- route accuracy
- missing-evidence detection
- source correctness
- human agreement
- time to action-ready packet

Never invent benchmark results.

## Phase 7 — Security / reliability
- malformed input tests
- payload limits
- safe file handling
- secret scans
- prompt-injection resistance
- deterministic authority tests
- degraded-mode behavior

## Phase 8 — UI polish
- hierarchy
- accessibility
- status visualization
- Evidence Ledger readability
- Action Packet clarity
- responsive behavior

## Phase 9 — Deployment
- public deployment
- environment variables
- live test
- error monitoring
- no secret exposure

## Phase 10 — Demo / submission
LexHack requires a functioning prototype and a demo video no longer than 3 minutes.

Demo:
- problem
- audience
- why it matters
- BLOCKED -> fix evidence -> READY
- Evidence Ledger
- Strands agent/tool behavior
