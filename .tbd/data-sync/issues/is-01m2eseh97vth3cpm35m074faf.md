---
type: is
id: is-01m2eseh97vth3cpm35m074faf
title: Release notes and release gate for the coordination stack
kind: task
status: closed
priority: 1
version: 14
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2erp0t0njvw8medbk3x70vz
hold: null
hold_until: null
created_at: 2026-09-14T01:45:31.686Z
updated_at: 2026-09-16T10:07:39.338Z
started_at: 2026-09-16T06:37:08.142Z
closed_at: 2026-09-16T10:07:39.337Z
close_reason: "Released get-tbd 0.9.0 end to end: PR #299 merged at f005c19d2129b2e86f6d4cb43d2776b8c03f2f7b after full local/downstream/live Linear validation; exact-SHA main CI 35081366182 passed; v0.9.0 release workflow 35082264977 published npm and GitHub successfully; public exact-version install reports 0.9.0 with signed npm/SLSA attestations."
resolution: null
duplicate_of: null
extensions:
  linear:
    id: 2f20c626-78c2-4a48-9904-5f80572914a7
    linked_at: 2026-09-16T08:28:28.343Z
---
The repository composes release notes at release time from CHANGELOG (no changesets). Items the coordination stack adds, from the release-compatibility review:

* identity.agent_map is now honored: invalid values fail integration commands (tbd-tia7), valid values send delegateId on --push, which can start Linear Agent Sessions (tbd-80vz).
* Upgrade every clone: comment lineage protection (#279) only holds when the merging client is upgraded; a v0.8.1 merger still moves comments onto a replacement link.
* Mixed-version teams: `tbd setup --auto` rewrites the AGENTS.md block and skill files differently on old and new clients, and doctor reports the other version's block as stale.
* Changed strings: `tbd status` hint now `tbd setup --auto`; `integration comment` success message and help; unconfigured `integration status` example nests `target:`; adapter errors and the mapping warning say `identity.user_map` / `identity.agent_map` (visible in JSON sync warnings); prime --brief adds the `tbd start` claim step and a corrected Beads warning.
* Conflict counts in `tbd sync` can rise: a relink on one side plus an unrelated edit on the other now counts a namespace conflict.
  Also gate the release on the tbd sync attic decision (tbd-ajq2) and on tbd-od0z (main since #264 widens the Linear alternation).

Update 2026-09-14: tbd-ajq2 decided (sync always saves conflicts to the attic; attic documented as a recovery store), so the release notes describe attic recovery rather than a git-history caveat.

2026-09-14: Release 1 is stage B of the merge, release, and format upgrade map in the stability sprint plan (PR #277). Before tagging, in addition to the notes: tbd-od0z landed; tbd-ajq2 landed; pnpm qa:upgrade-package and pnpm release:verify pass; and because generated agent surfaces change, the packed candidate is validated in a fresh first-party downstream checkout (docs/development.md release step 4). User upgrade: npm install -g get-tbd@latest, then tbd setup --auto and commit the generated-surface diff; no format migration.

2026-09-14: the stack is on main. Add as release gates: tbd-s3zx (third-party extensions comments rewritten on merge, now reachable from main), tbd-apnu, tbd-cskr.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): release notes state 0.8.1 as the minimum for any clone that runs integration sync (0.7.x already drops base.slot and refinement\_\* on rewrite, and leaves resolution set on reopened beads), and state any further minimum that tbd-s4kb (T3) requires for the Backlog mapping.

## Notes

Release v0.9.0 completed 2026-09-16.

Release identity and publication:

* Stabilization PR #298 merged as 118929d68c6cc4aa02c176f4df6587d094ed943e.
* Release PR #299 merged as f005c19d2129b2e86f6d4cb43d2776b8c03f2f7b.
* Exact-merge-SHA main CI run 35081366182 passed before tagging.
* Tag v0.9.0 points to f005c19d2129b2e86f6d4cb43d2776b8c03f2f7b.
* Release workflow 35082264977 passed all steps, including production audit, build, publint, packed web proof, eight packaged upgrade proofs, metadata and clean-checkout checks, npm OIDC publication, and GitHub Release creation.
* GitHub release: https://github.com/jlevy/tbd/releases/tag/v0.9.0 (public, non-draft, non-prerelease; published 2026-09-16T09:58:36Z).
* npm serves get-tbd@0.9.0 and dist-tag latest=0.9.0. Tarball shasum d94a847935c05072944d4048d587c1a17f1db5c9; integrity sha512-XB+oxBqR6oT6CqdmWqAxfRMPI9RZ5ofAEdU91+I+tC/lmwhwH7XqRk7y4m/KLB9WqtYKK9dTvr5jQR7jg57zBA==.
* npm exposes two signed attestations: npm publish v0.1 and SLSA provenance v1. The workflow recorded Sigstore transparency-log index 2859019020.
* An isolated public-registry install of exact get-tbd@0.9.0 reported package version 0.9.0 and `tbd --version` 0.9.0.

Validation evidence:

* Final local `pnpm run ci`: 176 test files, 2,655 passed, 1 skipped, plus format, lint, typecheck, and build.
* The successful pre-push hook independently repeated check, build, the 2,655-test suite, and the package-age gate (31 pins, 0 violations).
* `pnpm release:verify` passed build and publint.
* `pnpm qa:upgrade-package` passed all eight scenarios: 0.7.0 f08, 0.4.2 f06, 0.5.0 f06, legacy-remote recovery, coexistence, exact-0.8.1 config roundtrip, parser proof, and mixed-version Linear proof.
* Focused stabilization suite: 311 tests; built-CLI E2E: 24/24; CLI sync tryscripts: 214.
* `pnpm audit --prod` found no runtime vulnerabilities. The 36 build/test-only advisories remain tracked in tbd-0am0. The package-age gate passed 31 pins with 0 violations.
* Hosted release-PR CI passed Ubuntu Node 22.12 and 24, macOS Node 24, Windows Node 24, coverage/lint, benchmark, and DeepSource. One load-sensitive Windows 60-second setup-flow timeout passed on rerun in 8m26s; the same test passed in both final local full suites.

First-party and live-system proof:

* A `TBD_VERSION_OVERRIDE=0.9.0` tarball was installed into a fresh tryscript clone. `tbd setup --auto` was idempotent across two runs; the six-file setup patch had SHA-256 89efe591d68a6c38c7d43852cd786844481ff9db7c9174ae9d32771ff17548c4.
* The downstream format/docs/lint/typecheck/build/publint/package-smoke, v0.1.7 compatibility replay (108 assertions and 16 reviewed CLI changes), 252 tests, and self-tests passed. Its only `pnpm verify` failure was the pristine downstream repository's three pre-existing dev-tool advisories; the candidate production artifact audited clean.
* Live Linear convergence completed with guarded writes 52 -> 48 -> 4 -> 0. The final dry-run had no pushes, pulls, divergences, conflicts, overwrites, skipped pushes, failures, comment work, imports, or archives. Only 24 intentional max-nesting outbound exclusions and 21 standing unmapped-assignee warnings remained.

Compatibility and operator guidance:

* Repository format remains f08; no format migration is required.
* Every clone that runs `tbd integration sync` must upgrade to 0.9.0 before syncing again. Version 0.8.1 must not remain a concurrent integration-sync writer; 0.9.0 repairs its legacy state once the older writer stops.
* Install with `npm install -g get-tbd@0.9.0`, then run `tbd setup --auto` and commit the generated-surface diff.
