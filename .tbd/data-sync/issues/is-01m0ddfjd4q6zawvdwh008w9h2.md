---
type: is
id: is-01m0ddfjd4q6zawvdwh008w9h2
title: Name the .env source in integration status output
kind: task
status: open
priority: 0
version: 1
assignee: josh
labels: []
dependencies: []
parent_id: is-01m0ddenmjsxeqm98ytfpcfc11
created_at: 2026-08-19T16:25:44.612Z
updated_at: 2026-08-19T16:25:44.612Z
---
`tbd integration status` prints a masked credential and its origin as `********abcd from .env`, which does not say which `.env`. Once resolution can reach outside the current directory, that ambiguity hides where a credential came from and makes a layer-2 override undiscoverable.

Print the path the credential was actually loaded from. Keep the masking unchanged: never print the key itself.
