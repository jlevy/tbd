---
type: is
id: is-01m018pzww7e3cs09db1j8hxzy
title: "Preserve single-document JSON output in PR #227 sync notice"
kind: bug
status: closed
priority: 1
version: 2
labels:
  - pr-227
  - json
dependencies: []
created_at: 2026-08-14T23:11:31.739Z
updated_at: 2026-08-14T23:25:36.082Z
closed_at: 2026-08-14T23:25:36.072Z
close_reason: "Fixed JSON channel contract in 7fea4ce9; full local and hosted validation passed; PR #227 merged."
---
The revised surface-honesty notice emits a standalone JSON object to stdout before the normal sync result, so tbd sync --issues --json is no longer a single parseable JSON document. Route the structured notice through the diagnostic channel and add a regression that parses stdout.
