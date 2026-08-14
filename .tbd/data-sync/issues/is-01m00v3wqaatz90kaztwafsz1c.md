---
type: is
id: is-01m00v3wqaatz90kaztwafsz1c
title: Origin and repo labels on mirrored issues; origin-scoped inbound scan
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
  - multi-repo
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T19:13:54.410Z
updated_at: 2026-08-14T19:14:10.688Z
---
PROBED: two repositories pointed at one Linear team+project see each other's mirrored items in their inbound scans. Under the default inbound: report, repo A's items appear in repo B's importable list on every sync (nothingToDo never true, and an agent is invited to import beads that belong to another repo). Under inbound: auto, every foreign item fails assertExternalUnclaimed into report.failures, and the folded tbd sync converts per-item failures to a non-zero exit — every sync of each repo fails while the other is active. Each claim check also costs one listAttachmentUrls request per foreign candidate per sync. (F15)

There is also no origin marker at all (F16): tbd applies labels only as status carriers, so a human using Linear manually cannot filter agent-synced items in or out, and the tbd://bead/<displayId> claim names a bead but not a repository.

Fix, which makes topology O2 (one team, one shared project, many repos) first-class AND answers the human-clutter concern:
- Apply a 'tbd' label plus 'repo:<name>' to every mirrored issue, via the status-carrier machinery that already creates/attaches labels regardless of mirror_labels. Name defaults to display.id_prefix (committed, stable, per-repo); integrations.linear.repo_label overrides.
- Skip inbound candidates carrying another repo's repo: label — silently, BEFORE the per-candidate claim check. Untagged (human-authored) items still flow.
- Include the repo name in new claim attachments so the one-source guard's refusal can say who holds the claim.

Topology table for docs: O1 team-per-repo works TODAY with zero changes (scans are team-filtered; structurally isolated; per-team prefix names the repo). O3 project-per-repo + shared initiative also works today. O2 needs this bead.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §4.5, E18
Spec: plan-2026-08-14-external-sync-and-traceability.md Phase 3
