---
type: is
id: is-01m0vccsn0ayn5m9cj6sr3nnht
title: Make unreleased-regression release-note rule discoverable
kind: task
status: closed
priority: 2
version: 3
labels: []
dependencies: []
created_at: 2026-08-25T02:36:07.186Z
updated_at: 2026-08-25T02:51:50.344Z
closed_at: 2026-08-25T02:51:50.343Z
close_reason: Added concise, discoverable release-note gates in commit 622cf1c2; full local, pre-push, and GitHub CI are green.
resolution: null
duplicate_of: null
---
The detailed rule already exists in release-notes-guidelines, but it is easy to miss from release-engineering and project publishing workflows. Make the rule searchable and add concise process/checklist gates: a Fixes entry must describe a defect present in a published release; regressions introduced and corrected before release, including refactor regressions, are part of the parent change rather than separate shipped fixes.
