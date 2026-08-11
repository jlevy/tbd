---
type: is
id: is-01kg5jhdtwzxw7ce1xvnnc5tn3
title: "Phase 5: Update setup command to use shared function"
kind: task
status: open
priority: 2
version: 11
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg5jhee3nrrtkqa80h52p1d8
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:03.708Z
updated_at: 2026-08-11T07:02:08.224Z
extensions:
  linear:
    id: 932943f1-8b90-4b7b-a13d-77f78cbf7fd5
    key: TBD-48
    url: https://linear.app/finterm-ai/issue/TBD-48/phase-5-update-setup-command-to-use-shared-function
    linked_at: 2026-08-10T19:36:23.943Z
---
Update setup.ts to:
- Replace inline doc sync logic with syncDocsWithDefaults()
- Remove duplicate doc sync code
- Ensure setup still works correctly
