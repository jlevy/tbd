---
type: is
id: is-01ktycs1za32d2bydse5vg8cyy
title: "Review/F1: tbd doctor false-positives on f04 repos + --fix half-migrates (layout f05, config f04)"
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:21.290Z
updated_at: 2026-06-12T17:45:34.154Z
closed_at: 2026-06-12T17:45:34.154Z
close_reason: "Fixed in 6b4d266: doctor treats an older-but-upgradeable common-dir layout as a pending migration (warning, exit 0) instead of a mismatch error; --fix routes through prepareDataSyncContext to migrate BOTH config and layout (never layout-only). Tests in common-dir-layout-doctor.test.ts."
---
