---
type: is
id: is-01m26cge9yff6389kpy7wdywrn
title: Correct top-level sync direction semantics in current docs
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T19:25:27.226Z
updated_at: 2026-09-10T20:20:02.794Z
started_at: 2026-09-10T19:35:40.089Z
closed_at: 2026-09-10T20:20:02.794Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
Current docs say top-level tbd sync --push/--pull also drives provider sync. Shipped surface selection excludes integrations for direction flags unless --integrations is explicit. Reconcile main design, CLI manual, active provider plan, and generated skills.
