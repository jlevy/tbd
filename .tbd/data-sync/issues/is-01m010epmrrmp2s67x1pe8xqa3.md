---
type: is
id: is-01m010epmrrmp2s67x1pe8xqa3
title: "Inbound selectors: label or assignee triggers, kind overrides, consume on import"
kind: feature
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T20:47:11.512Z
updated_at: 2026-08-16T00:14:17.280Z
extensions:
  linear:
    id: 81c998b0-bf8c-415d-a54e-6212b641a6cc
    linked_at: 2026-08-16T00:14:17.280Z
---
How does a human hand work from Linear to tbd? Three routes exist:
A. Explicit: tbd integration sync --pull --external FIN-123 — COMPLETE, bypasses the policy gate.
B. Policy-driven: policy.inbound {mode, labels, as_kind} — WORKS BUT THIN (F18).
C. Link existing bead: tbd integration link <bead> FIN-123 — COMPLETE AND CAREFUL. Refuses when the bead is already linked, when another local bead holds the item, and when the cross-repo claim guard trips; when the two sides differ it REFUSES TO GUESS (--take local|remote; non-interactive errors rather than picking). Seeds the base to match the stance, write-ahead intent, upserts the claim. After linking, mirrorSet always includes the bead regardless of policy (selection.ts:76-80) — that IS the 'officially a tbd-linked bead' status.

F18 gaps in route B (InboundClause is {mode, labels, as_kind}, schemas.ts:455-461):
- No assignment trigger. Assigning to a bot user is the most natural hand-off gesture in Linear and cannot be expressed.
- The trigger label is never consumed, so after import it means both 'please take this' and 'already taken'.
- as_kind is ONE fixed kind for every import.

F19: the origin label and the trigger label MUST be distinct. Once E18 applies 'tbd' to everything tbd manages, using 'tbd' as the trigger would make every mirrored item — including other repos' — a standing import candidate. Human applies 'tbd-take' (plain label, consumed on import); tbd applies 'tbd' (plain, always-on origin). tbd-take is deliberately NOT in a 'tbd' label group, because a Linear group and a plain label cannot share the name.

Design:
  policy.inbound:
    mode: report            # unchanged default; auto stays a deliberate opt-in
    when:
      labels: [tbd-take]    # any-of, or...
      assignee: agents@example.com   # ...assigned to this Linear user
    as_kind: task
    kind_labels: { bug: bug }
    consume: true

Today's labels: [...] folds into when.labels exactly as select folds into policy.outbound — additive.

KEY DECISION — do NOT assign imported beads to an agent. Import as open + UNASSIGNED so the bead lands in tbd ready, and the next agent claims it with tbd start (tbd-mnci). Reuses the claim protocol instead of a second assignment path; names no agent that may not be running; degrades correctly when none is (work waits in ready). Linear shows Started with the actor as soon as an agent picks it up — the visibility the human wanted from assigning.

Also: E18's labels must apply at the LINKED-PAIR level, not only outbound creates, or routes A/B/C all produce unlabelled issues.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §4.8, E21
Spec: plan-2026-08-14-external-sync-and-traceability.md Phase 3
