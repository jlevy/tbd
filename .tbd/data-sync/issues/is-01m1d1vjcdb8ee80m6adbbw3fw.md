---
type: is
id: is-01m1d1vjcdb8ee80m6adbbw3fw
title: "ensure-gh-cli.sh: enforce a version floor, not just presence"
kind: bug
status: open
priority: 0
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m1d1vjqysr1jg5he07zatyy3
  - type: blocks
    target: is-01m1d1x7ezs8c1q388j419679e
  - type: blocks
    target: is-01m1d1x86a96ak3rzd8w6ft7ej
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
created_at: 2026-08-31T23:18:16.716Z
updated_at: 2026-08-31T23:19:21.372Z
---
ensure-gh-cli.sh gates on 'command -v gh' alone. If any gh exists it is accepted forever, no
matter how old. A fresh Debian/Ubuntu box with gh from apt (often several minor versions behind)
never gets upgraded, so the pin is not actually enforced on the machines that need it most.

This also makes the docs wrong today: setup-github-cli.md lists corner case 2, 'gh exists but
wrong version -> Solution: Reinstall via ensure script'. The script has no code path that does
this. Doc and code must agree after this change.

REQUIRED BEHAVIOR
- Parse the installed version from 'gh --version' (first line, second token, e.g. 'gh version
  2.92.0 (2026-04-28)').
- Compare against a GH_MIN_VERSION floor using a pure-bash version compare (sort -V is not
  portable enough to rely on; no python dependency).
- If installed < floor, install the pinned build to ~/.local/bin and prefer it on PATH.
- If installed >= floor, keep it and stay silent. Do NOT downgrade a newer gh (the local
  machine runs 2.98.0 and must not be knocked back to 2.97.0).
- If 'gh --version' fails or is unparseable, treat as broken and reinstall.

Set the floor to 2.97.0 to match the security pin. Keep the existing checksum verification,
atomic staging, and NO_PROXY retry behavior intact.
