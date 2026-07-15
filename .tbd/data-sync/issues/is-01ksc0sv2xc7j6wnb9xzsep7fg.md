---
type: is
id: is-01ksc0sv2xc7j6wnb9xzsep7fg
title: Align CLI agent skill guidelines with implementation
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - guidelines
  - agent-skills
dependencies:
  - type: blocks
    target: is-01ksc0thbsjf1629exkpyd5xn7
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:02.492Z
updated_at: 2026-07-15T05:59:29.757Z
closed_at: 2026-07-15T05:59:29.756Z
close_reason: "Superseded by tbd-va8i: the refreshed core/references and generated-surface validation cover the remaining guideline-alignment scope; no distinct runtime work remains in this bead."
---
packages/tbd/docs/guidelines/cli-agent-skill-patterns.md. Reconcile remaining drift after impl lands (paths, Codex hook events, flag names, format-version guard, Tier-1 vs Tier-2 model, shared-script pattern). Much already updated in this PR; finalize to match shipped behavior.

## Notes

2026-07-15 review: GitHub #190 guideline refresh is now tracked by tbd-va8i. Do not implement overlapping cli-agent-skill-patterns edits from this bead in parallel. Preserve the prior downstream notes, but after tbd-va8i lands either close this bead as superseded or narrow it to any concrete shipped-behavior alignment still missing from plan-2026-05-24-multi-agent-skills-hooks-setup.md.
