---
type: is
id: is-01m0ph87bfgn96fgmvg1sjs8kg
title: Author release-engineering-rules guideline
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0ph9qz8k04837d6s7s5dwvr
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:24:48.111Z
updated_at: 2026-08-23T08:34:58.458Z
closed_at: 2026-08-23T08:34:58.458Z
close_reason: "Completed in PR #258 (branch claude/rust-guidelines-extraction-o9x2yy)."
resolution: null
duplicate_of: null
---
New language-neutral guideline from the thirteen neutral sections of the playbook's rust-release-rules: release identity, clean pre-release gate, deliberate automation, minimal workflow authority, cool-off for release tooling, build once per target, predictable packaging, smoke-testing the packaged artifact, channels chosen by audience, multi-channel coordination without rebuilding, release logic tested outside the workflow, and incident preparation. Absorbs this repo's practice from release.yml, publint, release:verify, and the packed upgrade proof in CI. Complements release-notes-guidelines, which covers notes only.
