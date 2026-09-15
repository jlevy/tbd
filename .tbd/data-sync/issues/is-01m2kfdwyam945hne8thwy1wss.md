---
type: is
id: is-01m2kfdwyam945hne8thwy1wss
title: "Windows CI: setup-dry-run-state and setup-flows exceed their timeouts on slow runners (red main run on the #288 merge)"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-15T21:26:37.258Z
updated_at: 2026-09-15T21:26:37.258Z
---
Main CI run 35008510725 (push of the #288 merge 49615fa9, 2026-09-15) failed on windows-latest / Node 24 with two timeouts:
- tests/setup-dry-run-state.test.ts "previews migrations, docs, cleanup, and every stale surface without any write": 53.1s against the 45s describe timeout (setup-dry-run-state.test.ts:75)
- tests/setup-flows.test.ts "cleans up legacy scripts during fresh setup": 76.6s; the file took 388s overall

The next main run (#290 merge 1238038e) passed; the same tests took about 8.7s and 4.4s there and 7-13s and 4-6s on the #287 and #289 runs. Neither file changed since v0.8.1, so this is runner speed or suite load, not the sprint PRs. Main CI was green on 27 of its last 30 runs; the other recent failures were the pre-#280 audit step and tests/performance.test.ts "writes single issue in <200ms" (284ms, tracked by tbd-7q6v).

Same family as tbd-2pqp and tbd-n7ll, but Windows-specific and on setup paths. Separate fixture and setup time from the measured work, or give Windows setup tests an explicit budget with a bounded failure message, rather than raising global timeouts. A red main on the release-merge SHA blocks tagging, so this matters for the release run.
