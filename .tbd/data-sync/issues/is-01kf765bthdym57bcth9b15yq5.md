---
type: is
id: is-01kf765bthdym57bcth9b15yq5
title: Exit codes return 0 on errors
kind: bug
status: closed
priority: 0
version: 8
labels: []
dependencies: []
created_at: 2026-01-17T23:55:32.551Z
updated_at: 2026-03-09T16:12:31.203Z
closed_at: 2026-01-18T00:58:42.227Z
close_reason: "Fixed: Commands now throw CLIError subclasses instead of calling output.error() + return, ensuring proper non-zero exit codes on errors. Added exit-codes.test.ts with 10 regression tests."
---
All error conditions return exit code 0 instead of non-zero. Commands use this.output.error() + return instead of throwing. Fix: Throw CLIError subclasses instead of returning after output.error().
