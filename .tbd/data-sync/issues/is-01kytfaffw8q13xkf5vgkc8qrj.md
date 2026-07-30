---
type: is
id: is-01kytfaffw8q13xkf5vgkc8qrj
title: "Cut release carrying #195 guidance; verify shipped shortcut and AC1/AC4"
kind: task
status: open
priority: 1
version: 1
labels: []
dependencies: []
parent_id: is-01kytf97zs21wgfaggn8kdmqbx
created_at: 2026-07-30T21:36:38.908Z
updated_at: 2026-07-30T21:36:38.908Z
---
After the #195 PR merges: cut the next release per publishing.md (patch bump per development.md heuristic - guidance-content change). Then verify against the PUBLISHED package: npx get-tbd@latest shortcut setup-github-cli contains the decision rule, egress test, three quoted signals, prefix form (AC1); fresh agent in an egress-open proxied session reaches working gh auth status unaided (AC4). Maintainer-gated: tagging requires main CI green on the merge commit.
