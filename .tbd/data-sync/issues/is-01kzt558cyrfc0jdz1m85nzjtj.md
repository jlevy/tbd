---
type: is
id: is-01kzt558cyrfc0jdz1m85nzjtj
title: Avoid ownerless canonical lock when owner-record setup fails
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T04:54:43.869Z
updated_at: 2026-08-12T05:09:21.693Z
closed_at: 2026-08-12T05:09:21.692Z
close_reason: Implemented pre-acquisition owner preparation plus exclusive hard-link installation and empty-only provisional cleanup. Added forced open/write failure and delayed-installer/successor regressions; full release matrix passed.
---
Bugbot found that open/write failure after canonical mkdir can leave an ownerless directory that fail-closed recovery will never remove. Prepare the complete owner record before canonical acquisition and install it without overwriting a successor; clean empty failed acquisitions safely and force owner-setup failure plus displacement interleavings in tests.
