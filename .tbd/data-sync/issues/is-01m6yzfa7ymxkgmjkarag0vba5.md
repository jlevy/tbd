---
type: is
id: is-01m6yzfa7ymxkgmjkarag0vba5
title: Prepare and validate the get-tbd 0.11.0 minor release
kind: task
status: closed
priority: 1
version: 16
delegate: codex@spud10
labels: []
dependencies: []
child_order_hints:
  - is-01m6z00pw4z3rnhsceck0k3dke
  - is-01m6z00qd6eaav9q66mxr7h7yx
  - is-01m6z00r6zde8eyj94s1yqc1jp
  - is-01m6z00s8x62caj7h0ekr9k88n
  - is-01m6z00t8v0j9fjdy2zx3zgsd1
  - is-01m6z00wbrt7cyz3zhhf4yf9nk
  - is-01m6z00wrrfm7c0es6hm6g9x0v
hold: null
hold_until: null
created_at: 2026-11-09T01:41:26.909Z
updated_at: 2026-11-09T16:24:35.812Z
started_at: 2026-11-09T01:41:40.058Z
closed_at: 2026-11-09T16:24:35.811Z
close_reason: Published and verified get-tbd v0.11.0 on npm and GitHub from f356208d.
resolution: null
duplicate_of: null
---
Validate a packed v0.11.0 release and seamless CLI upgrades from published baselines, verify the Tryscript downstream upgrade, document the Zod 4 API migration, and prepare the release PR.

## Notes

User selected minor v0.11.0. Release PR #336 is ready at e9788ebbe6c76c90935c96fd959685b63a8400d7 above main 30c8f597. All seven checks passed, including Windows, macOS, both Ubuntu versions, coverage/lint, benchmark, and DeepSource Secrets, in https://github.com/jlevy/tbd/actions/runs/42573992096. Astra senior A and correctness B are recorded and dispositioned. Normal local pre-push passed 3,058 tests with one existing skip. Metadata, publint, packed web and standard upgrade proof passed. Production audit zero, 31 pins age-eligible. Dev-only findings remain tracked in tbd-ujyy and tbd-gx3a.

Published v0.10.0 and packed v0.11.0 can share an f08 remote; the focused 44-assertion rolling proof preserves grants and custom text, unknown config and bead fields, timestamps and edits through both directions. Fresh Tryscript cdbe59c9 setup is byte-idempotent, with grants and lockfile preserved. 302 unit tests and 108 compatibility assertions pass; baseline and candidate have the same three moderate development advisories and zero production findings. Isolated public library checks with real Zod 3/4 pass 48 parser comparisons and 48 round trips. Existing harness gap tbd-88a6 is covered by that separate proof; existing Notes-heading issue remains tracked as tbd-w1kd. Evidence under /Users/levy/wrk/release-evidence/tbd-v0.11.0/.

Train includes merged #331, #334, #335, #330, and #333. Deferred #21, #174, #253, #324, #329 and #332 after review. Await explicit approval to merge #336 and publish v0.11.0. After merge, require main CI success on its exact merge SHA, then tag once and verify npm version, package/provenance, CLI and GitHub release notes.

Published v0.11.0 from the exact release merge commit f356208dc54b0fd3649b1d2f366a18f63460f9b4 after main CI passed at https://github.com/jlevy/tbd/actions/runs/42650997500. The tag-triggered publication succeeded at https://github.com/jlevy/tbd/actions/runs/42653278055. npm latest is 0.11.0 and the GitHub release body matches the reviewed changelog. The registry archive matches the publisher receipt and npm integrity. Its signed provenance binds the tarball to the exact tag, merge commit, and workflow run. The isolated install reports 0.11.0 with zero production advisories. A fresh Tryscript upgrade from 0.10.0 preserves policy grants, f08, and the lockfile, and repeated setup is byte-idempotent. Release verification evidence: /Users/levy/wrk/release-evidence/tbd-v0.11.0/publication/.
