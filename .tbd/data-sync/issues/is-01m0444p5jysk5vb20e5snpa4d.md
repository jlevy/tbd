---
type: is
id: is-01m0444p5jysk5vb20e5snpa4d
title: Verify whether Mach-O sidecars under Contents/Resources pass macOS notarization
kind: task
status: closed
priority: 3
version: 2
labels: []
dependencies: []
parent_id: is-01m042xcf06tnmqey8pcfwwswt
created_at: 2026-08-16T01:49:20.946Z
updated_at: 2026-08-16T07:45:06.624Z
closed_at: 2026-08-16T07:45:06.624Z
close_reason: "Resolved by field evidence rather than a controlled macOS run: every Electron app shipping a native module places individually-signed Mach-O .node files under Contents/Resources/app.asar.unpacked (asar cannot be dlopen'd, so unpacking is mechanical), and those apps — Signal with better-sqlite3 among the surveyed set — notarize and ship. Notarization verifies each Mach-O's signature and hardened runtime; it does not reject by location. Doc rewritten to state this; relocation to Frameworks/Helpers documented as the fix for unusual layouts."
---
Open research question 1 from the refreshed guideline. Apple TN2206 designates Contents/Resources for scripts and non-Mach-O executables, yet electron-builder's extraResources writes there and signed binaries in that location are widely shipped. Needs a controlled test: notarize one build with a Mach-O sidecar in Resources and another with it relocated to Contents/Helpers, and compare. The guideline currently states the safe rule and flags the uncertainty.
