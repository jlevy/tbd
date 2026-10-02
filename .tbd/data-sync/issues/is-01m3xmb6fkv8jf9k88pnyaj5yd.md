---
type: is
id: is-01m3xmb6fkv8jf9k88pnyaj5yd
title: Use subprocess fixture budget for setup-hook functional tests
kind: task
status: closed
priority: 2
version: 3
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-10-02T06:20:37.732Z
updated_at: 2026-10-02T06:50:05.745Z
started_at: 2026-10-02T06:21:17.005Z
closed_at: 2026-10-02T06:50:05.745Z
close_reason: "Merged in formal stack #322 (PR313 and PR321) at bc33631efb2bd95f41e61c1acf1fe63f848f6e56, exactly matching candidate50902c72 tree. Final pinned reviews B313 and D321 posted; all seven checks on both PRs passed. Full local suite3028pass/1skip and final package/bootstrap/downstream proofs recorded in PR321 and durable bootstrap-final evidence. Pre-existing low hook-ordering finding deferred as tbd-twbc; dev advisories retained as documented exceptions. Publication remains tracked separately in tbd-4ccr."
resolution: null
duplicate_of: null
---
Release validation repeatedly hits legacy 15-second setup-hooks deadlines on mandated external scratch, including cleanup racing timed-out writes. Diagnose whether behavior is wrong; if only fixture timing, align with shared subprocessTestTimeout helper for multi-setup functional cases without relaxing explicit performance assertions. Capture rerun and normal push results. Part of v0.10.0 release readiness.
