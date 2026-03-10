---
type: is
id: is-01kf7mkvkreram8p0qfna5rskv
title: OutputManager output level methods
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-18T04:08:07.543Z
updated_at: 2026-03-09T16:12:31.545Z
closed_at: 2026-01-18T04:22:15.934Z
close_reason: Added notice() method, updated warn() to respect --quiet, updated info() to require --verbose, updated debug() to require --debug only, added command() method. Comprehensive unit tests added.
---
Add and update OutputManager output level methods:
- Add notice() method - blue bullet, shown at default level
- Update warn() to respect --quiet flag
- Update info() to require --verbose (not default)
- Update debug() to require --debug only (not --verbose)
- Add command() method for external command display

Reference: plan spec section 2.1 (Output Level Definitions)
