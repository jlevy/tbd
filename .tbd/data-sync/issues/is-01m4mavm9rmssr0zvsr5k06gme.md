---
type: is
id: is-01m4mavm9rmssr0zvsr5k06gme
title: Reject BOM-prefixed executable Markdown frontmatter
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: sol-pr324-fixes-01a127df
labels: []
dependencies: []
parent_id: is-01m4manp9y8srxqpyce3sbq1xe
hold: null
hold_until: null
created_at: 2026-10-11T01:57:22.359Z
updated_at: 2026-10-11T02:25:54.251Z
started_at: 2026-10-11T01:57:28.230Z
closed_at: 2026-10-11T02:25:54.250Z
close_reason: Implemented in pushed845d55c; focused behavioral tests and hosted Coverage & Lint pass. Review A dispositions and security Review B published on PR324. Separate parser correctness defect and package proof remain tracked in tbd-7pdk/tbd-4x46.
resolution: null
duplicate_of: null
---
During PR324 A1 remediation, controlled regression test showed BOM-prefixed ---javascript bypasses current matter.test language guard; gray-matter then strips BOM and evaluates the header. Test only sets global marker. Replace executable-capable engine boundary with YAML-only parsing and cover BOM/non-BOM rejection. Reported by sol-pr324-fixes-01a127df; dedicated security review tbd-0skc will verify.
