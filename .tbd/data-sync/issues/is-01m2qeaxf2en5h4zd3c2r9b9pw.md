---
type: is
id: is-01m2qeaxf2en5h4zd3c2r9b9pw
title: Add a security-rules guideline and slim review-code-security to pointers
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-17T10:24:28.641Z
updated_at: 2026-09-17T10:24:28.641Z
---
Follow-up from tbd-fwo5 (2026-09-17). review-code-security currently holds the only application-security substance in tbd, inverting the convention that shortcuts are procedure and guidelines are knowledge; supply-chain-hardening scopes itself to installs. Scope: a language-neutral security-rules guideline (category general) covering trust boundaries and untrusted input (argument injection, parser bounds, prototype pollution, prompt injection for agent tooling), secret handling and landing spots, local-server exposure (loopback, Origin/Host checks), subprocess inheritance and untrusted-repository execution, and CI workflow-authority items, with a quick-scan table in the code-review-rules style; then shrink review-code-security's checklist to pointers. Not part of the PR #309 plan.
