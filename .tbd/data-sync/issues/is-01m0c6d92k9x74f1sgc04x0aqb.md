---
type: is
id: is-01m0c6d92k9x74f1sgc04x0aqb
title: "sync: fetch writes FETCH_HEAD only, so ahead/behind and push-retry compare a stale remote-tracking ref"
kind: epic
status: open
priority: 0
version: 1
assignee: josh
labels: []
dependencies: []
created_at: 2026-08-19T05:02:55.056Z
updated_at: 2026-08-19T05:02:55.056Z
---
Sync reports "Already in sync" while the remote is hundreds of commits ahead, and a failing push blames "Remote has conflicting changes" when git actually says non-fast-forward. Both come from one line.

ROOT CAUSE
tbd fetches with a destination-less refspec:

  packages/tbd/src/cli/commands/sync.ts:593   await git('fetch', remote, syncBranch)
  packages/tbd/src/file/git.ts:1181           await git(...dirArgs, 'fetch', remote, syncBranch)

`git fetch origin tbd-sync` writes FETCH_HEAD and does NOT update refs/remotes/origin/tbd-sync. But the very next statement compares against the remote-tracking ref:

  sync.ts:596-600   rev-list --count ${remote}/${syncBranch}..${syncBranch}

So the ahead/behind counts are computed against a ref the fetch never advanced. Verified on git 2.50.1, so this is not an old-git quirk.

SYMPTOM 1 — silent stale read (the dangerous one)
`tbd sync --issues` printed "✓ Already in sync" while origin/tbd-sync was 283 commits ahead. After an explicit-destination fetch, the same command pulled 805 new beads and 192 updates. An agent trusting the first result operates on a stale graph: in this case it concluded a bead (tbd-og20) did not exist, when it existed upstream with a full spec.

SYMPTOM 2 — misattributed push failure
The retry loop at git.ts:1181 fetches, calls onMergeNeeded(), then retries the push. Because the fetch never advances the ref the merge integrates from, the merge cannot make progress, all three attempts fail, and the error surfaces as:

  ✗ Push failed: Push failed after 3 attempts. Remote has conflicting changes.

The real git error is:

  ! [rejected] tbd-sync -> tbd-sync (non-fast-forward)
  hint: Updates were rejected because a pushed branch tip is behind its remote counterpart.

There were no conflicting changes — local was strictly behind. The message points away from the fix.

REPRO
  1. Let origin/tbd-sync advance (any other machine or session pushing beads).
  2. git fetch origin tbd-sync
  3. git rev-list --left-right --count tbd-sync...origin/tbd-sync   -> reports 'N 0'
  4. git fetch origin 'refs/heads/tbd-sync:refs/remotes/origin/tbd-sync'
  5. Same rev-list                                                  -> reports 'N 283'

FIX
Give every sync-path fetch an explicit destination, or drop the refspec and rely on the remote's configured one:

  git fetch ${remote} ${syncBranch}:refs/remotes/${remote}/${syncBranch}
  # or: git fetch ${remote}

Audit the other sites using the same form: git.ts lines 1725, 1996, 2072, 2167, 2616, 2713; workspace.ts:294; bead-watch.ts:143. bead-watch matters most after sync — a watcher comparing a stale tip misses wake signals.

Then make the push-failure message name the actual git rejection and the remedy, rather than asserting conflicting changes.

WHY P0
This is a correctness bug in the primitive every agent trusts to know the current graph, and it fails silently in the direction that looks like success. Found during a finterm Linear rollout; the stale read caused a wrong factual conclusion about upstream state before it was caught.
