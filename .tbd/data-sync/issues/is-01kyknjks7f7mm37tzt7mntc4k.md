---
type: is
id: is-01kyknjks7f7mm37tzt7mntc4k
title: "Spec: Agent CLI ergonomics round 2 (bash fallbacks)"
kind: epic
status: open
priority: 1
version: 12
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
child_order_hints:
  - is-01kv1b1bbc8zjprnm79nqyaeh4
  - is-01kyknk0n3g82fatfmpdg7pck6
  - is-01kyknk22z7tn952q0hcwf7h27
  - is-01kyknk3k55f2apsqskw132n2j
  - is-01kyknmk7smd8cmrk1g9n9c309
  - is-01kyknk551jhcx6har9zmfenfw
  - is-01kyqdkenfn9rswm3s44vg11j8
  - is-01kysqv071rtzjszpag3y7ywm7
  - is-01kysqvc51zr4mkdzks2scdk5y
created_at: 2026-07-28T06:11:15.877Z
updated_at: 2026-07-30T14:46:26.720Z
---
Epic for plan-2026-07-28-agent-cli-bash-fallbacks.md: close the remaining places agents shell out around tbd (loops, head/grep/jq pipes).

Phase 1 (kill observed loops): tbd-r2zr bulk show, tbd-hy6b variadic doc readers, then tbd-o4mk point-of-need doc pass.
Phase 2 (write-side + recovery): tbd-lunb variadic deps + create --depends-on, tbd-1der --spec suffix matcher, tbd-xgge recoverable errors.

Shared contract for all multi-target verbs: validate all targets first, fail closed on unknowns, --ignore-missing downgrades to skips. All additive; no breaking changes. The spec's Open Questions are explicitly deferred - no beads, future consideration only.
