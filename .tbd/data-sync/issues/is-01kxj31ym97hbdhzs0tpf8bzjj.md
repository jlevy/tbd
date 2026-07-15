---
type: is
id: is-01kxj31ym97hbdhzs0tpf8bzjj
title: Correct skill distribution, registry, and pinned-runner guidance
kind: task
status: open
priority: 1
version: 3
labels:
  - documentation
  - supply-chain
  - agent-skills
dependencies:
  - type: blocks
    target: is-01kxj31yy0vb595rat94gsdr2f
  - type: blocks
    target: is-01kxj32069ar3a92ajpq41n0yf
parent_id: is-01kxj30jgtpk96nys50nr6peve
created_at: 2026-07-15T05:12:39.304Z
updated_at: 2026-07-15T05:13:44.300Z
---
Refresh distribution guidance against the current vercel-labs/skills CLI and the project supply-chain policy.

Acceptance criteria:
- Replace the claim that registries install only Markdown with: installers materialize the skill directory but do not install the separate CLI distribution or guarantee an entrypoint on PATH.
- Explain L0 self-contained skills, L1 pinned zero-install CLI use, and optional L2/L2b self-install without requiring every CLI-backed skill to lead with one-time setup.
- Document current skills add and skills use behavior, project/global scope, and copy/symlink modes without freezing volatile agent counts.
- Automation examples pin both a separately vetted skills package version and a reviewed source tag/SHA. Apply the 14-day cool-off and audit before naming any concrete installer version.
- Label owner/repo shorthand as a convenience that intentionally tracks current upstream, not a reproducible automation form.
- Remove or isolate volatile star counts, skill counts, supported-agent counts, and dated marketplace statistics from durable baseline guidance.
- Keep tbd L3 bootstrap instructions as a valid tool-specific example, not a universal registry rule.
