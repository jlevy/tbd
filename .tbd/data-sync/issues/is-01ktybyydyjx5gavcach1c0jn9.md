---
type: is
id: is-01ktybyydyjx5gavcach1c0jn9
title: Pin repren skill fallback instead of uvx repren@latest
kind: bug
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - supply-chain
  - agent-skills
dependencies: []
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-06-12T16:52:05.692Z
updated_at: 2026-08-15T05:34:12.984Z
closed_at: 2026-08-15T05:34:12.983Z
close_reason: "Obsolete/resolved: the unsafe repren fallback is no longer present in the repository or published setup assets."
extensions:
  linear:
    id: 35ca8a8f-a997-482b-b287-d2bf254b54f0
    key: TBD-14
    url: https://linear.app/finterm-ai/issue/TBD-14/pin-repren-skill-fallback-instead-of-uvx-reprenlatest
    linked_at: 2026-08-10T19:37:16.885Z
---
PR #153 review finding: the repren skill allows and recommends uvx repren@latest as a fallback. This conflicts with SUPPLY-CHAIN-SECURITY.md rule 6, which says to avoid uvx/npx/dlx without an explicit version pin and review because it downloads and executes latest registry code. Pin a reviewed repren version, remove the uvx fallback, or route the fallback through the documented supply-chain exception process.
