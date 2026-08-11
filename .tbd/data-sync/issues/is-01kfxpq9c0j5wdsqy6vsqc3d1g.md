---
type: is
id: is-01kfxpq9c0j5wdsqy6vsqc3d1g
title: "CLI output consistency: stats formatting and status icons"
kind: epic
status: open
priority: 2
version: 13
labels: []
dependencies: []
created_at: 2026-01-26T17:48:14.591Z
updated_at: 2026-08-11T07:07:02.970Z
extensions:
  linear:
    id: 301e57f4-deb2-4606-8b08-8a93b9f9ff02
    key: TBD-57
    url: https://linear.app/finterm-ai/issue/TBD-57/cli-output-consistency-stats-formatting-and-status-icons
    linked_at: 2026-08-10T19:36:16.196Z
    comments:
      - id: 0f30a453-b82f-4695-b27c-d1d0ff99e7f1
        at: 2026-08-11T07:07:02.790Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-d7za` diverged and one value was discarded.

          - Kept: `"sha256v2:eb82193ea5819ea6c5dca8ad71ee7f2e6b9fc77d404871d4b8bf569363b81fa9"`
          - Discarded: `"sha256v2:820aa07bb21e94be097801942b45bebbafe82f0e42b25f1efcea744a54c96c4e"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kfxpq9c0j5wdsqy6vsqc3d1g`.
          Resolve this comment once the divergence has been reconciled.
---
Improve CLI output consistency for stats command and status icon usage across all commands.

**Sub-tasks:**
1. tbd-vbet: Fix stats command output alignment and formatting
2. tbd-v809: Audit and ensure consistent status icon usage

**Goals:**
- Right-aligned, consistently formatted stats output
- Status icons (○ ◐ ● ✓) used everywhere statuses appear
- Consistent colors matching other commands
- Professional, polished CLI appearance
