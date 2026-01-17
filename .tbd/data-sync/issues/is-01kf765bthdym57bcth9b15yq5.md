---
created_at: 2026-01-17T23:55:32.551Z
dependencies: []
id: is-01kf765bthdym57bcth9b15yq5
kind: bug
labels: []
priority: 0
status: open
title: Exit codes return 0 on errors
type: is
updated_at: 2026-01-17T23:55:32.551Z
version: 1
---
All error conditions return exit code 0 instead of non-zero. Commands use this.output.error() + return instead of throwing. Fix: Throw CLIError subclasses instead of returning after output.error().
