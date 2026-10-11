---
type: is
id: is-01m4mbt3yte2j9433cr22xty72
title: Repair three malformed document headers found by PR324 parser corpus
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: sol-pr324-fixes-01a127df
labels: []
dependencies: []
parent_id: is-01m4manp9y8srxqpyce3sbq1xe
created_at: 2026-10-11T02:14:01.432Z
updated_at: 2026-10-11T02:14:21.054Z
---
Corpus validation of b1f34739 found preexisting YAML errors in docs/project/specs/done/plan-2026-07-28-agent-cli-bash-fallbacks.md description, packages/tbd/docs/references/docmap-format.md description, and packages/tbd/docs/shortcuts/system/skill-minimal.md compatibility. Colon-space text in plain scalar values is invalid. Quote/fold those values without changing meaning, verify document parsing and regenerate affected surfaces. Queue after active read-only reviews, no concurrent source edits.
