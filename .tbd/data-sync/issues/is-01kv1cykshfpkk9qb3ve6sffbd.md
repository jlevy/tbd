---
type: is
id: is-01kv1cykshfpkk9qb3ve6sffbd
title: Variadic reopen (bulk)
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199g5s0k58f2r5d0kcj9kb
created_at: 2026-06-13T21:07:06.673Z
updated_at: 2026-06-13T22:09:42.943Z
closed_at: 2026-06-13T22:09:42.942Z
close_reason: "Done in 03ab2d6: variadic reopen, single-ID legacy error preserved, bulk skips already-open. Goldens added; full tryscript suite green."
---
Mirror of variadic close. Accept <ids...>; one locked pass; validate-all-then-apply with --ignore-missing. Per PR #176 review: single-ID already-open keeps erroring exit 1 (cli-crud golden); already-open is a reported skip only in bulk (2+ IDs). Reuse cli/lib/bulk.ts. Add bulk-reopen goldens.
