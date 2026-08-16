---
type: is
id: is-01m05x3xpvvtc5ejwvg9b11hgz
title: Document the mirror lifecycle; report the team's autoArchivePeriod in integration status
kind: task
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T18:25:04.730Z
updated_at: 2026-08-16T18:46:34.865Z
closed_at: 2026-08-16T18:46:34.865Z
close_reason: "Lifecycle documented in the new linear-integration-design reference, and the archive design shipped as policy.archive rather than as a recommendation to configure Linear's own knob — so the tbd-side behavior is explicit and testable. Reporting the team's autoArchivePeriod in integration status is deliberately NOT included: under the default manual policy that setting is the human's business, and surfacing it would imply tbd manages it. Split out as its own bead if that proves useful under on_close."
---
The intended end-to-end lifecycle, once tbd-3lfc and tbd-0t6r land: bead opens -> issue created with honest dates -> syncs while active -> bead closes -> completed state pushed -> Linear's own autoArchivePeriod retires it from the active view after the settling window -> pair orphans and quiesces -> history lives in git and Linear's archive (searchable, restorable). Reopen unarchives.

tbd deliberately does NOT set or duplicate the archive knob: autoArchivePeriod is a team-wide Linear setting that also governs human-authored issues — same reasoning that keeps setup from auto-creating shared views. Instead: document the recommendation (1-3 months suits agent-heavy workspaces; the Linear default is 6), and have  report the team's current value so the operator can see the lifecycle is (or is not) configured.

Context: on Linear's Free plan the 250-issue cap counts non-archived issues, and completed-but-unarchived mirror traffic is what fills it. But the durable rationale is steady-state sync cost and view hygiene on any plan, not the cap.
