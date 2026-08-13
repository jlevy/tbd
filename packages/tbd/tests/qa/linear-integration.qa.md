---
title: 'QA Playbook: Linear Integration'
description: Repeatable API-driven release validation for the provider-generic external tracker compatibility contract
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# QA Playbook: Linear Integration

This playbook validates the compatibility matrix in
`plan-2026-08-10-external-tracker-integrations.md`. Direct provider API mutations and
reads are the live test driver and oracle.
The built tbd CLI runs in a disposable git repository.
Linear’s web UI is one final parity check, not a substitute for repeatable round trips.

## Release Gate

Load `LINEAR_API_KEY` from a gitignored `.env`, then run:

```bash
pnpm --filter get-tbd qa:linear-live -- --team TBD --project tbd
```

Both `--team` and `--project` are mandatory release-gate inputs.
Omitting either fails before setup, so `automatic-inbound-scope` can never be counted
without exercising an actual configured project boundary.

Set `TBD_QA_BIN` to a packed or globally installed candidate to validate exactly what a
user will execute. Set `TBD_QA_KEEP=1` only while investigating a failure; otherwise the
runner removes its disposable repository.
The runner never prints the credential, removes it from child-process environments,
gives the candidate a private gitignored `.env`, and archives every Linear fixture
during cleanup.

A passing run prints one line for each stable scenario id and a final count.
A failure exits nonzero, names the failed assertion, still attempts provider cleanup,
and retains no successful result marker.

## Scenario Contract

| Scenario | Provider API action | tbd action and assertion |
| --- | --- | --- |
| `setup` | Resolve viewer, team, project, and workflow-state UUIDs | Initialize a disposable repository, configure the candidate, and prove `integration status` reaches the provider |
| `explicit-import` | Create one isolated root item | `sync --pull --external` creates one canonical bead and performs no provider write |
| `deferred-claim-replay` | Read attachments directly | A full sync replays the pull-only ownership intent exactly once |
| `tbd-to-provider-fields-comments-assignee` | Read native state, priority, assignee, description, and comments | Change canonical fields and author a comment locally; full sync produces the exact provider values once |
| `provider-to-tbd-fields-comments-assignee` | Mutate fields, clear the assignee, and add a comment through GraphQL | Pull-only produces the expected canonical bead, preserves comment identity, and persists no email |
| `provider-created-hierarchy` | Create a sub-issue under the root | Explicit pull imports it under the linked local parent without flattening or changing the provider parent |
| `automatic-inbound-scope` | Create one same-team item inside the configured project and one outside it | Automatic discovery reports the in-project item and excludes the outside-project sentinel; providers without a narrower configured scope record the scenario as not applicable |
| `concurrent-conflict-recovery` | Make a provider edit while tbd has a different edit | Full sync applies the configured tie-break, archives the loser, and posts one conflict report |
| `exact-once-settle` | Count comments before and after | The next full sync reports `nothing to do` and adds no duplicate comment |
| `orphan-detection` | Archive the child through GraphQL | Pull-only reports the linked item orphaned and leaves its bead intact |
| `cleanup` | Archive every remaining fixture | Remove the disposable repository unless explicitly retained |

The import-safe `scripts/provider-live-qa-contract.ts` module owns these scenario ids
and the completion checklist.
The Linear script supplies only its provider API driver and assertions.
A GitHub driver must reuse the same checklist against disposable issues and a repository
or project scope appropriate to GitHub.
GitHub-only behavior, such as read-only PR association and permission scopes, adds
scenarios; it does not rename or weaken this shared contract.

## Evidence Layers

The live runner is the final layer, not the entire test strategy:

1. Pure tests prove mapping, selection, three-way field outcomes, hierarchy ordering,
   comment union, and format invariants.
2. The HTTP mock proves pagination, API quirks, rate-limit handling, direction modes,
   partial failures, crash replay, and exact-once recovery deterministically.
3. Built-CLI tests prove argument parsing, config loading, credentials, exit codes, bulk
   refusal, and real git/worktree behavior.
4. The live runner proves those layers match the current provider API.
5. A human opens the root fixture before cleanup only when visual parity needs review;
   the API assertions remain the release evidence.

Failures in any applicable compatibility-matrix row block release.
Intentional boundaries—comment edits/deletes, reactions, threaded layout, provider-side
deletion, and simultaneous cross-repository first claims—must remain explicit in the
matrix and must never be reported as synchronized.

## Extended Concurrency Soak

Run the established two-clone soak before a provider release candidate when sync-engine,
bridge-merge, or intent semantics change:

1. Clone A changes a field and syncs.
2. Clone B, without first pulling A, authors a different comment and syncs.
3. Alternate two more full syncs from both clones.
4. Verify both clones and Linear contain both operations once, bridge files have no
   conflict markers, and the final runs are quiet.

The 2026-08-13 Linear release-candidate run passed this soak along with forced conflict
recovery, archived-item detection, explicit read-only import, and comment exact-once
replay.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
