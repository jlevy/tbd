---
type: is
id: is-01m0dsa8pe5fsxx8c82wf5gfhx
title: Rivet Sandbox Agent session adapter
kind: feature
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies: []
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:33.741Z
updated_at: 2026-08-19T19:52:33.741Z
---
Rivet takes a caller-chosen session id, so pass the bead id and the linkage becomes an identity rather than a lookup. FIRST STEP: probe that createSession accepts an arbitrary string such as a bead id; the research brief infers this from the README signature and marks it unverified in Appendix A. Do not ship on the install path: Apache-2.0 but a young project with no commits since 2026-06-19.
