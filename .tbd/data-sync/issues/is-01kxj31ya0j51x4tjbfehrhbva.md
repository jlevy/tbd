---
type: is
id: is-01kxj31ya0j51x4tjbfehrhbva
title: Document safe multi-file bundle publication and materialization semantics
kind: task
status: closed
priority: 1
version: 4
labels:
  - documentation
  - agent-skills
dependencies:
  - type: blocks
    target: is-01kxj31z8kb3ah2x1k0wmjbm0w
  - type: blocks
    target: is-01kxj32069ar3a92ajpq41n0yf
parent_id: is-01kxj30jgtpk96nys50nr6peve
created_at: 2026-07-15T05:12:38.975Z
updated_at: 2026-07-15T05:59:10.599Z
closed_at: 2026-07-15T05:59:10.598Z
close_reason: Bundle publication, materialization, ownership, rollback, and failure semantics documented.
---
Add the general rules demonstrated by Flowmark PR #64 and flowmark-rs PR #78.

Acceptance criteria:
- Treat SKILL.md and all referenced files as one logical directory bundle; validate and stage every artifact before publication.
- Prefer atomic same-filesystem directory replacement when ownership and platform semantics allow it.
- Describe dependency-first publication with link-bearing SKILL.md last precisely: it prevents a newly visible broken entrypoint but is not an all-files rollback; require backward-compatible/versioned resources or a stronger transaction for upgrades.
- Guard every managed artifact or perform a bundle-wide preflight; errors name the exact blocking artifact; temporary files are cleaned on all failures.
- Define deterministic stale-resource cleanup or a manifest for owned directories.
- Require failure tests for an uncreatable references path and mixed-version upgrade hazards.
- Distinguish printed SKILL.md text, temporary whole-bundle materialization, installed bundles, and self-contained inline content. A printed file with relative links must materialize the bundle or give an actionable installation route.
- Cover authored, CLI-installed, discovery-directory, npx skills add, and current npx skills use routes.
