---
type: is
id: is-01m0c6d92k9x74f1sgc04x0aqb
title: "sync: fetch writes FETCH_HEAD only, so ahead/behind and push-retry compare a stale remote-tracking ref"
kind: epic
status: closed
priority: 0
version: 5
assignee: josh
labels: []
dependencies: []
created_at: 2026-08-19T05:02:55.056Z
updated_at: 2026-08-26T07:15:44.042Z
closed_at: 2026-08-26T07:15:44.041Z
close_reason: |-
  Fixed before v0.8.0; verified against the code and by running this bead's own repro on the 0.8.1 build.

  ROOT CAUSE — fixed. The prescribed fix ("give every sync-path fetch an explicit destination") is implemented as trackingRefspec() in src/file/git.ts:867, returning refs/heads/<branch>:refs/remotes/<remote>/<branch>. Introduced in 191b584e, which predates v0.8.0.

  Every fetch in src/ now carries an explicit destination — both sites this bead named and ten others:
    - sync.ts:594 (the site cited as :593), plus 652, 767, 1127
    - git.ts:1233 (the retry loop cited as :1181), plus 1777, 2048, 2124, 2219, 2668, 2765
    - workspace.ts:300
    - bead-watch.ts:143 fetches into a private ref with --refmap= and --no-write-fetch-head; that is the read-only observer's Git isolation contract, not this defect.

  SYMPTOM 1 (silent stale read) — fixed. sync.ts:594 fetches with the tracking refspec immediately before the rev-list at :597-605 compares against ${remote}/${syncBranch}, so the comparison now reads a ref the fetch actually advanced.

  SYMPTOM 2 (misattributed push failure) — fixed by the same change. The retry loop at git.ts:1233 fetches with the tracking refspec before onMergeNeeded(), so the merge can advance local syncBranch and the next push fast-forwards. The strictly-behind case converges instead of exhausting all three attempts, so it no longer reaches the "Remote has conflicting changes" message, which is now only produced when a merge genuinely fails.

  REPRO, re-run on git 2.43.0. The destination-less form only loses the ref when the remote's configured refspec does not cover tbd-sync (a single-branch clone). In a full clone git updates the tracking ref opportunistically, which is why this reproduced intermittently. Under a narrow refspec (+refs/heads/main:refs/remotes/origin/main):
    - git fetch origin tbd-sync           -> FETCH_HEAD advanced; refs/remotes/origin/tbd-sync absent
    - git fetch origin refs/heads/tbd-sync:refs/remotes/origin/tbd-sync -> tracking ref written

  End-to-end on that same single-branch clone with the 0.8.1 build, remote 1 commit ahead:
    tbd sync --status -> "↓ 1 commit(s) behind (to pull)" and named the remote commit. It did not report "Already in sync".
    tbd sync          -> "received 3 new, 1 updated"; 7 beads -> 10, converged with the remote tip.

  Related but separate, left open: tbd-az97 (handle missing origin/tbd-sync in single-branch clones).
resolution: null
duplicate_of: null
extensions:
  linear:
    id: b5a35ee8-341e-4988-aac6-fa5202af4d4a
    linked_at: 2026-08-19T16:27:24.388Z
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
