---
type: is
id: is-01m01y9yf3cemhpf85w3x1ts1w
title: parseYamlToleratingDuplicateKeys has no production callers after PR 232
kind: chore
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-08-15T05:28:52.963Z
updated_at: 2026-08-15T05:28:52.963Z
---
PR #232 replaced `parseYamlToleratingDuplicateKeys`'s only production consumer (`file/id-mapping.ts`) with the new `parseYamlDocumentEntries` primitive. A repo-wide grep now finds no production callers at all — only its own declaration at `utils/yaml-utils.ts:246` and its tests in `tests/ids.test.ts`.

So it is dead production code kept alive by its own test suite, which is the shape that makes coverage numbers misleading: the tests pass, the function is measured, and nothing ships through it.

This also slightly undercuts the goal of R2 in the #232 review, which was to collapse several parsers with differing notions of "a line" into one. Leaving a now-unused fourth parser exported means a future caller can still pick the wrong one — and it is the one with last-occurrence-wins semantics that caused the original bug.

Decide one of:
- Delete it along with its tests, since `parseYamlDocumentEntries` supersedes it and returns strictly more information.
- Keep it deliberately, with a docstring saying why it exists and what should use it instead.

Deliberately not folded into #232 to keep that PR's scope tight after its review cycle.
