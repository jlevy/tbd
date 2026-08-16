---
type: is
id: is-01m0444p5jysk5vb20e5snpa4d
title: Verify whether Mach-O sidecars under Contents/Resources pass macOS notarization
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
parent_id: is-01m042xcf06tnmqey8pcfwwswt
created_at: 2026-08-16T01:49:20.946Z
updated_at: 2026-08-16T01:49:20.946Z
---
Open research question 1 from the refreshed guideline. Apple TN2206 designates Contents/Resources for scripts and non-Mach-O executables, yet electron-builder's extraResources writes there and signed binaries in that location are widely shipped. Needs a controlled test: notarize one build with a Mach-O sidecar in Resources and another with it relocated to Contents/Helpers, and compare. The guideline currently states the safe rule and flags the uncertainty.
