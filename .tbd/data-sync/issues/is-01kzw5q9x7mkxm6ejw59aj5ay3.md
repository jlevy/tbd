---
type: is
id: is-01kzw5q9x7mkxm6ejw59aj5ay3
title: Normalize CRLF before centralized front-matter YAML parsing
kind: bug
status: closed
priority: 0
version: 2
labels:
  - release
  - windows
dependencies: []
parent_id: is-01kzvr00wp6yqv6cbhgagx0ve8
created_at: 2026-08-12T23:43:04.102Z
updated_at: 2026-08-12T23:58:50.188Z
closed_at: 2026-08-12T23:58:50.187Z
close_reason: "PR #209 is release-ready: the Windows CRLF regression is fixed, local and hosted suites are green on all platforms, packaging/install smoke passed, all review threads are resolved, and the reviewed package is installed globally. The js-yaml version follow-up remains separately deferred and non-blocking because its parser path is unreachable."
---
PR #209 Windows CI shows every guideline category parsed with a trailing newline after checkout converts files to CRLF. gray-matter retains the carriage return immediately before its closing delimiter, and the yaml engine preserves it in the final plain scalar. Normalize CRLF/CR only inside the centralized YAML engine parse callback, preserving Markdown body bytes, add a platform-independent regression, and rerun Windows plus full CI.
