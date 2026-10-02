---
type: is
id: is-01m3xhspz0v7d8bmmq2q2e8h55
title: Correct README setup bootstrap ordering
kind: bug
status: closed
priority: 2
version: 4
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-10-02T05:36:07.643Z
updated_at: 2026-10-02T06:50:05.739Z
started_at: 2026-10-02T05:37:11.765Z
closed_at: 2026-10-02T06:50:05.739Z
close_reason: "Merged in formal stack #322 (PR313 and PR321) at bc33631efb2bd95f41e61c1acf1fe63f848f6e56, exactly matching candidate50902c72 tree. Final pinned reviews B313 and D321 posted; all seven checks on both PRs passed. Full local suite3028pass/1skip and final package/bootstrap/downstream proofs recorded in PR321 and durable bootstrap-final evidence. Pre-existing low hook-ordering finding deferred as tbd-twbc; dev advisories retained as documented exceptions. Publication remains tracked separately in tbd-4ccr."
resolution: null
duplicate_of: null
---
Verify standard first-install and existing-project flows, whether the user installs the CLI or explicitly asks the agent to run npm install -g get-tbd@latest. Correct README and setup shortcut ordering. Fix pre-init prime command rendering and handoff to setup-tbd after initialization. Add sequence regression and golden coverage; validate packed CLI installation, prime, setup, post-setup shortcut and existing-project refresh. Changes in README/release owning stack layers, refresh proofs/reviews and push; no merge or release.
