---
type: is
id: is-01kzrthdrgaakga7fj38sry0et
title: "Sync surfaces: independent runs with error rollup, all-surface default"
kind: feature
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T16:29:53.806Z
updated_at: 2026-08-11T16:30:11.905Z
closed_at: 2026-08-11T16:30:11.904Z
close_reason: Implemented in e47f4505 with e2e coverage (broken tracker endpoint; docs+issues still sync, bead intact) and recorded in the spec.
---
Owner direction on PR #206: plain tbd sync must cover docs, issues, and enabled trackers so an agent closing a session runs one command; each surface runs independently so one failure (expired credential, unreachable remote) never stops another; failures roll up by surface name; no data lost from a working surface because another broke. Implemented in e47f4505 with --docs/--issues/--integrations selectors, the tracker run nested between git pull and push with a standalone fallback, and sync_on_tbd_sync defaulting true. Recorded in the spec's 'Sync surfaces' section.
