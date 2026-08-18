---
type: is
id: is-01m0920hptvym7fn204t7s23wc
title: Stale lock records block every command; doctor reports healthy and cleans nothing
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m091zrhym1y81tm7g22hheyh
created_at: 2026-08-17T23:48:20.313Z
updated_at: 2026-08-18T00:05:38.181Z
closed_at: 2026-08-18T00:05:38.181Z
close_reason: Fixed in 8fcbacc3. Selection previews now report why beads were selected (kind vs inherited spec_path) and warn when inheritance dominates; the sync fold defaults to guarded so a plain tbd sync no longer waives the bulk guard; the bridge link record is written before the follow-up round trips that previously left half-written pairs; and doctor reports both abandoned lock sidecars (--fix clears provably dead ones) and beads whose link has no bridge record. 2240 tests pass.
---
A `tbd sync --issues` stopped making progress: 19+ minutes elapsed, 0% CPU, sleeping, no child git or ssh process, no writes under `.git/tbd` for minutes. It held the data-sync lock throughout.

Every later tbd command that needed the lock then blocked indefinitely behind it. That is the damaging part: `tbd integration unlink` looked slow and broken when it was merely queued, which sent the investigation in the wrong direction for a long time. Nothing reported that a lock was held or by whom.

Killed tbd processes leave their owner records behind. Six accumulated under
`.git/tbd/locks/data-sync.lock.owner-<uuid>/record`, each holding JSON naming a host and pid. Five named processes that were long dead. Diagnosis required reading those files by hand and checking each pid with `ps`.

Throughout all of this, `tbd doctor` and `tbd doctor --fix` both reported `Shared lock writability ✓` and `Repository is healthy`, and cleaned nothing.

Asks:

- `tbd doctor` should report lock owner records whose pid is not alive on this host, and `--fix` should clear them. The record already carries host and pid, so the check is cheap and local.
- A command blocking on the lock should say so after a short interval, naming the holding pid, instead of appearing to hang.
- Investigate the root stall: a sync sitting at 0% CPU with no network or child process is a hang, not slowness. Worth finding what it awaits.

Recovery used: kill the pid, then `rm -rf .git/tbd/locks/data-sync.lock.owner-*` and `.stale-*` after verifying each named pid was dead. That is too much internals knowledge to require of a user.
