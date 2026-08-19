---
type: is
id: is-01kyqdm89ncgyxhjb7nfv4ysta
title: "PR #198 review R4: variadic docs show breaks pre-init bundled self-docs"
kind: bug
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyqdkenfn9rswm3s44vg11j8
created_at: 2026-07-29T17:09:18.773Z
updated_at: 2026-07-29T18:04:24.973Z
closed_at: 2026-07-29T18:04:24.973Z
close_reason: "Review addressed on PR #198: R1-R4 + docs gap fixed in 69b6ec8, Bugbot round-1 trio fixed in 52c9856, Bugbot round-2 pair rebutted in-thread with technical justification. Disposition map posted; CI green on all checks at 52c9856."
---
Low. docs.ts runMulti calls requireInit() unconditionally; single-name path serves tbd-docs/tbd-design from BUNDLED_ROOT_DOCS before init. So pre-init: show tbd-docs works, show tbd-docs tbd-design fails. Fix: an all-bundled batch resolves from bundled fallbacks without init; mixed batches still require init (managed entries need the cache) with all-or-nothing resolution. Pre-init golden in cli-uninitialized.
