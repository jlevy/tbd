---
type: is
id: is-01m3ren0pk7gkjdr6mx37bdxe6
title: Preserve unrelated Codex hook entries and refuse unsafe hooks targets
kind: bug
status: closed
priority: 1
version: 6
delegate: claude-code@spud10.local
labels: []
dependencies:
  - type: blocks
    target: is-01m3rkx8y1t5z3kbnxjsc89nqf
hold: null
hold_until: null
created_at: 2026-09-30T06:04:55.890Z
updated_at: 2026-10-02T06:50:05.757Z
started_at: 2026-09-30T07:40:06.456Z
closed_at: 2026-10-02T06:50:05.757Z
close_reason: "Merged in formal stack #322 (PR313 and PR321) at bc33631efb2bd95f41e61c1acf1fe63f848f6e56, exactly matching candidate50902c72 tree. Final pinned reviews B313 and D321 posted; all seven checks on both PRs passed. Full local suite3028pass/1skip and final package/bootstrap/downstream proofs recorded in PR321 and durable bootstrap-final evidence. Pre-existing low hook-ordering finding deferred as tbd-twbc; dev advisories retained as documented exceptions. Publication remains tracked separately in tbd-4ccr."
resolution: null
duplicate_of: null
---
Pre-existing at stack base a92ecab9, found while reviewing #309. setup.ts inspect/installCodexHooks treats any .codex/ command as tbd-owned, removes whole mixed entries, treats malformed JSON as missing, and lacks the target checks applied to Claude surfaces. Bound fix: exact generated-command ownership, preserve unrelated hooks even in mixed entries, reject malformed/non-regular/linked targets before writes; add CLI preservation/refusal regressions. Track independently of review N6 dead-handler cleanup.

## Notes

Implemented in PR #321 (https://github.com/jlevy/tbd/pull/321), formal stack #322 above README #313, head 72d0bf86a80e9c7d5e07335674e1b3a9fd07333d. Exact hook ownership, mixed-entry preservation and preflight refusal regressions pass. Full suite: 3,028 passed, 1 existing skip. Independent security review B found no remaining issue. Keep open until merge; final user review is pending.
