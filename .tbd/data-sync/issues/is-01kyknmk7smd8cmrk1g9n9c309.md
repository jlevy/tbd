---
type: is
id: is-01kyknmk7smd8cmrk1g9n9c309
title: create/update --spec accepts basename/suffix like list --spec (fix write/read asymmetry)
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-07-28T06:12:20.857Z
updated_at: 2026-07-29T02:56:22.973Z
closed_at: 2026-07-29T02:56:22.973Z
close_reason: "Delivered in PR #198 (agent CLI ergonomics round 2): bulk show, variadic doc readers, variadic deps + create --depends-on, --spec suffix matching, did-you-mean/search-by-ID/overflow hints, point-of-need doc pass. All suites green."
---
Fix the --spec write/read asymmetry (spec finding E, hit while dogfooding).

- create --spec / update --spec: try literal repo-relative path first (unchanged); if not found, resolve unique basename/suffix against the spec directories using the SAME matcher list --spec uses (extract it to a shared lib module).
- Ambiguous suffix -> error listing all candidates; no match -> current File-not-found error.
- Makes the filename-only form documented in the new-plan-spec shortcut actually work; verify shortcut wording after.

Goldens: basename resolves; ambiguous suffix errors with candidates; exact path unchanged. Vitest for the shared matcher if extracted.
