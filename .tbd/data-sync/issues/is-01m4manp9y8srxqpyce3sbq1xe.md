---
type: is
id: is-01m4manp9y8srxqpyce3sbq1xe
title: Address PR324 senior review A and restore green CI
kind: task
status: in_progress
priority: 2
version: 14
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: sol-pr324-fixes-01a127df
labels: []
dependencies: []
parent_id: is-01m4kyr8ernskha33mnwejvznd
child_order_hints:
  - is-01m4map1625m5m4463950gymkt
  - is-01m4map1jwnm2s1hw26wvs0m88
  - is-01m4map1z8hhmcpqjcxr4e8frq
  - is-01m4maqtrqmjmzea7w8m73t8mj
  - is-01m4maqvrcm3yda3aa4k3rfjvt
  - is-01m4mavm9rmssr0zvsr5k06gme
  - is-01m4mbt3yte2j9433cr22xty72
  - is-01m4mc5v1s32vcb294km4ybchc
  - is-01m4mce293f052r520wnv840f6
hold: paused
hold_until: null
created_at: 2026-10-11T01:54:07.805Z
updated_at: 2026-10-11T02:25:50.140Z
started_at: 2026-10-11T01:54:20.311Z
---

## Notes

Astra Review A at b1f34739 published four findings. Sol owns source fixes for A1-A4 plus discovered BOM execution bypass tbd-gd3v; coordinator owns tracker writes. Checkpoint: 58 focused parser/Markdown tests pass; all 321 previously valid files in the 324-file corpus preserve detection/data/body, same 3 malformed YAML headers reject. Lockfile pruning removes ten packages and js-yaml@3 override with no additions/upgrades; pnpm audit --prod clean. Claim instruction fixes and generated-surface checks pending; no acceptance closure until pushed CI and dedicated security/correctness reviews finish.
Commit checkpoint: 845d55c196929388fba81db76bc7e17553532331 addresses A1-A4 and BOM bypass tbd-gd3v. Normal precommit format, Markdown, lint and typecheck passed. Focused tests passed (183 cases across initial run/rechecks, including 58 parser/Markdown and 10 actor cases); frozen lockfile validation and production audit clean, with ten unused packages removed and no additions/upgrades. Push in progress; full hosted CI and dedicated reviews pending. Development-only audit remains tracked in tbd-ujyy with current advisory evidence.

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
