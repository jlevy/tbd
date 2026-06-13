---
type: is
id: is-01ktyeyq1dtcf43nhztp4jqg4v
title: "Remove the git: scheme from docref v0.1"
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesqrj67qgwjvcg8mggkcg
created_at: 2026-06-12T17:44:23.853Z
updated_at: 2026-06-12T18:20:36.662Z
closed_at: 2026-06-12T18:20:36.662Z
close_reason: "Fixed in 6b6949e: git: scheme removed from docref v0.1 (was unresolvable and mis-parsed hosts); docstring notes future protocols may be added. Spec mentions updated in e8b5112."
---
PR #169 review sec 4. git:owner/repo//path has no hostname (unresolvable) and git:host.com/owner/repo//path mis-parses (owner=host.com). Drop the scheme; docstring note that additional protocols (host-bearing git form, other forges) may be added in future versions.
