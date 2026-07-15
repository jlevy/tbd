---
type: is
id: is-01kxj31yy0vb595rat94gsdr2f
title: Canonicalize allowed-tools and package-runner permission guidance
kind: task
status: open
priority: 1
version: 2
labels:
  - documentation
  - security
  - agent-skills
dependencies:
  - type: blocks
    target: is-01kxj32069ar3a92ajpq41n0yf
parent_id: is-01kxj30jgtpk96nys50nr6peve
created_at: 2026-07-15T05:12:39.615Z
updated_at: 2026-07-15T05:13:44.603Z
---
Align the guideline and tbd dogfood artifacts with the Agent Skills specification.

Acceptance criteria:
- Describe allowed-tools as optional, experimental, implementation-dependent, and a space-separated string.
- Use canonical examples such as Bash(mycli:*) Read Write; remove comma-separated examples from current normative sources.
- Explicitly reject Bash(npx:*), Bash(uvx:*), and other general package-runner wildcards even when the command body pins a package.
- Prefer the installed narrow entrypoint or omit pre-approval and let the agent request permission for a pinned fallback.
- Update packages/tbd/docs/install/claude-header.md and regenerate all committed tbd skill surfaces from the local build so tbd follows its own rule.
- Add focused regression coverage for canonical frontmatter and generated-copy drift; do not rewrite historical research solely to modernize old examples.
