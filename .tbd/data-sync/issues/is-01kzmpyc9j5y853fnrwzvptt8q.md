---
type: is
id: is-01kzmpyc9j5y853fnrwzvptt8q
title: Expand watch release smoke coverage and run it in CI
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/valid-2026-08-09-bead-watch-release.md
labels:
  - bead-watch
  - validation
dependencies: []
parent_id: is-01kzmm8zqnf8q210etncddjn6h
created_at: 2026-08-10T02:10:06.257Z
updated_at: 2026-08-10T02:41:44.928Z
closed_at: 2026-08-10T02:41:44.927Z
close_reason: null
---
Extend the disposable two-clone release smoke to cover concurrent watchers, all selector families, human/quiet/operational output, and protected-state checks; invoke the built-candidate smoke from the cross-platform CI matrix; update the validation plan and QA playbook with exact release evidence commands.

## Notes

Expanded the real-Git release smoke with two concurrent watchers in one checkout; bead, multi-bead, label, status, spec, ready, and all selectors; human/JSON/quiet modes; exit classes 0/1/2/3; active-watch show/list/ready/sync-status coexistence; and protected Git-state baselines. Added the built-candidate smoke to Ubuntu, macOS, and Windows CI. Source and isolated-prefix packed-candidate smokes passed; precommit passed 100 files and 1,451 tests; all 1,068 Tryscript cases passed; publint passed; package-age found 0 violations across 31 pins.
