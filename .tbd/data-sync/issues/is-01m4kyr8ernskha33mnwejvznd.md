---
type: is
id: is-01m4kyr8ernskha33mnwejvznd
title: Add opt-in coordination guidance and explicit claim-conflict handling
kind: task
status: in_progress
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-pr324-ci-01a127df
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
child_order_hints:
  - is-01m4madt9jmnbg4npfwpyge98r
  - is-01m4manp9y8srxqpyce3sbq1xe
hold: paused
hold_until: null
created_at: 2026-10-10T22:25:49.004Z
updated_at: 2026-10-11T02:25:50.796Z
started_at: 2026-10-10T22:26:03.414Z
---
Add a lightweight, optional coordination shortcut or guideline for projects with multiple collaborators. Clarify that tbd start claims are advisory, that skipped claims must be checked explicitly, and that same-clone and cross-clone behavior differ. Add minimal routes from the baseline skill, delegation, and handoff guidance. Preserve lightweight use: do not require beads, sync, or network access for every session, read, or trivial task. Do not add a distributed lease. Assess released CLI compatibility before changing start exit behavior; prefer structured explicit outcomes and documentation unless a narrowly compatible runtime improvement is proven. Coordinate scope with tbd-6nmq and tbd-zxg6 rather than duplicating their identity and worker-loop implementation.

## Notes

Delivered proposal in https://github.com/jlevy/tbd/pull/324 from codex/coordination-guidance (79c77e30, 2e7a5f31, b1f34739): opt-in coordinate-collaborators shortcut; structured single-bead claim conflict checks without exit-code change; distinct identity and same-clone/cross-clone limits; checkpoint, takeover, and handoff acknowledgement guidance; minimal baseline/prime/delegation/handoff routes; actor-axis contract test; generated inventories and installed skills refreshed. Local focused validation passed (23 tests, dedicated installed-skill drift, and doc-references 2/2); broad pre-push run reached 3027 passes and 3 skips with only a transient 10-second doc-reference setup timeout, then that suite passed alone in 43.5 seconds. PR CI platform tests all passed (Ubuntu Node 22, Ubuntu Node 24, macOS Node 24, Windows Node 24); Benchmark and DeepSource passed. Coverage & Lint remains failed before branch lint/coverage because pnpm audit --prod finds newly published GHSA-hp3w-g68c-fv3c through the unchanged gray-matter/js-yaml/argparse/sprintf-js lock chain. No patched sprintf-js release or supported within-range lock-only fix exists; no suppression or unsupported major override applied. Separate dependency tbd-tfyc owns remediation. Keep this contribution bead open until the dependency is resolved and the proposal is accepted; PR was not merged.

<!-- tbd:dispositions v=1 review=A head=845d55c196929388fba81db76bc7e17553532331 -->
## Session checkpoint — stopped at the user's request

All implemented work is pushed at `845d55c196929388fba81db76bc7e17553532331`. The working tree is clean. The user requested a checkpoint because credits are exhausted; this PR is **not ready to merge**.

### Review A dispositions

- A1: production dependency audit fixed by removing gray-matter and its ten-package dependency subtree; centralized YAML-only parsing uses the existing YAML library. Production audit and Coverage & Lint now pass. Compatibility correction remains open below; this is not final acceptance of the parser change.
- A2: fixed the claim/verified continuation acceptance rule and added actor-axis assertions.
- A3: qualified synchronization by separate-clone exchange or project policy, preserving lightweight/local use; regenerated installed guidance.
- A4: resolved and normalized actor identities before delegation/uniqueness checks.

[Review A](https://github.com/jlevy/tbd/pull/324#pullrequestreview-5481539139) is the full senior engineering review. [Review B](https://github.com/jlevy/tbd/pull/324#pullrequestreview-5481597542) is Astra's completed security review: 30/30 files, 58 focused tests, 360 execution probes, zero security findings. The dedicated correctness review was interrupted and is **incomplete**, with no formal Review C published.

### Current verification

[CI run 38104346646](https://github.com/jlevy/tbd/actions/runs/38104346646): Coverage & Lint, macOS Node24, Windows Node24, Ubuntu Node22, Benchmark and Secrets passed. Ubuntu Node24 passed 3045 unit tests, then failed the packed upgrade proof. Local focused tests, normal commit formatting/lint/typecheck hooks, prepush quality/build/package-age checks passed. Broad local tests were limited by external scratch capacity; hosted CI ran them. Existing development-only audit debt remains in `tbd-ujyy`; it was assessed separately from the clean production audit.

### Resume here

1. **tbd-7pdk — correctness defect, fix before merging.** Astra reproduced persisted issue corruption: `serializeIssue` with `extensions.text = 'one\u2028---\ntwo'`, followed by `parseIssue`, truncates the extension to `one\u2028` and moves the rest into description. The multiline closing-delimiter regex in `src/utils/frontmatter.ts` treats U+2028 as a line start inside the YAML scalar. Restrict recognition to physical YAML delimiter lines; add a serializer/parser round-trip regression and assess U+2029. Additional LF `|+`/`>+` differences surfaced in an old/new probe but their significance remains unassessed. Resume dedicated correctness review under **tbd-wsz5**.
2. **tbd-4x46 — failing packed upgrade proof.** Historical published packages share candidate `node_modules`, so old baselines cannot import removed gray-matter. Proposed design, **not implemented or tested**: separate non-workspace historical runtime fixture, exact roots and 67-package closure/integrities from the reviewed original lock, installed frozen/prod with scripts disabled and cooldown retained. All five pinned baseline versions and published 0.10.0 have the same twelve dependency declarations. Link only historical clients to this fixture; candidate keeps its clean production graph. Explicitly reject unsupported baseline manifests. Known old dependency exposure must stay confined to trusted historical compatibility inputs. Validate isolation/install safeguards and run the packed proof.
3. **tbd-4tfn — three preexisting malformed YAML headers.** Quote/fold colon-space descriptions in `docs/project/specs/done/plan-2026-07-28-agent-cli-bash-fallbacks.md`, `packages/tbd/docs/references/docmap-format.md`, and compatibility in `packages/tbd/docs/shortcuts/system/skill-minimal.md`.
4. Re-run CI at the final head, finish correctness review, publish remaining dispositions, and reconcile beads. No merge authorized in this session.

Coordinator parent: `tbd-m6rr`; contribution: `tbd-9fvc`. Source checkout: `/Users/levy/wrk/github/tbd-coordination-01a127df`, branch `codex/coordination-guidance`. Resume with one source writer and one tracker writer, refresh claims rather than assuming stopped agents remain active. Detailed local evidence remains under `/Volumes/spud-ext1/agent-scratch/tbd-pr324-fixes-01a127df`, `/Volumes/spud-ext1/agent-scratch/astra-pr324-security-01a127df`, and `/Volumes/spud-ext1/agent-scratch/tbd-pr324-correctness-01a127df`; the facts needed to resume are captured above and in beads.
