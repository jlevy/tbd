---
type: is
id: is-01m05tcva4s4448qb9k6c6nqh0
title: Generalize desktop packaging insights into guidelines; keep app-specific material out
kind: task
status: closed
priority: 1
version: 2
labels: []
dependencies: []
created_at: 2026-08-16T17:37:31.458Z
updated_at: 2026-08-16T17:41:18.577Z
closed_at: 2026-08-16T17:41:18.577Z
close_reason: "Audit: my three desktop guidelines contained zero app-specific references; one pre-existing violation found and fixed (typescript-lint-format-rules named two specific repos as reference configs — line removed under the same policy). Generic insights added: thin-shell pattern for wrapping local web apps (Electron §3), two-layer artifact for runtime-extensible apps with signed-lock update chain (Electron §3), wheels-before-rewrite guidance (Python Backends), and interpreter-tree-as-resource note (Tauri sidecars). App-specific report delivered to the user as a standalone file, not committed to tbd."
---
Audit built-in guidelines for app-specific content (must be zero); add the reusable insights from the local-server app evaluation in generic form: thin-shell pattern for local web apps, two-layer artifact for runtime-extensible apps with signed-lock update chain, disable-library-validation entitlement for runtime-loaded native code, interpreter-tree-as-resource note in Tauri, wheels-before-rewrite. Produce the app-specific report as a standalone file outside the repo docs.
