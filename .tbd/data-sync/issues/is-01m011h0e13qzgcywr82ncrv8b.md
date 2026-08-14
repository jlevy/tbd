---
type: is
id: is-01m011h0e13qzgcywr82ncrv8b
title: Repair empty cloned data worktrees during setup
kind: bug
status: in_progress
priority: 1
version: 3
labels: []
dependencies: []
created_at: 2026-08-14T21:05:55.648Z
updated_at: 2026-08-14T21:46:09.625Z
---
A fresh clone of jlevy/tryscript at 0.4.2/f06 has an empty remote tbd-sync branch whose shared worktree lacks .tbd/data-sync/{issues,mappings}. tbd 0.6.3 prime and setup both report the worktree healthy, but tbd create fails with Shared worktree not found. Make setup/initialization repair the missing current data layout automatically, align doctor/status with create, add regression coverage, release the patch, then retry the downstream upgrade from a fresh clone.

## Notes

Downstream replay found the branch was not merely empty: tryscript's tbd-sync history held 176 issues and mappings that a legacy sync later removed. The 0.6.4 fix restores missing historical data without overwriting existing files, initializes branches that never had a scaffold, resumes interrupted recovery, reports restored file count, and adds packed 0.6.3/0.4.2/0.5.0 plus legacy-remote upgrade QA. Exact local-mirror tryscript proof restored 181 files/176 issues, created and pushed a new issue, preserved legacy files, kept generated scripts release-literal-free, and produced a byte-identical repeated setup. Full CI: 136 files, 2016 tests passed.
