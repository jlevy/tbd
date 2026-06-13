---
type: is
id: is-01ktzr2zgn7v2s8bprw46ajmm1
title: Unify the forked-docs onboarding recommendation across all four surfaces
kind: task
status: closed
priority: 2
version: 2
labels: []
dependencies: []
created_at: 2026-06-13T05:43:15.220Z
updated_at: 2026-06-13T05:53:16.903Z
closed_at: 2026-06-13T05:53:16.902Z
close_reason: "Fixed in 2213b47c: skill-baseline.md + welcome-user.md now lead with the category-based fork recommendation, matching the setup summary and docs overview."
---
The forkable-docs spec (plan-2026-06-11-forkable-docs.md) says the fork recommendation must be 'kept identical across' the bare 'tbd docs' overview, the 'tbd setup --auto' summary, the skill, and welcome-user: fork the general guidelines plus the categories for the repo's languages/frameworks.

Before this change they disagreed: the setup summary and 'tbd docs' overview recommended 'tbd docs fork --category=general --category=<lang>', while skill-baseline.md and welcome-user.md recommended 'tbd docs fork <name>' / '--all' and never mentioned --category.

Fixed in working tree (pending commit) alongside tbd-o6zn:
 - packages/tbd/docs/shortcuts/system/skill-baseline.md (routing row)
 - packages/tbd/docs/shortcuts/standard/welcome-user.md (Visibility instruction + Guidelines table row)
Both now lead with the category-based recommendation, keeping --all and by-name as alternatives.

Found during pre-release dogfooding of forkable docs (f05).
