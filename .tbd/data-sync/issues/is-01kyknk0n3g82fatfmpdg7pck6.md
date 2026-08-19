---
type: is
id: is-01kyknk0n3g82fatfmpdg7pck6
title: "Variadic doc readers: guidelines/shortcut/template/docs show accept multiple names"
kind: task
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies:
  - type: blocks
    target: is-01kyknk22z7tn952q0hcwf7h27
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-07-28T06:11:29.059Z
updated_at: 2026-07-29T02:56:22.959Z
closed_at: 2026-07-29T02:56:22.959Z
close_reason: "Delivered in PR #198 (agent CLI ergonomics round 2): bulk show, variadic doc readers, variadic deps + create --depends-on, --spec suffix matching, did-you-mean/search-by-ID/overflow hints, point-of-need doc pass. All suites green."
---
DocCommandHandler (shared by guidelines/shortcut/template; docs show has its own path): accept multiple queries per call.

- Registrations: guidelines [queries...], shortcut [queries...], template [queries...], docs show <names...>.
- Resolve ALL names (exact-then-fuzzy each, as today) BEFORE printing any content; any miss fails closed listing the misses, so a typo cannot half-load a guideline group.
- Output: agent-instructions preamble once, then each doc under its existing header, in argument order.
- Single-name behavior byte-identical to today.

Purpose: the skill instructs loading the 9-doc General engineering group; this makes it one call. Goldens: two names in order; one bad name -> no partial content + non-zero; single-name unchanged.
