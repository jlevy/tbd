---
type: is
id: is-01m0xm9tc3ryqjh3xv2ad3eqhg
title: Add a concise correct TypeScript atomic-write example
kind: task
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0xm6ckrwa936ffezb6qsxmk
created_at: 2026-08-25T23:32:47.106Z
updated_at: 2026-08-26T00:33:09.452Z
closed_at: 2026-08-26T00:33:09.451Z
close_reason: Added a concise TypeScript atomically.writeFile example and distinguished its atomic-visibility guarantee from full directory-entry crash durability.
resolution: null
duplicate_of: null
---
Give a concise example of atomic writes done properly in TypeScript.

The example must name the exact APIs, show temporary-file creation and same-filesystem replacement, handle cleanup and failures correctly, and state when the example applies. Prefer a concrete example that changes an agent's implementation over general file-safety advice it would already know.
