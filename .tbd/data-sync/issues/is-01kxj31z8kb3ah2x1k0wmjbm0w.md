---
type: is
id: is-01kxj31z8kb3ah2x1k0wmjbm0w
title: Make the integration ladder and checklist genuinely rung-specific
kind: task
status: closed
priority: 2
version: 3
labels:
  - documentation
  - agent-skills
dependencies:
  - type: blocks
    target: is-01kxj32069ar3a92ajpq41n0yf
parent_id: is-01kxj30jgtpk96nys50nr6peve
created_at: 2026-07-15T05:12:39.955Z
updated_at: 2026-07-15T05:59:11.357Z
closed_at: 2026-07-15T05:59:11.355Z
close_reason: L0-L3/L2b ladder and rung-specific checklists rewritten around conditional machinery.
---
Remove the current contradiction between the low-rung advice and the universal CLI checklist.

Acceptance criteria:
- Separate requirements for all skills, L1 CLI-backed skills, L2 installers, L2b managed AGENTS.md installers, and L3 platforms.
- Require JSON only when output is naturally structured or automation benefits; do not require it for stream/file transformers such as formatters.
- Keep local-first execution, pinned fallback, actionable failures, and sandbox behavior at L1.
- Put deterministic complete-bundle installation, scope rules, and discovery drift checks at L2.
- Put marker-bounded AGENTS.md, format stamps, forward guards, user-content preservation, and duplicate collapse at L2b.
- Put setup, prime, lifecycle hooks, brief/full tiers, DocCache, knowledge injection, and migration orchestration only at L3.
- State that multi-file bundle integrity applies whenever a bundle is published, independent of rung or format-stamp needs.
- Name Flowmark and Practical Prose as L2b references and tbd as the L3 reference.
