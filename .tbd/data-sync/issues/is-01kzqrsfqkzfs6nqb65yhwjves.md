---
type: is
id: is-01kzqrsfqkzfs6nqb65yhwjves
title: init accepts id prefixes the display-id parser cannot resolve
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-08-11T06:40:06.386Z
updated_at: 2026-08-11T06:40:06.386Z
---
tbd init --prefix accepts prefixes containing digits (e.g. e2e), but ExternalIssueIdInput's prefix group is letters-only (/^([a-z]+-)?[0-9a-z]+$/), so every display id in such a repo fails resolveToInternalId with Unknown issue ID while list/show render them fine. Found via the integration CLI e2e suite (prefix e2e). Fix: either validate the prefix at init to match what the parser accepts, or widen the parser; both ends must agree.
