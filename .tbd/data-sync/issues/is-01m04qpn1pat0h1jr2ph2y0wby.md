---
type: is
id: is-01m04qpn1pat0h1jr2ph2y0wby
title: "Review pass: verify and deepen Electrobun and Tauri guidelines"
kind: task
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T07:31:12.565Z
updated_at: 2026-08-16T07:35:54.211Z
closed_at: 2026-08-16T07:35:54.211Z
close_reason: "Review complete. Verified firsthand in the clone: __electrobun_encrypt page-global (encryption.ts:97), sandboxed-preload no-RPC comments, 2ms JSCallback workaround, @default cottontail. Corrected 'closed-source Hutch' to the verifiable 'ships as a binary outside the open repository' in all four places. Replaced ambiguous core:default permission counts with the nine-module structure. Attributed the IPC benchmark. Added Tauri depth: project layout, complete tauri.conf.json with the ipc: connect-src requirement, dev loop, and full updater wiring (createUpdaterArtifacts, endpoint template vars, manifest format)."
---
Senior review of the two new docs: re-verify agent-sourced claims firsthand (Electrobun security globals, sandbox/RPC exclusivity, cottontail default, Hutch closed-source claim; Tauri core:default counts), fix example correctness, and add depth where a reader implementing would be stuck (Tauri project layout, dev loop, tauri.conf.json, updater config and manifest).
