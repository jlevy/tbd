---
type: is
id: is-01kh4t9cdp8esjk70khqvn2rmf
title: "Epic: External issue linking"
kind: epic
status: closed
priority: 1
version: 23
spec_path: docs/project/specs/active/plan-2026-02-10-external-issue-linking.md
labels: []
dependencies: []
child_order_hints:
  - is-01kh4t9x02rkd6pxhsbr69ts96
  - is-01kh4ta023fe6awh57kp8z5afb
  - is-01kh4ta2yejbm48vhwp5k9vph3
  - is-01kh4tab2habe6r6cspptrkavp
  - is-01kh4tady1vnmfb8tvnhv93xmz
  - is-01kh4tagqa9as4s7s231t9c3h3
  - is-01kh4tarbsf7k6jwr4pt5n79ks
  - is-01kh4tb83jp2d4fdt3dhy89t3d
  - is-01kh4tbgjhyw1qfphmqt77tx05
  - is-01kh4tbkc8gtnkrkkd2y6fg0qt
  - is-01kh4tc1as6pksaz2gns64q9k3
  - is-01kh4tc4n2eb3cwq6ym5tm041n
created_at: 2026-02-10T22:20:56.118Z
updated_at: 2026-09-16T00:18:36.119Z
closed_at: 2026-02-11T01:18:15.237Z
close_reason: "All 12 child beads completed. External issue linking feature is fully implemented: schema, URL parsing, inheritable fields, create/update/show/list/sync/doctor commands, bidirectional status & label sync, and comprehensive documentation."
---

## Notes

Correction to the close reason above, recorded 2026-09-15. This epic was closed as fully implemented, but none of that work reached main. It was implemented on PR #83 (branch claude/external-issue-linking-1rGfb, head 4795e47f), which was never merged and is now closed as superseded. Its spec_path points at docs/project/specs/active/plan-2026-02-10-external-issue-linking.md, which exists only on that branch. So there is no external_issue_url field, no --external-issue flag, no tbd sync --external, no gh-api transport, and no use_gh_cli gate in the shipped CLI. External tracker work now lives in the integration framework: extensions.<provider> link identity plus refs (f08 schema), the TrackerAdapter seam, the Linear adapter, and the GitHub adapter planned as Phase 3 under epic tbd-1ae2 with tbd-lmo9, tbd-tnks, tbd-v75l, tbd-v1u1, and tbd-xbkm. Deliberately left closed rather than reopened: the work it tracked is superseded, not pending. The reusable research from #83 was refreshed and landed as docs/project/research/current/research-2026-09-15-github-issues-for-tracker-adapter.md (PR #295).
