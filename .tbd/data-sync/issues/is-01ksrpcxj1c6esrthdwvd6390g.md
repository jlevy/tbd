---
type: is
id: is-01ksrpcxj1c6esrthdwvd6390g
title: "[task] Move 'cut-release' shortcut out of standard/ into project-local docs/publishing.md"
kind: task
status: closed
priority: 2
version: 4
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies:
  - type: blocks
    target: is-01ksrpdkemmkkhh4j6egqyrvsq
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T01:43:20.896Z
updated_at: 2026-05-29T03:47:01.052Z
closed_at: 2026-05-29T03:47:01.051Z
close_reason: Shortcut deleted; docs/publishing.md reframed as project-local playbook; all 4 references in shipped guidelines/docs/specs updated to point at publishing.md instead of the shortcut. After reinstalling local build globally, tbd shortcut --list no longer surfaces cut-release; AGENTS.md and SKILL.md regenerated clean.
---
packages/tbd/docs/shortcuts/standard/cut-release.md is tbd-specific (our dogfood publish flow for get-tbd itself); it should not ship as a 'standard' shortcut to all tbd users via 'tbd shortcut --list'.

Plan:
- Delete packages/tbd/docs/shortcuts/standard/cut-release.md (and its packaged distribution copies if any).
- Move the content into docs/publishing.md (or a similar project-local doc at repo root). Include the 'pnpm build before pnpm test' note from bead tbd-zswv as a section.
- Update any references that pointed at the shortcut to point at the new doc (CLAUDE.md, docs/development.md, release.yml comments if any).
- Verify 'tbd shortcut --list' no longer surfaces cut-release after 'tbd setup --auto'.

User direction: 'we should not be putting cut-release to our standard skill if it's only for tbd, that is, for our own dogfood use, not for general use cases for others.'
