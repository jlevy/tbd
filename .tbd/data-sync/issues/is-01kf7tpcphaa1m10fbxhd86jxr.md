---
type: is
id: is-01kf7tpcphaa1m10fbxhd86jxr
title: Make tbd doctor a clean superset of tbd status
kind: feature
status: closed
priority: 2
version: 15
labels: []
dependencies: []
created_at: 2026-01-18T05:54:22.032Z
updated_at: 2026-03-09T16:12:31.692Z
closed_at: 2026-01-18T06:23:54.276Z
close_reason: "Doctor is now a clean superset of status: same REPOSITORY section + STATISTICS + INTEGRATIONS (separated from health) + HEALTH CHECKS. All headings use formatHeading() for consistent ALL CAPS formatting."
---
The doctor and status commands have inconsistent output structure. Doctor should be a clear superset of status with consistent section names and formatting.
