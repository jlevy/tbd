---
type: is
id: is-01m3xq9vctyfhrx00ez33e2hfn
title: Self-upgrade tbd repository with published v0.10.0 and verify managed docs
kind: task
status: closed
priority: 2
version: 4
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-10-02T07:12:19.341Z
updated_at: 2026-10-02T07:50:39.458Z
started_at: 2026-10-02T07:12:53.844Z
closed_at: 2026-10-02T07:50:39.458Z
close_reason: Completed published v0.10.0 self-upgrade and opened PR323 at0006467fa4533d20aed5640b4cb396cb7d7ff204. All106 managed cache entries match package; repeated setup identical; global CLI and both launchers0.10.0; doctor healthy; installed audit0; full local and push gates3028pass/1skip; all7 PR checks passed in CI36979390135. User requested PR only; left open for review.
resolution: null
duplicate_of: null
---
User requested checkout of origin/main, full published CLI upgrade and setup workflow, verification of docs/agent surfaces and idempotency, and a PR for the generated upgrade. Starting main bc33631e, installed global CLI0.9.0, config0.9.1-dev.52. Use published reviewed get-tbd0.10.0; preserve policy values, repository preferences and customized docs. Record installed audit and validation in PR. No new release or merge requested.

## Notes

Self-upgrade delivered as PR323 https://github.com/jlevy/tbd/pull/323, head0006467fa4533d20aed5640b4cb396cb7d7ff204 based on origin/main bc33631e. Actual global CLI upgraded0.9.0→0.10.0 from the verified published tarball; exact installed dependency tree audit0. Published setup changed only config version/fallback/history. All106 cache entries match package; no forked docs; repeat setup byte-identical; doctor healthy; both session launchers prime0.10.0; policy/preferences unchanged; gh stack tooling and existing Linear connectivity verified. Full pnpm run ci passed192files/3028tests/1existing skip; normal push hooks also passed. Final PR CI36979390135 pending. Evidence /Users/levy/wrk/release-evidence/tbd-v0.10.0/self-upgrade. No new release or merge requested.
