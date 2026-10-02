---
type: is
id: is-01m3xmb6fkv8jf9k88pnyaj5yd
title: Use subprocess fixture budget for setup-hook functional tests
kind: task
status: in_progress
priority: 2
version: 2
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-10-02T06:20:37.732Z
updated_at: 2026-10-02T06:21:17.006Z
started_at: 2026-10-02T06:21:17.005Z
---
Release validation repeatedly hits legacy 15-second setup-hooks deadlines on mandated external scratch, including cleanup racing timed-out writes. Diagnose whether behavior is wrong; if only fixture timing, align with shared subprocessTestTimeout helper for multi-setup functional cases without relaxing explicit performance assertions. Capture rerun and normal push results. Part of v0.10.0 release readiness.
