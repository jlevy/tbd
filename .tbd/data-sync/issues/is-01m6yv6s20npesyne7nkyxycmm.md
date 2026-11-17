---
type: is
id: is-01m6yv6s20npesyne7nkyxycmm
title: "PR #332 A4: return validate-upgrade-package expectManagedScriptChange to false after the next release"
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
parent_id: is-01m6yv6qega7ts908s41sm9pqm
created_at: 2026-11-09T00:26:52.863Z
updated_at: 2026-11-09T00:26:52.863Z
---
Suggestion. packages/tbd/scripts/validate-upgrade-package.mjs latest-published scenario sets expectManagedScriptChange: true until the same-format baseline ships the hardened launcher (PR #332). Once a published release ships it, set it back to false so the byte-stability guard is on again. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820355604
