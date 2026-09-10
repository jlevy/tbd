---
type: is
id: is-01m25105z02jgeg97feeca80sg
title: "Restack PR #283 and reconcile dormant native-comment design docs"
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3g0smx3ezvwz4g8mkmjy9
child_order_hints:
  - is-01m255rtpd3e4pwb15vcvc8zjz
created_at: 2026-09-10T06:45:05.632Z
updated_at: 2026-09-10T15:57:53.779Z
closed_at: 2026-09-10T15:57:53.778Z
close_reason: "PR #283 is restacked on final #282, documentation is reconciled and independently approved, every review finding is tracked and closed, local release/package gates pass, and all seven exact-head GitHub checks are green."
resolution: null
duplicate_of: null
---
Restack the reviewed native-comment inventory and immutable-transition layer onto final PR #282 without changing the ten source/test paths, reconcile architecture/research/plans at the exact #283 dormant f08 boundary, run the full release compatibility matrix, publish final-head senior verification, and leave PR #283 clean with exact-head CI green.

## Notes

2026-09-10 landing progress: PR #283 was restacked onto final PR #282 head be81594396c3e136700e9cac84cf85404ac3cfbd. The original code commits 18e1cdd4, 8c7bcdb8, and 64fb55a8 map to 22bb558f, 406d814f, and fd54dc39. The exact ten-path binary diff SHA-256 remains 76ea9b87fea4bb01b54419d0a4b0a0f4ec3100fbe328f1f7e82f83e9a5a13c42, and the path-scoped range-diff marks all three commits equal. Nine reconciled design documents are isolated in 9794b8b0d4fad7d9d42c0e9f61a033d24f30339c. Independent senior documentation findings FABLE-DOC-01 through FABLE-DOC-04 are resolved, and final-head re-review reports no findings.

Local validation: focused native-comment suite 100 passed and 1 platform skip; full single-worker suite 171 files, 2,590 passed and 1 skipped; format, Flowmark, links, lint/typecheck/action pins, build, release:verify, publint, packed upgrade QA, packaged web QA, and built watch QA pass. Same-version #282/#283 comparison gives identical 53-file non-doc dist manifests (SHA-256 e0424c51c2209557b4f7aee06f02f797f9146c6eeace6a21b5ba02cb9c068525) and identical 158-entry tar manifests after excluding only the intentional tbd-design.md and tbd-docs.md corrections (SHA-256 7b5478dae17dcb140ae3efc31a83c68bc2f2fbf89ce2e303201ee7f396684e6e). Fresh init and packed upgrades remain f08; no dependency or lockfile changed. Push, exact-head CI, and the published final-head review comment remain pending.

Final publication 2026-09-10: lease-protected restack push published exact head 9794b8b0d4fad7d9d42c0e9f61a033d24f30339c on PR #283. The normal pre-push hook passed format, Markdown, lint, typecheck, build, and the full 171-file suite with 2,590 tests passed and one platform skip. All seven exact-head GitHub checks passed. Independent final review approved with no findings: https://github.com/jlevy/tbd/pull/283#issuecomment-5621476642. Address-pr-review disposition: https://github.com/jlevy/tbd/pull/283#issuecomment-5621551927. Review parent tbd-34ti and children tbd-4ghm, tbd-m3qn, tbd-2bv2, and tbd-2fnn are closed; no finding was deferred.
