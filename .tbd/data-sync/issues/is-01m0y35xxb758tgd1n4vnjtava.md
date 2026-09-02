---
type: is
id: is-01m0y35xxb758tgd1n4vnjtava
title: Desktop-framework guidelines are misfiled into the docs/tooling catch-all group
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-08-26T03:52:48.299Z
updated_at: 2026-08-26T03:52:48.299Z
---
`guidelineGroupFor` files two desktop-framework guidelines under the
"Docs, process & tooling" catch-all, where an agent looking for them will not find
them. Verified by running the exported function over all 43 bundled names.

| Guideline | Lands in | Should be |
| --- | --- | --- |
| `electron-app-development-patterns` | TypeScript & JS ecosystem | (fine) |
| `electrobun-app-development-patterns` | **Docs, process & tooling** | with its siblings |
| `tauri-app-development-patterns` | **Docs, process & tooling** | with its siblings |
| `release-notes-guidelines` | **Docs, process & tooling** | arguably Cross-cutting, beside `release-engineering-rules` |

Cause: the TypeScript group matches `n.startsWith('electron-')`, which is false for
`"electrobun-..."`. Tauri has no matcher at all.
`packages/tbd/src/file/doc-cache.ts`, `GUIDELINE_GROUPS`.

This is the same class of defect the PR's own `guideline-groups.test.ts` was added to
catch—a group whose rendered contents nobody checked—except here the heading is wrong
for the document rather than the document missing.

Options, cheapest first:

1. Add an explicit `APP_FRAMEWORK_NAMES` set (electron, electrobun, tauri,
   cli-agent-skill-patterns) with its own heading, matching the README's
   "Frameworks and Application Platforms" section. Consistent with the PR's move away
   from prefix inference toward explicit membership.
2. Widen the TypeScript matcher to cover `electrobun-` and `tauri-`. Cheaper, but
   files Tauri—whose core is Rust—under "TypeScript & JS ecosystem".

Option 1 is preferred. Whichever is chosen, extend `guideline-groups.test.ts` to
assert the rendered membership of the new group, and regenerate the agent surfaces
(`tbd setup --auto`).

Note the README taxonomy is deliberately a separate human-facing cut and should not
be forced to mirror the groups.

Found during the PR #258 documentation review (epic tbd-81x8, sweep bead tbd-sjws).
