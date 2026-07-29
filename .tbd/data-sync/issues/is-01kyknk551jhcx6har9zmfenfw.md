---
type: is
id: is-01kyknk551jhcx6har9zmfenfw
title: "Recoverable errors: did-you-mean IDs, search matches display IDs, overflow hints; purge grep/jq doc recipes"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-07-28T06:11:33.665Z
updated_at: 2026-07-29T02:56:22.977Z
closed_at: 2026-07-29T02:56:22.977Z
close_reason: "Delivered in PR #198 (agent CLI ergonomics round 2): bulk show, variadic doc readers, variadic deps + create --depends-on, --spec suffix matching, did-you-mean/search-by-ID/overflow hints, point-of-need doc pass. All suites green."
---
Errors recover the agent instead of stranding it. Four parts:

a) Unknown-issue-ID errors (NotFoundError via resolve paths): append up to 3 near-miss display IDs (prefix/edit-distance scan over the ID mapping table) plus a "try: tbd search <text>" pointer. No suggestion below a confidence threshold - a wrong suggestion is worse than none (vitest covers ranking + threshold).
b) tbd search matches display IDs as a searchable field -> native partial-ID lookup (tbd search r2zr finds tbd-r2zr, not just textual mentions).
c) Argument-overflow hints: small static map appending one line to Commander's "too many arguments" error for remaining single-target commands (create, config set, attic restore): name the right form (e.g. create takes one title; one create per bead, see also tbd apply).
d) Replace the tbd-docs.md "ID Not Found" grep recipe (~line 1275) with the did-you-mean/search flow (depends on a+b).

Goldens: did-you-mean output, search by partial ID, create overflow hint.
