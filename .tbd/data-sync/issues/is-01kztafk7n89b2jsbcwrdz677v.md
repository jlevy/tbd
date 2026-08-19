---
type: is
id: is-01kztafk7n89b2jsbcwrdz677v
title: Document and teach the agent-owned live web viewer
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - docs
  - agent-skill
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T06:27:45.524Z
updated_at: 2026-08-12T08:56:27.501Z
closed_at: 2026-08-12T08:56:27.500Z
close_reason: "Implemented and fully validated on PR #207 final head: shipped skill tiers and generated mirrors route natural browser requests to agent-run tbd web --open; onboarding, README, manual, design, changelog, CLI, and browser identify a live viewer rather than an editor; minimal skill requires Node 20+; lock acquisition classifies raced macOS EINVAL by generation identity while preserving same-generation errors. Focused tests, 113 files / 1,568 Vitest tests, 1,075 transcripts, strict quality/build, publint, 31 package-age pins, 64,485-byte packed web proof, 5,000/10,001 scale boundaries, and watch-release smoke all pass."
---
Close the installed-user discovery gap for tbd web. File/function map: packages/tbd/docs/shortcuts/system/skill-baseline.md User Request -> Agent Action routing and operator contract; skill-brief.md and skill-minimal.md compact capability maps; packages/tbd/docs/shortcuts/standard/welcome-user.md onboarding examples; packages/tbd/docs/tbd-docs.md Web reference; README.md product/command guidance; packages/tbd/src/cli/commands/web.ts startup descriptor and help if needed; packages/tbd/src/web/* viewer copy if needed; packages/tbd/tests/integration-files.test.ts, cli-doc-output.tryscript.md, cli-web.tryscript.md, and setup/package tests for shipped-surface proof. Required contract: when a user naturally asks to see/open beads in a browser, the agent runs tbd web --open (or tbd web when opening is not requested), keeps the foreground process alive, gives the URL, and makes all bead changes itself with ordinary tbd commands. The browser has no edit semantics or remote polling; it updates from local bead state, including explicit tbd sync results.
