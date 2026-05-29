---
type: is
id: is-01ksdprb4vpb3drtwwjpznbqs6
title: Define AGENTS.md scope and marker policy
kind: task
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - agents-md
  - codex
  - guidelines
dependencies:
  - type: blocks
    target: is-01ksc0sv2xc7j6wnb9xzsep7fg
  - type: blocks
    target: is-01ksc0skpmwe30svw66fjsztwg
  - type: blocks
    target: is-01ksc0scbn4h9eybnfgmvr6mw3
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
  - type: blocks
    target: is-01ksdq6jr5nrtjtc194fz17kry
  - type: blocks
    target: is-01ksgr45bkhqwwfhpna2xytqdz
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T19:17:56.505Z
updated_at: 2026-05-25T23:39:40.219Z
---
setup.ts. In getCodexTbdSection() (line 97) emit metadata comment <!-- tbd:integration-format=2; surface=agents-md --> immediately after CODEX_BEGIN_MARKER (line 308). Update updatetbdSection() (line 975) and removetbdSection() (line 994) to detect format via the metadata comment; treat marked blocks lacking it as legacy format 1. Preserve content outside markers; append block when AGENTS.md exists unmarked (installCodexSection line 929 case 2).
