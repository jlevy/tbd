---
type: is
id: is-01knkgx3gvrthrhannw8jkpd13
title: Preserve original filesystem errors in withLockfile instead of throwing misleading LockAcquisitionError on non-EEXIST failures
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01knkgpxp4e0btttjy50hqsh37
created_at: 2026-04-07T08:28:20.379Z
updated_at: 2026-04-07T08:32:53.744Z
closed_at: 2026-04-07T08:32:53.743Z
close_reason: withLockfile now preserves unexpected filesystem errors and no longer misreports them as lock contention
---
