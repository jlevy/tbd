---
type: is
id: is-01m3rnbnmm07dppz3j9dbpn9d9
title: Publish v0.10.0 only after final maintainer review
kind: task
status: closed
priority: 2
version: 8
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-30T08:02:09.683Z
updated_at: 2026-10-02T07:07:54.066Z
started_at: 2026-10-02T05:32:18.246Z
closed_at: 2026-10-02T07:07:54.065Z
close_reason: v0.10.0 published and verified on npm and GitHub; exact-commit CI, workflow, CLI, runtime audit, provenance and release-note checks passed.
resolution: null
duplicate_of: null
---
Await explicit final maintainer approval of the README/release stack. Then follow docs/publishing.md: verify exact PR heads, reviews, formal stack and green CI; merge through gh stack; wait for main CI success on the exact merged candidate commit; check intervening main changes deliberately; verify metadata and clean checkout; push only the v0.10.0 tag; watch release.yml; verify npm provenance, installed CLI version, GitHub Release notes, and post-release setup. Do not merge, tag, publish, dispatch publication, or enable auto-merge while approval is pending. Candidate changes invalidate applicable package/downstream evidence. Release prep evidence: /Users/levy/wrk/release-evidence/tbd-v0.10.0.

## Notes

Published and verified v0.10.0 under the explicit user authorization. PR313/321 merged via gh stack322 at bc33631efb2bd95f41e61c1acf1fe63f848f6e56. Exact-merge main CI36975306796 passed before tag creation via gh API. Release workflow36976277456 succeeded. npm latest=0.10.0; isolated published install reports0.10.0; runtime audit0; downloaded tarball integrity matches registry; provenance subject digest, merge commit and release.yml match; stable GitHub release notes exactly match committed CHANGELOG section. Published setup refresh matches reviewed candidate byte-for-byte. No repository format bump (remains f08), so no post-release format stamp commit required. Durable evidence /Users/levy/wrk/release-evidence/tbd-v0.10.0/bootstrap-final. Release https://github.com/jlevy/tbd/releases/tag/v0.10.0. Remaining pre-existing items: tbd-twbc hook ordering, tbd-b24q dev advisories, tbd-fnwc hook visibility.
