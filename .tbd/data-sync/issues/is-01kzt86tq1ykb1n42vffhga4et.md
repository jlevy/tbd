---
type: is
id: is-01kzt86tq1ykb1n42vffhga4et
title: Preserve shared-lock permission diagnostics for owner preparation
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T05:48:01.120Z
updated_at: 2026-08-12T06:08:38.615Z
closed_at: 2026-08-12T06:08:38.615Z
close_reason: Implemented the portable mkdir-elected owner-generation protocol, bounded all failed-progress paths, preserved actionable permission diagnostics, and verified the adversarial and full release matrices.
---
withSharedDataSyncLock translates permission errors only when error.path equals the canonical data-sync lock. Pre-acquisition owner-generation mkdir/open and install rename use token-private or nested paths, so a read-only shared lock directory can now leak a raw EPERM/EACCES. Classify only paths belonging to this lock protocol (canonical, token-private preparation, nested owner destination), preserve unrelated critical-section errors, update the doctor probe if needed, and add focused regressions.
