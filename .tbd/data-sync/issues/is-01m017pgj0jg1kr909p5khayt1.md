---
type: is
id: is-01m017pgj0jg1kr909p5khayt1
title: "PR #227 R1: tracker-skip notice was verbose-only, so ordinary runs stayed silent"
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels: []
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T22:53:47.455Z
updated_at: 2026-08-14T22:54:22.365Z
closed_at: 2026-08-14T22:54:22.365Z
close_reason: "Fixed in e263b76 on PR #227; see each bead for the specific change and its verification."
---
R1 (Medium) from the PR #227 review, and it was correct: the notice went through OutputManager.info(), which emits only under --verbose or --debug and is suppressed by --json (output.ts:410-416), and the guard also skipped it entirely on dry runs. So 'tbd sync --issues' stayed exactly as silent as before — the defect that part of the PR was meant to fix.

FIXED in e263b76: routed through output.data(), giving the structured form under --json ({"skippedSurfaces":["integrations"]}) and the default-visible notice() otherwise; dry runs report it too. New tests/cli-sync-surface-honesty.tryscript.md covers the default, dry-run, and JSON forms plus negatives (no integration configured, tracker explicitly selected, full sync, --status, and sync_on_tbd_sync: false). 11 assertions.
