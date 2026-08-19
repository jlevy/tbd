---
type: is
id: is-01m045a8k2kht81a71reskkyq8
title: "Review pass 2: guideline vs eng principles, example correctness, pin ages"
kind: task
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m042xcf06tnmqey8pcfwwswt
created_at: 2026-08-16T02:09:52.226Z
updated_at: 2026-08-16T02:13:50.853Z
closed_at: 2026-08-16T02:13:50.853Z
close_reason: "Review pass complete. Found and fixed: origin-validation examples that would reject the app's own renderer under loadFile; a non-relocatable venv in the Python sidecar recipe (replaced with python-build-standalone tree + uv pip sync); wrong preload output extension (.cjs vs the .js electron-vite emits); invalid extglob in the signing glob; per-OS-wrong Electron cache path and missing APPLE_API_KEY/AZURE_CLIENT_SECRET in the CI example; two 14-day pin violations (vite-plugin-electron 1.1.1, pnpm 11.21.0); replacement-history framing in the Bun paragraph; and added WebContentsView note plus an npm-is-equally-sound note in Recommendations. Prescription-vs-options balance audited: recommendations are evidence-backed where given, alternatives presented where evidence is mixed."
---
Second senior review of the rewritten electron-app-development-patterns.md: (1) adherence to general-eng-agent-principles and common-doc-guidelines (calibrated claims, present-state writing, no meta-commentary); (2) recommend-where-clear vs present-options-where-valid balance; (3) line-level correctness of every code example (origin validation with loadFile, venv relocatability, glob syntax, CI cache paths, signing env vars); (4) 14-day package-age compliance for every pin in the version table.
