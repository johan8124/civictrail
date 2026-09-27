# CivicTrail Architecture

## High-level flow
```text
User
  |
  v
Next.js Web App
  |
  v
Server API
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
Deterministic Rule Engine
  |
  +--> pass
  +--> fail
  +--> review
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
Human confirmation
```

## Responsibility boundaries
### Strands agent
Interprets descriptions, classifies likely workflows, calls tools, reasons from tool observations, and explains verified results.

It does not own final readiness.

### Deterministic rule engine
Validates explicit structured requirements and produces pass/fail/review results. It never calls an LLM.

### Official source registry
Contains verified official sources and verified facts used for routing and authoritative checks.

### Evidence Ledger
Links claims to evidence and rules, preserves source references, and keeps passing/failing evidence.

### Action Packet
A structured draft for human review. Never automatically submitted.

## Suggested module structure
```text
app/
  api/
    triage/
      route.ts
  components/
  page.tsx
  globals.css
  layout.tsx

lib/
  agent/
  action-packet/
  evidence/
  readiness/
  rules/
  routes/
  source-registry/
  types/

tests/
```

Keep business logic outside page.tsx.

## Data flow
Case input -> Zod validation -> Strands invocation -> tool observations -> conservative classification guard -> deterministic rules -> ledger -> readiness -> Action Packet

## Model provider
Server-side only:
- GROQ_API_KEY
- GROQ_MODEL
- Groq-compatible base URL: https://api.groq.com/openai/v1
- CIVICTRAIL_MODEL_MAX_TOKENS (optional output-token budget per agent turn, default 1200)

Never expose secrets.

## API boundary
POST /api/triage should:
- validate external input with Zod;
- keep secrets server-side;
- return sanitized structured results;
- use no-store behavior where appropriate.

## Security
- User content is untrusted.
- Uploaded files are untrusted.
- Never execute uploaded files.
- No secret values in responses.
- No authoritative legal conclusion from LLM prose.
- No automatic government submission.

## Architecture principle
> The agent investigates; deterministic code verifies; the Evidence Ledger shows the proof; a human decides when uncertainty remains.
