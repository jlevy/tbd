---
type: is
id: is-01kzn4tzpb4hwkpp9fwdatef5e
title: "Review finding: validate watch durations as safe milliseconds"
kind: bug
status: in_progress
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kzn47zwk7319adecbtgm3n3p
created_at: 2026-08-10T06:12:55.114Z
updated_at: 2026-08-10T06:13:00.807Z
---
PR #205 final branch audit found that decimal or very large --interval/--timeout values can pass parseSeconds and then fail inside gitNoPromptWithTimeout because the derived milliseconds are not a positive safe integer. Validate and convert at the CLI boundary so invalid durations exit as usage errors, with focused regressions.
