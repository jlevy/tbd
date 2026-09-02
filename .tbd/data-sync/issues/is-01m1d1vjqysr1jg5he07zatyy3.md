---
type: is
id: is-01m1d1vjqysr1jg5he07zatyy3
title: Provision gh-stack extension and its official agent skill (pinned)
kind: feature
status: open
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m1d1wd94kmwcbne34nf4f8se
  - type: blocks
    target: is-01m1d1x7ezs8c1q388j419679e
  - type: blocks
    target: is-01m1d1x86a96ak3rzd8w6ft7ej
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
created_at: 2026-08-31T23:18:17.085Z
updated_at: 2026-08-31T23:19:21.685Z
---
tbd provisions no gh extensions or skills, so 'gh stack' is absent on every fresh machine even
though the local dev box has had it for weeks.

WHAT TO PROVISION
1. Extension: gh extension install github/gh-stack --pin v0.1.0
2. Official agent skill: gh skill install github/gh-stack --pin v0.1.0 --agent claude-code

SUPPLY-CHAIN COMPLIANCE
- gh-stack v0.1.0 published 2026-07-29, 33 days old as of 2026-08-31, clears the 14-day cool-off.
- Both commands support --pin, so we pin the exact tag rather than tracking latest, per
  SUPPLY-CHAIN-SECURITY.md rule 6 (no unpinned remote fetch-and-execute).
- github/gh-stack is a GitHub-owned repo, MIT licensed, ~1.4k stars.

DESIGN CONSTRAINTS
- Must be OPT-IN and non-fatal. A stacked-PR extension is not required for tbd to function, and
  SessionStart must not get slower or noisier for users who never stack. Failure to install must
  warn and exit 0, never block the session.
- 'gh skill install' defaults to --scope project, which would write into the user's repo. Decide
  scope deliberately and document it; user scope is likely correct for a per-machine tool.
- Requires gh >= 2.94.0 for the mature skill command set, so this bead depends on the version
  floor work.

Prefer wiring this as an explicit setup step or flag rather than unconditional SessionStart work.
