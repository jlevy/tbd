---
type: is
id: is-01m3rnbnmm07dppz3j9dbpn9d9
title: Publish v0.10.0 only after final maintainer review
kind: task
status: in_progress
priority: 2
version: 5
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-30T08:02:09.683Z
updated_at: 2026-10-02T06:10:43.550Z
started_at: 2026-10-02T05:32:18.246Z
---
Await explicit final maintainer approval of the README/release stack. Then follow docs/publishing.md: verify exact PR heads, reviews, formal stack and green CI; merge through gh stack; wait for main CI success on the exact merged candidate commit; check intervening main changes deliberately; verify metadata and clean checkout; push only the v0.10.0 tag; watch release.yml; verify npm provenance, installed CLI version, GitHub Release notes, and post-release setup. Do not merge, tag, publish, dispatch publication, or enable auto-merge while approval is pending. Candidate changes invalidate applicable package/downstream evidence. Release prep evidence: /Users/levy/wrk/release-evidence/tbd-v0.10.0.

## Notes

User explicitly authorized merging the ready stack and publishing the next minor release in this conversation, and confirmed existing gh credentials. Proceed with v0.10.0 after final candidate checks, formal reviews and exact-head CI. Current candidate d2266690f3ca08ad99b3a448adade1488ef249ce above README 60e2dee573706c300b09ef67279736d05bdee19e; pre-push checks currently running. Follow docs/publishing.md: stack merge, exact merged-commit main CI success, deliberate intervening-main check, tag v0.10.0, watch release workflow, verify npm provenance/version and release notes, post-release setup. No additional approval needed for this one release.
