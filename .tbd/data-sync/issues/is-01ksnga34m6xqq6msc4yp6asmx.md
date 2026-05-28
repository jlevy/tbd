---
type: is
id: is-01ksnga34m6xqq6msc4yp6asmx
title: "H5: Cleanup - migrate orphaned changeset to release-notes, wire dead helper, fix backups doc"
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies: []
parent_id: is-01ksng8cqv1885jwvg3fagcfph
created_at: 2026-05-27T19:59:13.556Z
updated_at: 2026-05-28T04:13:48.476Z
closed_at: 2026-05-28T04:13:48.475Z
close_reason: null
---
Cleanups, several surfaced by merging post-#121 main (which dropped Changesets for tag-triggered releases via the new cut-release flow).
1. The merge left an orphaned .changeset/shared-common-dir-worktree.md (main deleted .changeset/{README.md,config.json,...}). Move its content — especially the f04 old-client upgrade note ('older pre-f04 tbd clients fail closed; run npm install -g get-tbd@latest on every machine') — into release-notes.md per the new process (see packages/tbd/docs/shortcuts/standard/cut-release.md), then delete .changeset/shared-common-dir-worktree.md. NOTE: once f04 lands, the released tbd (<=0.1.30) cannot operate in a repo that has upgraded — make this prominent in release notes.
2. Wire ensureCommonDirLayout() (packages/tbd/src/file/common-dir-layout.ts:110-121) into H1 so it is no longer dead code.
3. Clarify in packages/tbd/docs/tbd-design.md that production migration backups live under $GIT_COMMON_DIR/tbd/backups/, not .tbd/backups/ (review nit).
4. Optional low-priority nits from the first review if cheap: redundant inline-import of node:fs/promises in sync.ts; the dead non-[0-9A-Za-z-] strip on the filename-timestamp backup branch name in git.ts; the 'didX' captured-flag pattern across close/update/label/dep/attic/create commands.
Acceptance: no orphaned changeset; release-notes.md carries the f04 upgrade warning; no dead ensureCommonDirLayout; backups path doc correct.
