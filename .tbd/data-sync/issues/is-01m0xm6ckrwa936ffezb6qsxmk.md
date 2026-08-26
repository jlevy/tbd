---
type: is
id: is-01m0xm6ckrwa936ffezb6qsxmk
title: Make atomic-write guidance prescriptive and consistent
kind: epic
status: closed
priority: 2
version: 12
labels: []
dependencies:
  - type: blocks
    target: is-01m0xmcxvqt3p2qz7p4netcne2
child_order_hints:
  - is-01m0xm8na51f2q7fa5g198mcdz
  - is-01m0xm8xxea50zg2tab8nfx92s
  - is-01m0xm94j0raw4q1gcedr099ft
  - is-01m0xm9ccj14d0pnbw7m9bkjet
  - is-01m0xm9m2p48wy0tsss6akmcxe
  - is-01m0xm9tc3ryqjh3xv2ad3eqhg
created_at: 2026-08-25T23:30:54.699Z
updated_at: 2026-08-26T00:33:09.729Z
closed_at: 2026-08-26T00:33:09.728Z
close_reason: Completed the atomic-write epic across the language-neutral, Rust, Python, and TypeScript guidelines with consistent scope, rationale, caveats, and examples.
resolution: null
duplicate_of: null
---
Can we fix the general headings like "Name the Write Contract, Then Enforce It" with a specific prescription? In this case it is "Always Prefer Atomic File Writes" or something very similar.

Also review our recommendations of strif as a Python package and strongly suggest use of its atomic output file method. Give concise examples of atomic writes done properly in Rust, Python, and TypeScript. Note in some other places you're recommending against always using atomic output files in Rust. Let's make sure that we're consistent across this too.

Make sure the beads emphasize my strong expectation of very specific language and specific examples over general guidance that any agent would already know.

## Notes

This is not the same as saying everything is overly prescriptive. It needs to be very specific, with specific rationale, and leave it up to the agent to decide when to use the principles described in those guidelines.
