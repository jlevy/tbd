---
type: is
id: is-01kzpbwxn4kkdjsaqc9tn243w5
title: Tryscript suite is non-deterministic under full parallel runs
kind: bug
status: open
priority: 2
version: 2
labels: []
dependencies: []
created_at: 2026-08-10T17:35:33.027Z
updated_at: 2026-08-10T17:35:44.810Z
---
Running `pnpm --filter get-tbd test:tryscript` on identical code produces a
different set of failures each time.

Observed on branch claude/linear-integration, four consecutive runs, no code
change between them:

| Run | Duration | Failures |
| --- | --- | --- |
| 1 | 2351s | 2 (cli-sync-migration-bug, cli-sync-unrelated-rescue) |
| 2 | 346s | 3 |
| 3 | ~380s | 0 |
| 4 | 382s | 1 |

Every failing file passes deterministically when run in isolation:

    pnpm --filter get-tbd exec tryscript run tests/cli-sync-migration-bug.tryscript.md
    pnpm --filter get-tbd exec tryscript run tests/cli-sync-unrelated-rescue.tryscript.md

Both pass, 18/18 and 12/12.

All observed failures are in sync/worktree/git-heavy scripts. The likely cause is
contention between parallel tryscript sandboxes doing concurrent git operations,
but this is NOT root-caused. It should not be assumed benign: an intermittent
failure in the sync tests could equally be masking a real race in the sync code.

Next steps:
- Determine whether tryscript runs files in parallel and whether the degree is
  configurable.
- Capture the actual assertion diff from a failing parallel run (the summary
  output alone does not include it).
- Check for shared state between sandboxes: global git config, TMPDIR reuse,
  or a shared GIT_COMMON_DIR.
