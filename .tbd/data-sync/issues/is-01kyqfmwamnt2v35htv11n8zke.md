---
type: is
id: is-01kyqfmwamnt2v35htv11n8zke
title: "PR #198 Bugbot round: create --depends-on hint, bulk-show stale hint, docs show bundled dedupe"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyqdkenfn9rswm3s44vg11j8
created_at: 2026-07-29T17:44:36.434Z
updated_at: 2026-07-29T18:04:24.981Z
closed_at: 2026-07-29T18:04:24.981Z
close_reason: "Review addressed on PR #198: R1-R4 + docs gap fixed in 69b6ec8, Bugbot round-1 trio fixed in 52c9856, Bugbot round-2 pair rebutted in-thread with technical justification. Disposition map posted; CI green on all checks at 52c9856."
---
Three Bugbot findings on 69b6ec8, all polish on this PR's own additions:
1. (Medium) create --depends-on unknown ID throws plain ValidationError without the did-you-mean hint other boundaries now have (create.ts ~161).
2. (Low) bulk show stale-mapping path (ID resolves, file missing, no --ignore-missing) throws NotFoundError without the hint (show.ts ~268).
3. (Medium) docs show multi dedupes only by path; bundled root docs have empty path so `tbd docs show tbd-docs tbd-docs` renders twice (docs.ts ~341). Fix: name-level dedupe as well.
Also: Windows CI failed on the new fault-injection test (atomically's EPERM retry on rename-over-directory exceeds the 5s timeout) -> platform-skip that single test on win32; contract stays covered on POSIX.
