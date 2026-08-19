---
type: is
id: is-01kzpbwxn4kkdjsaqc9tn243w5
title: "doctor --fix: migration commit intermittently missing from the sync-branch tip"
kind: bug
status: closed
priority: 1
version: 9
labels: []
dependencies: []
created_at: 2026-08-10T17:35:33.027Z
updated_at: 2026-08-11T19:55:59.822Z
closed_at: 2026-08-11T19:55:59.820Z
close_reason: "Root-caused and fixed in 67766818. Not a product bug and not timing: eleven sync tryscripts created their bare origin at ../origin.git, which from a sandbox is the SHARED temp parent — every run reused prior runs' origin, a later setup sync pulled the stale tbd-sync, the fixed-id test files arrived already tracked, add -A staged nothing, and migration correctly recorded nothing. Intermittency = whether a stale origin survived from any earlier run (same machine, or earlier in the same CI job — explaining the load correlation as coincidence and the CI order-dependence). Fixed with per-file origins removed before creation; migration test passes every run; full suites green. The earlier hardening (64767eab) remains valuable: verify-before-delete is what made this diagnosable instead of silently destructive."
---
Root-caused as far as the evidence allows. This is **not** test flakiness in the
usual sense, and two earlier hypotheses in this bead were wrong.

## What was ruled out

- **Parallel contention between test files.** tryscript runs files serially
  (`for (const filePath of testFiles)` in its `dist/bin.mjs`). There is no
  cross-file parallelism to contend for.
- **Timeouts.** The suspect files declare `timeout: 60000` and complete in about
  6s each in isolation. The observed failures are assertion mismatches, not
  timeouts.
- **Leaked sandboxes or disk exhaustion.** Sandboxes are cleaned up; TMPDIR held
  only 338M.

## What actually fails

Reproduced under CPU load (8 spin loops on a 10-core machine) in
`cli-sync-migration-bug.tryscript.md`, three assertions in one run:

```
✗ Check worktree git status - should have committed migration
  @@ -1,1 +1,1 @@
  -[..] tbd: migrate [..] file(s) from incorrect location
  +b69a0b6 tbd sync: 2026-08-10T22-46-47 (3 files)

✗ Check local sync branch - should point to migration commit   (same diff)

✗ Check ahead count - should be at least 1 commit ahead of remote
  Expected exit code 0, got 1
```

After `tbd doctor --fix`, the tip of the sync branch was the *setup's* sync
commit rather than the migration commit, and the branch was not ahead of the
remote. The preceding assertion ("migration created files in correct worktree
location") still passed, because it is a filesystem check: the files moved, but
the commit recording that move was not at the tip.

## Lead worth pulling

A clean `doctor --fix` run leaves an uncommitted change behind:

```
$ git -C <worktree> status --porcelain
 M .tbd/data-sync/mappings/ids.yml
```

Any later operation that commits pending worktree state produces a
`tbd sync: ...` commit. If that can interleave with, or substitute for, the
dedicated migration commit, it explains the observed tip exactly.

## Why it matters

The affected code is `doctor --fix` migration and sync commit sequencing, not
integration work. An intermittently missing commit on the sync branch means a
migration can appear to succeed on disk while never being recorded, which is a
correctness problem rather than a test problem.

## Reproduction

```
cd packages/tbd
# generate load: 8 background spin loops on a 10-core machine
pnpm exec tryscript run tests/cli-sync-migration-bug.tryscript.md
```

Intermittent: roughly one run in three under load, clean without it. Full-suite
runs on identical code have produced 2, 3, 0, 1, and 0 failures.

## Note for whoever picks this up

Three CI failures were initially blamed on this bead and were unrelated: they
were deterministic golden mismatches from the integration branch (a new `tbd
integration` command in `--help`, two new `doctor` checks, a new docs section),
fixed in bca0cbcd. Read the diff before attributing a failure here.

## Notes

Partial progress in 64767eab. The silent-and-destructive failure mode is removed: migrateDataToWorktree now verifies files are recorded in the committed tree before deleting the source, and reports committed true/false rather than assuming. The intermittency itself is NOT fixed and this bead stays open. Repro harness checked in at packages/tbd/scripts/repro-migration-commit.sh; it has not yet caught the failure. Ruled out with evidence: serial test execution (no cross-file parallelism), timeouts (60s allowed vs ~6s actual), sandbox leaks/disk, and CPU load alone (load 15.98 on 10 cores, 8-10 iterations, no reproduction).
