---
type: is
id: is-01m2qyrjgpqvwfbtsy9wb9x4zd
title: "Fix CI: tier agent paths in upgrade validation; CRLF in new doc tests"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:mechanical
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T15:11:33.397Z
updated_at: 2026-09-17T15:27:22.570Z
started_at: 2026-09-17T15:12:01.661Z
closed_at: 2026-09-17T15:27:22.569Z
close_reason: "Verified by the coordinator after a rebuild: 154 tests in 8 files including doc-references passed; typecheck, eslint, eslint contract, prettier clean; the agent ran full upgrade validation locally (passed) and proved CRLF fixes against CRLF doc copies; committed"
resolution: null
duplicate_of: null
---
CI on PR #309 at dea8b449 (run 35218111435):
1. Test (ubuntu-latest, Node 24): packages/tbd/scripts/validate-upgrade-package.mjs fails 'latest-published: upgrade changed non-managed paths: .claude/agents/tbd-{fast,moderate,strong-max,strong}.md, .codex/agents/tbd-{fast,moderate,strong-max,strong}.toml'. managedUpgradePaths needs the eight tier agent paths; check the script's other upgrade invariants against the f100 integration format and new surfaces.
2. Test (windows-latest, Node 24): three tests fail because Windows checks docs out with CRLF: integration-files.test.ts 'states GitHub authorization in its own section before the closing protocol' (indexOf('\n## GitHub Authorization\n') is -1), linear-epics-selection.test.ts (YAML block not found in setup-linear.md), policy-grants-docs.test.ts (block example not found). Normalize line endings when reading docs (pattern: bead-web-css.test.ts uses replace(/\r\n?/gu, '\n')). Also check whether parsePolicyBlock (policy-grants.ts) and setup's block preservation handle a CRLF AGENTS.md; add a test and fix if not.
Write set: packages/tbd/scripts/validate-upgrade-package.mjs; the three test files; packages/tbd/src/lib/policy-grants.ts and packages/tbd/tests/policy-grants.test.ts only if the CRLF check shows a real bug.
