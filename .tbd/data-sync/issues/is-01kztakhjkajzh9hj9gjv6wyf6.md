---
type: is
id: is-01kztakhjkajzh9hj9gjv6wyf6
title: Correct the shipped minimal skill Node compatibility claim
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - docs
  - agent-skill
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T06:29:54.898Z
updated_at: 2026-08-12T08:56:27.511Z
closed_at: 2026-08-12T08:56:27.511Z
close_reason: "Implemented and fully validated on PR #207 final head: shipped skill tiers and generated mirrors route natural browser requests to agent-run tbd web --open; onboarding, README, manual, design, changelog, CLI, and browser identify a live viewer rather than an editor; minimal skill requires Node 20+; lock acquisition classifies raced macOS EINVAL by generation identity while preserving same-generation errors. Focused tests, 113 files / 1,568 Vitest tests, 1,075 transcripts, strict quality/build, publint, 31 package-age pins, 64,485-byte packed web proof, 5,000/10,001 scale boundaries, and watch-release smoke all pass."
---
packages/tbd/docs/shortcuts/system/skill-minimal.md advertises Node.js 18+, while packages/tbd/package.json and all current install docs require Node.js >=20. Update the source skill compatibility metadata and add a distribution assertion so an installed skill cannot route a user to an unsupported runtime.
