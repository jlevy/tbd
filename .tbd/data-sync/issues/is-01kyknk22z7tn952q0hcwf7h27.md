---
type: is
id: is-01kyknk22z7tn952q0hcwf7h27
title: "Point-of-need doc pass: skill tables, prime, manual, design; generalize NEVER-loop rule"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-07-28T06:11:30.526Z
updated_at: 2026-07-29T02:56:22.964Z
closed_at: 2026-07-29T02:56:22.964Z
close_reason: "Delivered in PR #198 (agent CLI ergonomics round 2): bulk show, variadic doc readers, variadic deps + create --depends-on, --spec suffix matching, did-you-mean/search-by-ID/overflow hints, point-of-need doc pass. All suites green."
---
Point-of-need doc pass; lands after tbd-r2zr and tbd-hy6b so the advertised forms are real (dep edges wired).

- skill-baseline/brief/minimal: "Show me issue X" row becomes tbd show <id1> [<id2> ...]; new rows "Where do things stand on spec X?" -> tbd list --spec <path> and "label several beads" -> tbd update A B C --add-label x; Finding-Work table gains --limit/--count/--sort updated/--max-lines; guidelines-group instruction becomes one variadic call.
- Generalize the NEVER-loop rule beyond close/reopen/update: "about to loop or pipe around tbd? the bulk/filter form exists - check --help first", naming show and guidelines explicitly.
- Same edits in tbd-prime.md and tbd-docs.md command reference; tbd-design.md section 4.4 Show documents the bulk contract.
- Replace update-specs-status.md jq pipeline (lines ~89-91) with tbd list --specs / --json (no code dependency).
- Regenerate agent surfaces (tbd setup --auto) so .claude/.codex skills pick up the new tables.
