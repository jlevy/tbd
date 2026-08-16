---
type: is
id: is-01kzthhg94pckc5ag8txeq1bem
title: Handle raced owner-install EINVAL without escaping lock acquisition
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - concurrency
  - lockfile
  - macos
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T08:31:08.067Z
updated_at: 2026-08-12T08:56:27.520Z
closed_at: 2026-08-12T08:56:27.520Z
close_reason: "Implemented and fully validated on PR #207 final head: shipped skill tiers and generated mirrors route natural browser requests to agent-run tbd web --open; onboarding, README, manual, design, changelog, CLI, and browser identify a live viewer rather than an editor; minimal skill requires Node 20+; lock acquisition classifies raced macOS EINVAL by generation identity while preserving same-generation errors. Focused tests, 113 files / 1,568 Vitest tests, 1,075 transcripts, strict quality/build, publint, 31 package-age pins, 64,485-byte packed web proof, 5,000/10,001 scale boundaries, and watch-release smoke all pass."
---
Full coverage on macOS reproduced an acquisition race in packages/tbd/src/utils/lockfile.ts runWithPreparedLockGeneration: after mkdir election, rename(preparedOwnerPath, lock/owner) returned EINVAL while multiple waiters recovered the same dead generation. The raw error escaped one contender and left test cleanup non-empty. Map and fix the exact mkdir/install/recovery interleaving, preserving mkdir as sole election, successor safety, bounded progress, and portable macOS/Linux/Windows behavior. Add a deterministic regression in packages/tbd/tests/lockfile*.test.ts and update the design/spec proof.
