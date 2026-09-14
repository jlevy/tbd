---
type: is
id: is-01m1yzy5dsv4y13y9qc6qp2pfa
title: Forked-shortcut customization docs; docs/tbd/README.md regeneration in setup --auto; honest setup exit on failed writes
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-5
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:31:04.373Z
updated_at: 2026-09-14T02:58:58.119Z
---
GH #181. Add the six-step existing-shortcut workflow to new-shortcut.md and the Managing Docs section of tbd-docs.md, distinguishing forked managed docs (docs/tbd/<kind>/<name>.md) from project-only shortcuts. docs/tbd/README.md is regenerated only by docs fork (docs-fork.ts:190); regenerate it in setup --auto when forks exist. setup --auto prints 'All set!' (setup.ts:1679) and exits 0 after permission warnings on generated-file writes; end with 'Setup finished with N warning(s)' and exit 1 when a generated file could not be written.

Revision 2026-09-13 (plan review against main and PRs #278-#283): Corrections: README regeneration already runs in docs unfork (docs-fork.ts:325, :572) and doctor --fix (doctor.ts:2540, :2585), not only docs fork (:183). Regenerating it in setup --auto changes the stated rule at setup.ts:2239-2240 ('setup never writes the fork dir'); say so. The honest exit must cover fresh setup (:1874) and beads migration (:1781), which print 'Setup complete!', not only :1679. Asks from #181 not covered here are split into tbd-ddsp.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): exit 1 only on a real generated-file write failure. The upgrade harness and bootstrap scripts run setup and require success (validate-upgrade-package.mjs:301,329).
