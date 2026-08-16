---
type: is
id: is-01kzycnk9d3twwpm9az84tvfan
title: Ensure full bidirectional sync writes the Linear managed block
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzy93y91gssqs5nbv6zga00g
created_at: 2026-08-13T20:22:57.068Z
updated_at: 2026-08-13T20:50:48.496Z
closed_at: 2026-08-13T20:50:48.495Z
close_reason: Fixed on codex/linear-managed-block-markers. Full bidirectional sync now treats the managed region as a provider projection, journals and applies an idempotent splice after prose updates, backfills missing/stale/legacy regions, updates provider timestamps, and quarantines malformed pairs before any field or comment write. Regression coverage proves backfill, prose preservation, one current pair, and fail-closed containment. The complete 11-scenario Linear API QA and 1,973-test CI gate pass.
---
The strengthened API-driven Linear QA passed setup/import/deferred-claim but failed the tbd-to-provider scenario because a full integration sync updated native fields and human prose without emitting the current managed-block delimiters. One-way --push does emit them. Add a failing sync-engine regression, make the full reconciliation path splice the same current managed region without clobbering human prose, and rerun the complete live QA.
