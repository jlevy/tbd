---
type: is
id: is-01ktyessevb2mdcafd12z7670n
title: "DocMap v0.1 tightening (PR #169 review sec 4)"
kind: epic
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
child_order_hints:
  - is-01ktyez0dpb7y7zmbxwck00car
  - is-01ktyez27sv021kf4ansfj6m87
  - is-01ktyez431ck22ebhdad8px1h2
  - is-01ktyez5s6ygg9d22a07ef2146
  - is-01ktyez7efx62agahwy47sxmwz
created_at: 2026-06-12T17:41:42.491Z
updated_at: 2026-06-12T20:26:01.591Z
closed_at: 2026-06-12T20:26:01.590Z
close_reason: "All 5 children closed: location required, word_count out of core, version policy, producer conformance (sources on upstream entries), reference doc with path-relativity and view-not-input. docmap/0.1 adoptable as-is."
---
Tighten docmap/0.1 against its first real producer (tbd docs list/status --json): require a location per entry, pin path-relativity, drop word_count from core, define version acceptance, and make tbd's own output conform. The docmap stays a generated view; no registry semantics.
