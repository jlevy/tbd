---
type: is
id: is-01kzx2h3ar2mggvq5n23hepeae
title: Prepare and merge v0.5.0 release PR
kind: task
status: closed
priority: 1
version: 4
labels:
  - release
dependencies:
  - type: blocks
    target: is-01kzx2h3wnfbscatsa26ftvb72
parent_id: is-01kzx2gsbxgxck3kfswkb3gn3m
created_at: 2026-08-13T08:06:29.464Z
updated_at: 2026-08-13T08:47:31.313Z
closed_at: 2026-08-13T08:47:31.309Z
close_reason: "Release PR #210 merged at a305a37d after a final senior review found no findings, no unresolved review threads, and all PR checks passed. Exact merge-SHA main CI run 31683046851 then passed Benchmark, Coverage & Lint, Ubuntu, macOS, and Windows, including watch and packed-web proofs."
---
Create the release branch from current main, set package version to 0.5.0, convert Unreleased notes into the authoritative 0.5.0 changelog section, run release and full quality gates, publish the PR, review it, and merge only after hosted CI is green.
