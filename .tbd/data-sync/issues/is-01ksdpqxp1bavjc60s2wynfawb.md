---
type: is
id: is-01ksdpqxp1bavjc60s2wynfawb
title: Document pinned CLI runner fallback patterns
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - guidelines
  - security
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0sv2xc7j6wnb9xzsep7fg
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T19:17:42.717Z
updated_at: 2026-05-25T23:39:37.931Z
---
setup.ts. TBD_SESSION_SCRIPT (line 126) and the AGENTS bootstrap should be local-first then pinned fallback: try tbd on PATH, else npx --yes get-tbd@<install-time-version>. Never emit an unpinned runner. Pinning serves supply-chain hardening AND team/agent behavioral consistency. Apply to session script + AGENTS bootstrap + SKILL text.
