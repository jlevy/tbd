---
type: is
id: is-01m0rbtm447ba7ebfyek2q7tjr
title: Make Rust feature-matrix gate tests portable on Windows
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
created_at: 2026-08-23T22:28:28.418Z
updated_at: 2026-08-23T22:48:43.856Z
closed_at: 2026-08-23T22:48:43.856Z
close_reason: "Fixed, fully validated, and pushed in stacked PR #260 through commit 8ae47120; Linux, macOS, Windows, coverage/lint, benchmark, and security checks are green."
resolution: null
duplicate_of: null
---
PR #260 Windows CI shows the Rust gate's feature-argument tests fail while dynamically importing the executable guideline script through Vitest. Replace implementation-coupled imports with black-box CLI assertions against a portable fake Cargo executable, covering default, all-feature, named/minimal, and contradictory option contracts.
