---
type: is
id: is-01kf7585p0257rymywxcnrhk6j
title: "Update design doc: conflict detection uses Git, not content hashing"
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-17T23:39:35.999Z
updated_at: 2026-03-09T16:12:31.182Z
closed_at: 2026-01-17T23:47:39.560Z
close_reason: Updated Sync Mechanism section in tbd-design.md to accurately reflect Git-based conflict detection
---
The v3 spec (tbd-full-design-v3.md) describes content hash comparison for conflict detection, but the actual implementation uses standard Git mechanics (push rejection triggers fetch+merge). Update design doc to reflect the simpler actual implementation.
