---
type: is
id: is-01m14z4ryc6h68kah2csqf6g0y
title: Repo resolution crosses git boundaries and the ID prefix is ignored on input
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:56:57.164Z
updated_at: 2026-08-28T19:56:57.164Z
---
GH #204. Two data-safety defects in one surface; the observability half of that issue (status printing cwd under 'Repository:', no --repo flag, no repo identity in --json) is lower value and tracked in the same issue.

1. findTbdRoot() (file/config.ts:268-285) walks cwd -> dirname -> ... to the filesystem root looking for .tbd/config.yml, with no .git sentinel and no depth limit. Reproduced in #204 with scratch repos: running tbd from a separate inner git repo with no .tbd/ resolves to the OUTER repo's database, reports 'Repository: .../vendor/inner' with the outer prefix, and materializes outer/.git/tbd/data-sync-worktree, layout.yml and locks/ - a write into a repo the user is not in - exiting 0 with no warning. This contradicts the policy settled in tbd-tgwi ('tbd always operates on the repository containing cwd'); the GIT_DIR half was fixed in #169, the filesystem-walk half is open. Corollary: a stray ~/.tbd/config.yml captures every tbd invocation on the machine.

2. extractShortId() (lib/ids.ts:179-181) strips any alphabetic prefix without comparing it to anything, so in a repo with prefix fsq, 'tbd show tbd-fiba' and 'tbd show zzz-fiba' both return fsq-fiba's issue. extractPrefix() already exists and is correct; its only caller is import.ts:714. Comparing it against ctx.prefix in resolveIssueId() is a few lines at a single chokepoint. Today a foreign-prefix ID usually surfaces as a confusing 'Issue not found'; on a short-id collision (~N/1,679,616 per call) update/close silently mutate the wrong repo's issue.

Fix: keep cwd-based resolution, add a .git sentinel to the walk, and compare the parsed prefix against the repo's at resolveIssueId.
