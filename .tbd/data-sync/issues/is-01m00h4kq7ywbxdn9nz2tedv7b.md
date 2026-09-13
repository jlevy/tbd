---
type: is
id: is-01m00h4kq7ywbxdn9nz2tedv7b
title: Fix tbd-session.sh PATH order and make hook failure visible
kind: bug
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:19:32.199Z
updated_at: 2026-09-13T23:18:32.134Z
extensions:
  linear:
    id: dc4bbd81-49ba-4668-bf0a-ed5a04e23a86
    linked_at: 2026-08-16T00:13:28.493Z
---
tbd-session.sh (and the .codex twin) does: export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH". Prepending /usr/local/bin shadows the caller's toolchain. Reproduced here: /usr/local/bin/node is v20.20.2 while the session Node is v22.22.2, so 'npx --yes get-tbd@0.6.1 prime' fails the version check and the script exits 1. Claude Code treats a non-zero non-2 SessionStart exit as a non-blocking error whose stderr goes to the debug log, so the agent silently gets no tbd context.

Fix: append rather than prepend the fallback locations; prefer local resolution (node_modules/.bin, then global tbd) before npx; emit {"systemMessage": "..."} on failure so a broken hook is visible.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §1.3, E7

Revision 2026-09-13 (stability sprint plan review, plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md): Compare against Node 22.12, not the major version (22.0-22.11 fail the engines gate). Run the probe before the npx fallback too: tbd_local_can_read_repository returns early when tbd is missing, so the no-local-tbd, old-Node case from the #254 follow-up comment is otherwise uncovered.
