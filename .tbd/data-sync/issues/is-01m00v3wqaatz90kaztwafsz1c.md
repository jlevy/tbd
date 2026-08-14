---
type: is
id: is-01m00v3wqaatz90kaztwafsz1c
title: Origin and repo labels on mirrored issues; origin-scoped inbound scan
kind: feature
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
  - multi-repo
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T19:13:54.410Z
updated_at: 2026-08-14T19:49:00.409Z
---
PROBED: two repositories pointed at one Linear team+project see each other's mirrored items in their inbound scans. Under the default inbound: report, repo A's items appear in repo B's importable list on every sync (nothingToDo never true, and an agent is invited to import beads that belong to another repo). Under inbound: auto, every foreign item fails assertExternalUnclaimed into report.failures, and the folded tbd sync converts per-item failures to a non-zero exit — every sync of each repo fails while the other is active. Each claim check also costs one listAttachmentUrls request per foreign candidate per sync. (F15)

There is also no origin marker at all (F16): a human using Linear manually cannot filter agent-synced items in or out, and the tbd://bead/<displayId> claim names a bead but not a repository.

THE THREE INTEGRATION MODES (working vocabulary):
- Mode 1: team per repo, one shared project. Works TODAY, zero changes — scans are team-filtered, isolation is structural, per-team prefix names the repo.
- Mode 2: one team, one shared project, repo labels. Needs this bead.
- Mode 3: one team, project per repo, shared initiative. Works today.

Fix (makes Mode 2 first-class AND answers the human-clutter concern):
- Apply a plain 'tbd' label plus a per-repository label in a Linear LABEL GROUP named 'repo' (created as repo/<name> — Linear's native namespace convention; only one label from a group per issue, matching one-repo-per-bead). Verified: Linear views support 'is not' label negation, so 'label is not tbd' hides agent traffic and the repo group filter selects one repository.
- The label names the GITHUB REPOSITORY: default is the repo name from the origin remote via parseRepoSlug (permalink.ts:27-37); sanitized owner-name on collision; display.id_prefix when no remote; integrations.linear.repo_label overrides. Avoid the literal owner/name form — '/' is Linear's label-group separator.
- Skip inbound candidates carrying another repo's repo-group label — silently, BEFORE the per-candidate claim check. Untagged (human-authored) items still flow.
- Include the repo name in new claim attachments so the one-source guard's refusal can say who holds the claim.
- Apply via the status-carrier machinery that already creates/attaches labels regardless of mirror_labels.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §4.5, E18
Spec: plan-2026-08-14-external-sync-and-traceability.md Phase 3
