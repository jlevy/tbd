---
type: is
id: is-01m00k64qt61hy5vnwb66nr3zx
title: "Wire the two dead link renderers: repoUrl and prUrls are never populated"
kind: bug
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - traceability
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:55:19.546Z
updated_at: 2026-08-14T17:25:11.909Z
---
Both link renderers in the Linear managed block exist, are correct, and have no data behind them.

repoUrl (F11): drives the managed block's 'Bead: [id](url)' line (managed-block.ts:80-84) and the 'bead source' attachment (mirror.ts:169-175). Both planMirror call sites pass only specUrl (integration-runner.ts:272 and :386) and the sync engine hardcodes repoUrl: undefined (sync-engine.ts:527). So the block always renders the fallback 'Bead: `tbd show tbd-va8i`' and the attachment is never created.

prUrls (F12): renders 'PRs: [#205](...)' (managed-block.ts:74-76) with a prLabel() helper that parses /pull/(\d+). A repo-wide search finds NO assignment to prUrls anywhere in src/. The single most-wanted click-through — Linear to the PR — is rendering code with no data.

Fix:
- Pass a repoUrl resolver at both call sites and in the engine, built exactly as specUrl already is (integration-runner.ts:110-134 is the pattern): blobUrl(slug, syncBranch, 'issues/<internal-id>.md').
- Populate prUrls from refs where kind == pr (needs tbd-<refs bead>).

Both are small because the presentation was written first and only the data was missing.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F11, F12, §5.2, §5.6, E15
