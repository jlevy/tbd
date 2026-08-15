---
type: is
id: is-01kzn4tzpb4hwkpp9fwdatef5e
title: "Review finding: validate watch durations as safe milliseconds"
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01kzn47zwk7319adecbtgm3n3p
created_at: 2026-08-10T06:12:55.114Z
updated_at: 2026-08-15T05:33:40.453Z
closed_at: 2026-08-15T05:33:40.453Z
close_reason: "Shipped in merged PR #205; the final senior review confirmed these findings were addressed."
---
PR #205 final branch audit found that decimal or very large --interval/--timeout values can pass parseSeconds and then fail inside gitNoPromptWithTimeout because the derived milliseconds are not a positive safe integer. Validate and convert at the CLI boundary so invalid durations exit as usage errors, with focused regressions.
