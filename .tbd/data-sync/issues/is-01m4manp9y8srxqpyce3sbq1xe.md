---
type: is
id: is-01m4manp9y8srxqpyce3sbq1xe
title: Address PR324 senior review A and restore green CI
kind: task
status: in_progress
priority: 2
version: 11
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
hold: null
hold_until: null
created_at: 2026-10-11T01:54:07.805Z
updated_at: 2026-10-11T02:14:01.432Z
started_at: 2026-10-11T01:54:20.311Z
---

## Notes

Astra Review A at b1f34739 published four findings. Sol owns source fixes for A1-A4 plus discovered BOM execution bypass tbd-gd3v; coordinator owns tracker writes. Checkpoint: 58 focused parser/Markdown tests pass; all 321 previously valid files in the 324-file corpus preserve detection/data/body, same 3 malformed YAML headers reject. Lockfile pruning removes ten packages and js-yaml@3 override with no additions/upgrades; pnpm audit --prod clean. Claim instruction fixes and generated-surface checks pending; no acceptance closure until pushed CI and dedicated security/correctness reviews finish.
Commit checkpoint: 845d55c196929388fba81db76bc7e17553532331 addresses A1-A4 and BOM bypass tbd-gd3v. Normal precommit format, Markdown, lint and typecheck passed. Focused tests passed (183 cases across initial run/rechecks, including 58 parser/Markdown and 10 actor cases); frozen lockfile validation and production audit clean, with ten unused packages removed and no additions/upgrades. Push in progress; full hosted CI and dedicated reviews pending. Development-only audit remains tracked in tbd-ujyy with current advisory evidence.
