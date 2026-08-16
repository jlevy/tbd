---
type: is
id: is-01m045z3xfnzqs4qrzrvj15w5k
title: "Tauri: research backend integration: Rust commands, sidecars, and non-Rust backends"
kind: task
status: closed
priority: 1
version: 3
labels: []
dependencies:
  - type: blocks
    target: is-01m045z7zhg7tte2shyz23dast
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T02:21:15.567Z
updated_at: 2026-08-16T04:37:57.555Z
closed_at: 2026-08-16T04:37:57.555Z
close_reason: 'Backend/sidecar researched. Key gotchas for the guideline: target-triple suffix naming, the Rust-vs-JS sidecar path asymmetry, and the required shell permissions with scope "sidecar": true. Python via PyInstaller or PyTauri; Bun simplest via bun build --compile at ~29MB cost. Sidecars are killed on exit since commit 34879f7 but orphan edge cases remain; RunEvent::Exit is the recommended cleanup. Plugins work on mobile, sidecars do not.'
---
Writing commands and state, async runtime, the sidecar/external-binary mechanism and its externalBin naming convention, shipping Python/Node/Go backends, plugin ecosystem (sql, stronghold, shell, fs), and the capability/permission implications of each.
