---
type: is
id: is-01m3rnbnmm07dppz3j9dbpn9d9
title: Publish v0.10.0 only after final maintainer review
kind: task
status: open
priority: 2
version: 3
labels: []
dependencies: []
hold: blocked
hold_until: null
created_at: 2026-09-30T08:02:09.683Z
updated_at: 2026-09-30T08:27:51.914Z
---
Await explicit final maintainer approval of the README/release stack. Then follow docs/publishing.md: verify exact PR heads, reviews, formal stack and green CI; merge through gh stack; wait for main CI success on the exact merged candidate commit; check intervening main changes deliberately; verify metadata and clean checkout; push only the v0.10.0 tag; watch release.yml; verify npm provenance, installed CLI version, GitHub Release notes, and post-release setup. Do not merge, tag, publish, dispatch publication, or enable auto-merge while approval is pending. Candidate changes invalidate applicable package/downstream evidence. Release prep evidence: /Users/levy/wrk/release-evidence/tbd-v0.10.0.

## Notes

Final review handoff is ready: PR #321 (https://github.com/jlevy/tbd/pull/321) stacked above #313 in formal stack #322, candidate 72d0bf86a80e9c7d5e07335674e1b3a9fd07333d. Both PRs have all 7 checks passing. Pinned reviews A/B/C report no remaining actionable findings. Do not proceed until the user explicitly approves the final release review. After approval, follow the PR checklist and docs/publishing.md, including exact merged-commit main CI before tagging. Candidate changes invalidate applicable package/downstream proofs. Evidence: /Users/levy/wrk/release-evidence/tbd-v0.10.0.
