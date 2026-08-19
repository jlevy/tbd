---
type: is
id: is-01kysqv071rtzjszpag3y7ywm7
title: "Doc guidelines sweep: remove banned spaced em dashes from round-2 additions"
kind: chore
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-07-30T14:46:14.495Z
updated_at: 2026-07-30T15:03:55.092Z
closed_at: 2026-07-30T15:03:55.092Z
close_reason: "Fixed on PR #198 (commits 5ea854b and 690ce49). Lint floor: curly re-asserted after eslint-config-prettier (which had silently disabled it and brace-style); eslint --fix braced 252 statements across 56 files; brace-style dropped as redundant under Prettier. Doc sweep: every spaced em dash added on this branch rewritten per common-doc-guidelines (docs, spec, CHANGELOG, comments, and the golden-pinned bulk-show doctor hint); SKILL surfaces regenerated. Pre-existing violations tracked separately as tbd-bgvx."
---
PR #198 round-2 additions violate common-doc-guidelines punctuation rules: 52 added lines use spaced em dashes. The rule: use em dashes only when they are the best punctuation, prefer full stops, commas, colons, or semicolons, and when used follow American style without surrounding spaces. Scope: the plan spec, CHANGELOG 0.4.1 entries, skill-baseline/skill-brief/skill-minimal shortcuts, tbd-prime, tbd-docs, tbd-design, tryscript prose, and code comments (general-comment-rules bans em dashes in comments entirely). One CLI string is affected (bulk show stale-mapping doctor hint) and is pinned in cli-bulk-show.tryscript.md; the string and golden change together. Regenerate SKILL.md surfaces after editing skill-baseline.md.
