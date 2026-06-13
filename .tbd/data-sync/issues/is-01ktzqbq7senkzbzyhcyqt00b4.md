---
type: is
id: is-01ktzqbq7senkzbzyhcyqt00b4
title: docs fork --category=general over-forks all shortcuts/templates/references
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
created_at: 2026-06-13T05:30:33.078Z
updated_at: 2026-06-13T05:53:16.708Z
closed_at: 2026-06-13T05:53:16.707Z
close_reason: "Fixed in 2213b47c: docCategory() no longer defaults to 'general'; --category fork selection scoped to guidelines. Unit + tryscript regression tests added."
---
tbd docs fork --category=general forks the 14 general guidelines PLUS all 31 shortcuts, 4 templates, and 4 references — instead of just the general guidelines.

Root cause: docCategory() in packages/tbd/src/lib/doc-categories.ts:12-17 defaults any doc whose frontmatter 'category' is not one of [general,typescript,python,convex,electron] to 'general'. Shortcuts/templates/references declare other categories (e.g. review-code => category: review) or none, so they all collapse to 'general'. The fork selection at packages/tbd/src/cli/commands/docs-fork.ts:204-222 iterates ALL kinds and filters by docCategory(), so --category=general matches every non-guideline doc.

Only --category=general is affected (it is the fallback value); --category=typescript|python|convex|electron correctly fork only their guidelines (verified: --category=typescript forks 7 guidelines, nothing else).

Spec contradiction: plan-2026-06-11-forkable-docs.md says 'Categories are guidelines-oriented; shortcuts and templates are forked by name or with --all.' Severity is elevated because --category=general is part of the RECOMMENDED onboarding command surfaced by both 'tbd setup --auto' summary and the bare 'tbd docs' overview (tbd docs fork --category=general --category=<lang>).

Repro:
  tbd setup --auto --prefix=test
  tbd docs fork --category=general
  grep '    kind:' .tbd/doc-forks/forks.yml | sort | uniq -c   # shows shortcut/template/reference entries

Possible fixes (maintainer's call):
  (a) Scope --category selection to kind==guideline only.
  (b) Make docCategory() return undefined (no match) for non-guideline kinds / undeclared category, instead of defaulting to general.

Found during pre-release dogfooding of forkable docs (f05) on 0.2.4-dev.55.c79f6d4.
