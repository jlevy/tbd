---
type: is
id: is-01kra99k339r7jwtw5wdjzbrs5
title: "Q18: Decide override provenance (computed-by-name vs recorded edge)"
kind: task
status: open
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels:
  - pause
dependencies:
  - type: blocks
    target: is-01kra98tffpc00qar6ee3zk8tv
  - type: blocks
    target: is-01kra9b8m3jtk1jp7qyzdkvy1a
parent_id: is-01kra98fgac70pjft7jnarmave
created_at: 2026-05-11T01:09:16.515Z
updated_at: 2026-08-15T05:43:42.611Z
extensions:
  linear:
    id: f1363c49-cc37-4472-8edf-5f44de0bc481
    key: TBD-32
    url: https://linear.app/finterm-ai/issue/TBD-32/q18-decide-override-provenance-computed-by-name-vs-recorded-edge
    linked_at: 2026-08-10T19:36:38.366Z
---
Decision required before Phase 2 override roundtrip work. Depends on Q16.

- A. Computed-by-name (current). Cheap; no extra state. Roundtrip degrades when upstream renames/removes.
- B. Frontmatter pointer in override doc (_upstream: {source_id, docref, revision, content_hash}).
- C. Sidecar edge (.tbd/overrides.yml or <file>.override.yml).
- D. tbd-internal overlay file (.tbd/docmap-overrides.yml). Single source of truth.

Cases that get muddy without provenance: late-arriving upstream creates fake override; removing upstream loses diff/unfork data; upstream rename loses discoverability; tbd source upstream PR needs exact upstream source/path/revision.

Spec section: ## Open Questions → Q18 (line ~856).
