---
type: is
id: is-01m3rnbnmm07dppz3j9dbpn9d9
title: Publish v0.10.0 only after final maintainer review
kind: task
status: in_progress
priority: 2
version: 6
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-30T08:02:09.683Z
updated_at: 2026-10-02T06:50:06.115Z
started_at: 2026-10-02T05:32:18.246Z
---
Await explicit final maintainer approval of the README/release stack. Then follow docs/publishing.md: verify exact PR heads, reviews, formal stack and green CI; merge through gh stack; wait for main CI success on the exact merged candidate commit; check intervening main changes deliberately; verify metadata and clean checkout; push only the v0.10.0 tag; watch release.yml; verify npm provenance, installed CLI version, GitHub Release notes, and post-release setup. Do not merge, tag, publish, dispatch publication, or enable auto-merge while approval is pending. Candidate changes invalidate applicable package/downstream evidence. Release prep evidence: /Users/levy/wrk/release-evidence/tbd-v0.10.0.

## Notes

The user explicitly authorized merging the ready stack and publishing v0.10.0 and confirmed existing gh credentials. Final candidate50902c7283fba9b07a3bb4b58fd3f8fe8d7de867 passed normal push hooks, all PR CI, independent follow-up review, package proofs and downstream rehearsal with documented unchanged dev-audit exception. gh stack merge322 merged PR313/321 at bc33631efb2bd95f41e61c1acf1fe63f848f6e56; tree exactly equals tested candidate. Main CI36975306796 is running on that exact SHA. Next: require success, check later main commits, create only v0.10.0 via gh refs API, watch release.yml, verify npm/provenance, published installed CLI and exact release notes. No additional approval needed for this one release. Evidence /Users/levy/wrk/release-evidence/tbd-v0.10.0/bootstrap-final. Pre-existing hook ordering tracked tbd-twbc; runtime audit zero.
