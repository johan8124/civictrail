# CivicTrail Design System

## Feel
Trustworthy, calm, clear, modern, civic, evidence-driven.

Avoid gaming/sci-fi/generic-AI aesthetics.

## Palette
- deep neutral background for dark theme;
- slate/zinc surfaces;
- off-white primary text;
- muted gray secondary text;
- restrained green for READY;
- restrained red for BLOCKED;
- restrained amber for HUMAN_REVIEW.

Never rely on color alone for status.

## Typography
Use one clean sans-serif family (Inter, Geist, or system sans).
Use monospace only for IDs and technical references.

## Layout
Desktop:
- generous whitespace;
- clear primary action;
- content max-width;
- evidence/result separation.

Mobile:
- single column;
- no horizontal scroll;
- usable buttons;
- safely wrapping evidence cards.

## Components
### Header
CivicTrail name + small product descriptor.

### Hero
Headline:
> Turn a problem into an action-ready case.

Supporting:
> CivicTrail helps you identify the official route, check your evidence, and understand what is still missing.

### Intake
Guided workflow with clear labels and synthetic examples.

### Readiness
Large status label:
READY / BLOCKED / HUMAN REVIEW

Then show the shortest useful reason.

### Evidence Ledger
Scannable row structure:
Claim | Evidence | Official source | Rule | Status

Allow expansion for detailed evidence.

### Action Packet
- case summary
- route
- evidence checklist
- source references
- next actions
- human confirmation

## Interaction
- explain loading state;
- identify safe next step on errors;
- never hide uncertainty;
- no dark patterns;
- no automatic irreversible actions.

## Accessibility
- contrast;
- visible focus;
- keyboard navigation;
- status not conveyed by color alone;
- readable errors;
- proper labels.
