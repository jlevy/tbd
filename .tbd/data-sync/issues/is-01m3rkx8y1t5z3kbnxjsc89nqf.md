---
type: is
id: is-01m3rkx8y1t5z3kbnxjsc89nqf
title: Prepare v0.10.0 release candidate stacked on README PR313
kind: task
status: closed
priority: 1
version: 6
delegate: claude-code@spud10.local
labels: []
dependencies:
  - type: blocks
    target: is-01m3rnbnmm07dppz3j9dbpn9d9
hold: null
hold_until: null
created_at: 2026-09-30T07:36:49.343Z
updated_at: 2026-10-02T06:50:05.771Z
started_at: 2026-09-30T07:37:43.900Z
closed_at: 2026-10-02T06:50:05.771Z
close_reason: "Merged in formal stack #322 (PR313 and PR321) at bc33631efb2bd95f41e61c1acf1fe63f848f6e56, exactly matching candidate50902c72 tree. Final pinned reviews B313 and D321 posted; all seven checks on both PRs passed. Full local suite3028pass/1skip and final package/bootstrap/downstream proofs recorded in PR321 and durable bootstrap-final evidence. Pre-existing low hook-ordering finding deferred as tbd-twbc; dev advisories retained as documented exceptions. Publication remains tracked separately in tbd-4ccr."
resolution: null
duplicate_of: null
---
Prepare the next minor release using docs/publishing.md: inventory v0.9.0 delta and blockers; update version/changelog; audit dependencies; run package, upgrade, downstream, metadata and CI gates; create and formally link an upper PR to #313. User requires final review before tag/publish; do not merge, tag, publish, or enable automatic release. Record exact candidate evidence and remaining post-approval steps.

## Notes

Release preparation delivered in https://github.com/jlevy/tbd/pull/321, formal stack #322 above README #313. Frozen head: 72d0bf86a80e9c7d5e07335674e1b3a9fd07333d; all 7 checks passed in CI run 36688356396. Senior Sol review A, independent security B and correctness C are published with no remaining actionable findings. Local suite: 3,028 passed, 1 skip; 52 setup/recovery regressions passed. Release build/publint, all packed upgrade scenarios, web, metadata and clean-source gates passed. Fresh tryscript base 1ffbe8fa5e8390501158826e62bae1b739aac454 upgraded from configured tbd 0.7.1; repeated setup was byte-identical; all functional/package gates and 252 unit tests passed; complete verify stops at the exact same 6 pre-existing dev advisories. Runtime audit clean; unchanged development lockfile has 45 advisories tracked in tbd-b24q. Explicitly deferred: tbd-fnwc, remaining coordination/native-comment/f09 roadmap and PRs #253/#174/#21. Evidence and exact tarball: /Users/levy/wrk/release-evidence/tbd-v0.10.0. Keep stack work pending merge per workflow. Publication handoff tbd-4ccr is blocked until explicit final maintainer approval; no merge, tag, publish, dispatch or auto-merge performed.
