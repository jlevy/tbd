---
type: is
id: is-01kyss4hn2a5jk59b5wh14e4wr
title: "Bugbot: single-ID show --ignore-missing emits no JSON on stdout"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-07-30T15:08:55.840Z
updated_at: 2026-07-30T15:17:57.254Z
closed_at: 2026-07-30T15:17:57.253Z
close_reason: "Fixed in aad6c47 on PR #198: showSingle's two --ignore-missing returns now emit JSON null via a shared reportSingleSkip helper, keeping stdout parseable (bulk emits [], mutators their summary). Text mode byte-identical. Goldens pin null, the stderr warning shape, and bulk []. Manual, design doc, and CHANGELOG note the shapes. Replied on the Bugbot thread."
---
Bugbot round 3 on PR #198 (commit 690ce49, bug 6b0d6ae2): tbd show with one unknown ID and --ignore-missing warns on stderr and exits 0 but writes nothing to stdout in --json mode, so piped consumers get unparseable empty output. The bulk path emits [] when every ID is skipped and the bulk mutators always emit their results/summary object, so the single-ID read is the one inconsistent case. Fix: emit JSON null (the found value is absent) from both ignore-missing early returns in showSingle, keeping text mode byte-identical (stderr warn only). Pin with a golden and note the shape in tbd-docs and tbd-design.
