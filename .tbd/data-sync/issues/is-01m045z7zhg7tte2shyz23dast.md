---
type: is
id: is-01m045z7zhg7tte2shyz23dast
title: "Tauri: write tauri-app-development-patterns guideline"
kind: feature
status: closed
priority: 1
version: 6
labels: []
dependencies:
  - type: blocks
    target: is-01m045zbvt4hrnr20fereas3fa
  - type: blocks
    target: is-01m045zdsxka8ty06fzp1sn84v
  - type: blocks
    target: is-01m045zfqascxq7t0sprw9rdxa
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T02:21:19.729Z
updated_at: 2026-08-16T04:42:34.563Z
closed_at: 2026-08-16T04:42:34.563Z
close_reason: "Wrote tauri-app-development-patterns.md (738 lines) matching the Electron/Electrobun structure. Anchors the recommendation on the minisign-verified updater, verified from source. Documents the two-sided security model honestly (deny-all default and Rust safety, but no OS-level renderer sandbox, CSP off by default, unpatched system webviews), the Linux webview breakage with issue citations, the sidecar target-triple and permission gotchas, and the 3-5x Rust CI penalty. Corrected the JIT-entitlements claim: Tauri does NOT need them because web content runs in Apple's own WebContent process."
---
Same structure as electron-app-development-patterns, informed by the OSS survey.
