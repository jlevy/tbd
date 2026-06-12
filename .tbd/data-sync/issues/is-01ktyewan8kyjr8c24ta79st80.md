---
type: is
id: is-01ktyewan8kyjr8c24ta79st80
title: Re-home the old tbd docs viewer surface per disposition table
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:05.639Z
updated_at: 2026-06-12T17:43:05.639Z
---
[Phase 2] PR #169. Old and new surfaces coexist: bare tbd docs is still the manual viewer; --list (sections) vs list (docs) have different meanings; description still says 'use tbd sync --docs'. Implement the four-row disposition: bare = status overview; show/manual for the manual; retire --list/--all/--section; rewrite affected goldens (cli-help-all, cli-doc-output, golden-output). Release bar for cutting any release with CURRENT_FORMAT=f05.
