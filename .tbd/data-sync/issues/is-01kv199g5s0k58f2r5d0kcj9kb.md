---
type: is
id: is-01kv199g5s0k58f2r5d0kcj9kb
title: Variadic IDs for close/reopen/update (bulk mutators)
kind: task
status: closed
priority: 1
version: 13
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies:
  - type: blocks
    target: is-01kv199hk1mhj4qq0c1rhhkh31
  - type: blocks
    target: is-01kv199mceva1eqhc1xd45ntxe
  - type: blocks
    target: is-01kv199q7mbcqxrvfd6jpecxnk
  - type: blocks
    target: is-01kv199rkcm7z63tmp6hs2dbr1
  - type: blocks
    target: is-01kv199t0v53178ybga0kp21k3
  - type: blocks
    target: is-01kv199vg79cyyjde19bxgrvdg
parent_id: is-01kv197ns6jwkg2q82w7awjn15
child_order_hints:
  - is-01kv1cykshfpkk9qb3ve6sffbd
  - is-01kv1cyn85975ep5zdd0s2x1nm
created_at: 2026-06-13T20:03:09.113Z
updated_at: 2026-06-13T22:09:45.434Z
closed_at: 2026-06-13T22:09:45.433Z
close_reason: "All three variadic mutators shipped: close (fc9065b), reopen (03ab2d6), update (b5ec58b). Each preserves single-ID legacy behavior; bulk = validate-all-then-apply + summary + --json + visible sync hint."
---
Phase 1 core (spec API Changes; problems P1/P7). Accept <ids...> on close/reopen/update/show; single-ID behavior unchanged; process all IDs under one withDataSyncContext lock. Validate-all-then-apply atomicity: resolve every ID first and abort before writing if any is unknown (--ignore-missing downgrades to skip); already-closed is a reported skip. Reject per-ID-only flags such as --title when multiple IDs are given. Supersedes stub bead tbd-cxqm (Batch operations).

## Notes

PR #176 review: show split out to tbd-r2zr (separate read-only). already-X skips are BULK-ONLY; single-ID close idempotent / reopen errors exit 1 preserved. Validate-all-then-apply; reject per-ID-only flags for multi-ID. PROGRESS 2026-06-13: variadic CLOSE shipped (commit fc9065b) - new bulk.ts helper, --ignore-missing, one-line summary, --json results + sync pending/hint, visible notice. Verified: 76 cli-crud + 14 new bulk goldens + full 897 tryscript + 1324 vitest all green. REMAINING in this bead: variadic reopen (mirror of close), constrained bulk update.
