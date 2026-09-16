---
type: is
id: is-01m2nkwz82egyv7rt99cq0hy8s
title: Verify pinned gh-stack extension identity before use
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels:
  - supply-chain
  - github
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T17:23:14.305Z
updated_at: 2026-09-16T17:23:37.499Z
started_at: 2026-09-16T17:23:37.498Z
---
PR #301 review finding: generated ensure-gh-cli installers currently run 'gh extension install github/gh-stack --pin v0.1.0' and accept any extension listing that contains 'gh stack'. Determine the safest supported cross-platform verification mechanism, require exact github/gh-stack v0.1.0 identity and immutable artifact evidence where available, preserve optional/nonfatal setup behavior, regenerate managed surfaces, and cover success/tamper/platform cases with focused tests.
