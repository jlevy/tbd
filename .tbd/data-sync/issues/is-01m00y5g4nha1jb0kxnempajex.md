---
type: is
id: is-01m00y5g4nha1jb0kxnempajex
title: "f08: reshape the integration config into target/policy/labels/identity groups"
kind: feature
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-2
  - multi-repo
dependencies:
  - type: blocks
    target: is-01m00v3wqaatz90kaztwafsz1c
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T20:07:12.789Z
updated_at: 2026-08-14T20:07:35.328Z
---
The provider block mixes five concerns as flat siblings, grown one key at a time: enabled + team_key + project (where) + policy + select-legacy + max_nesting (what) + mirror_labels + create_labels (how marked) + user_map (who). Adding repo labels and future mode decisions as more flat keys sets the snowflake trend permanently.

Reshape, riding the SAME f08 bump as the bead schema (moves inside the block are format-gated by the same rule that gated f07 — one ceremony, not two):

  integrations:
    sync_on_tbd_sync: true
    linear:
      enabled: true
      target: { team_key: TBD, project: tbd }   # WHERE
      policy: default                            # WHAT (absorbs max_nesting into policy.outbound)
      labels:                                    # HOW marked
        origin: true      # plain 'tbd' label — default ON in every mode
        repo: auto        # 'repo' group label: auto (git origin) | <name> | false
        mirror: false     # was mirror_labels
        create: true      # was create_labels
      identity: { user_map: {} }                 # WHO

Decisions:
- Labels default ON in every integration mode (customizable per key). Zero config gets full marking.
- The MODE is deliberately not serialized — it is a claim about other repos' configs this one cannot verify. Only local fact is stored; doctor infers cross-repo risk.
- policy was already the right pattern (preset name or full object); it absorbs max_nesting.
- Legacy select alias retires; migration is mechanical and lossless (select folds into policy.outbound exactly as the runtime resolver already does).
- Same grouped shape serves github (target: {repo: owner/name}).
- After f08, config keys and bead fields are both preserve-unknown, so the next decision is a value in an existing group or a new optional group — no further bumps.

Depends on tbd-8ksq (the f08 machinery). Gates tbd-3m0j (labels config lives in the new shape, shipped once).

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §4.7, E20
Spec: plan-2026-08-14-external-sync-and-traceability.md Phase 2
