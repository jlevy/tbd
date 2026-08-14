---
type: is
id: is-01kzywynn9xx4987b971j4kxah
title: Raise supported Node baseline to 22.12
kind: task
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kzysmb4s1ntzjgq5e7yhfpmr
created_at: 2026-08-14T01:07:31.624Z
updated_at: 2026-08-14T02:05:08.552Z
closed_at: 2026-08-14T02:05:08.551Z
close_reason: "Resolved in PR #215: Node.js 22.12.0 baseline, consistent bundled documentation, patched js-yaml production graph, clean release audits, global installation, no-Linear smoke, and hosted Linux/macOS/Windows CI all verified."
---
Revise PR #215 to make Node.js 22.12.0 the published and development runtime floor, remove the Node 20 compatibility gate, align public docs and the active integration plan, exercise the minimum version on Linux CI, validate the packed CLI with Linear disabled and configured, and get hosted CI green.
