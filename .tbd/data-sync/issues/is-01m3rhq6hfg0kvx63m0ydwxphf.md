---
type: is
id: is-01m3rhq6hfg0kvx63m0ydwxphf
title: "Review and implement README restructure on merged main (PR #313)"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/reviews/review-2026-09-19-readme-restructure.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-30T06:58:33.134Z
updated_at: 2026-09-30T07:33:00.243Z
started_at: 2026-09-30T06:58:55.169Z
closed_at: 2026-09-30T07:33:00.241Z
close_reason: "Implemented and pushed PR313 at 2bfd7d9d. All seven exact-head CI checks pass (run 36683051179). Review A records no outstanding findings; independent full-diff audit also clear. Updated plan, README, design intro, source skill, and generated copies. Local gates: 3017 tests pass, 1 existing skip; 27 prime golden checks; doc links, setup fixtures, package/CLI copies verified."
resolution: null
duplicate_of: null
---
Deeply review the existing proposal against core product principles and current behavior; revise the plan and implement concise, current README and supporting documentation. Preserve gradual/customizable/batteries-included positioning, verify commands and links, update PR and wait for CI.

## Notes

Implemented and pushed PR313 at 2bfd7d9db350cde3769e9392d35fc9bd0d794c04. Updated plan and README (677 to 486 lines), aligned design/source skill and regenerated all 3 skill copies. Independent full 7-file audit: no findings. Local gates: formatting/lint/typecheck/build, 3017 tests pass with 1 existing skip, 27 prime golden checks, 74 targeted doc checks, 135 links, setup fixtures, package/CLI README match. Review A: https://github.com/jlevy/tbd/pull/313#pullrequestreview-5362842710. Awaiting final-head CI run 36683051179 before closure.
