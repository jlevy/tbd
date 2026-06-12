---
type: is
id: is-01ktybyydyjx5gavcach1c0jn9
title: Pin repren skill fallback instead of uvx repren@latest
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - supply-chain
  - agent-skills
dependencies: []
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-06-12T16:52:05.692Z
updated_at: 2026-06-12T16:52:05.692Z
---
PR #153 review finding: the repren skill allows and recommends uvx repren@latest as a fallback. This conflicts with SUPPLY-CHAIN-SECURITY.md rule 6, which says to avoid uvx/npx/dlx without an explicit version pin and review because it downloads and executes latest registry code. Pin a reviewed repren version, remove the uvx fallback, or route the fallback through the documented supply-chain exception process.
