---
type: is
id: is-01m14z4ryc6h68kah2csqf6g0y
title: Repo resolution crosses git boundaries and the ID prefix is ignored on input
kind: bug
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:56:57.164Z
updated_at: 2026-09-14T02:58:55.396Z
---
GH #204. Two data-safety defects in one surface; the observability half of that issue (status printing cwd under 'Repository:', no --repo flag, no repo identity in --json) is lower value and tracked in the same issue.

1. findTbdRoot() (file/config.ts:268-285) walks cwd -> dirname -> ... to the filesystem root looking for .tbd/config.yml, with no .git sentinel and no depth limit. Reproduced in #204 with scratch repos: running tbd from a separate inner git repo with no .tbd/ resolves to the OUTER repo's database, reports 'Repository: .../vendor/inner' with the outer prefix, and materializes outer/.git/tbd/data-sync-worktree, layout.yml and locks/ - a write into a repo the user is not in - exiting 0 with no warning. This contradicts the policy settled in tbd-tgwi ('tbd always operates on the repository containing cwd'); the GIT_DIR half was fixed in #169, the filesystem-walk half is open. Corollary: a stray ~/.tbd/config.yml captures every tbd invocation on the machine.

2. extractShortId() (lib/ids.ts:179-181) strips any alphabetic prefix without comparing it to anything, so in a repo with prefix fsq, 'tbd show tbd-fiba' and 'tbd show zzz-fiba' both return fsq-fiba's issue. extractPrefix() already exists and is correct; its only caller is import.ts:714. Comparing it against ctx.prefix in resolveIssueId() is a few lines at a single chokepoint. Today a foreign-prefix ID usually surfaces as a confusing 'Issue not found'; on a short-id collision (~N/1,679,616 per call) update/close silently mutate the wrong repo's issue.

Fix: keep cwd-based resolution, add a .git sentinel to the walk, and compare the parsed prefix against the repo's at resolveIssueId.

Revision 2026-09-13 (stability sprint plan review, plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md): Place the prefix check in resolveToInternalId (file/id-mapping.ts:556), after the exact-mapping lookup at :566, not in resolveIssueId: show, close, update, reopen, pause, --parent, dep, integration, attic, and board all resolve through resolveAllIds -> resolveToInternalId, so a check in resolveIssueId misses both examples (show zzz-fiba, bulk close). The bd- constant (ids.ts:219) is used only by normalizeIssueId; bd-a7k2 resolves today only because every prefix is stripped, so it needs an explicit allowance. Outside git, status, prime, skill, and requireInit would still adopt a stray ~/.tbd.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): the git-boundary stop breaks agents that work inside nested clones today, including the bundled checkout-third-party-repo shortcut, which clones into attic/<repo> (docs/shortcuts/standard/checkout-third-party-repo.md:25-40), and submodules. Ship an escape hatch (environment variable or -C, see tbd-ziie) or a warning release first.
