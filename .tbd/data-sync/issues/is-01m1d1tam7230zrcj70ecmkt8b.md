---
type: is
id: is-01m1d1tam7230zrcj70ecmkt8b
title: "[epic] gh CLI hardening and stacked-PR support"
kind: epic
status: in_progress
priority: 1
version: 10
labels: []
dependencies: []
child_order_hints:
  - is-01m1d1vj0va849g09krmgvtrpm
  - is-01m1d1vjcdb8ee80m6adbbw3fw
  - is-01m1d1vjqysr1jg5he07zatyy3
  - is-01m1d1wcxcv1pxvpa8g4dc9a2x
  - is-01m1d1wd94kmwcbne34nf4f8se
  - is-01m1d1x7ezs8c1q388j419679e
  - is-01m1d1x7tk4995rv8skr6javbk
  - is-01m1d1x86a96ak3rzd8w6ft7ej
created_at: 2026-08-31T23:17:36.006Z
updated_at: 2026-09-02T06:23:00.512Z
---
Bring tbd's gh provisioning and guidance up to date with (a) gh security fixes, (b) the github/gh-stack extension and its official agent skill, and (c) stacked-PR discipline in the PR shortcuts.

Findings from the 2026-08-31 review (local machine + repo guidance):

LOCAL STATE
- gh 2.98.0 at ~/.local/bin/gh, authed as jlevy via keyring (not GH_TOKEN).
- gh stack v0.1.0 (github/gh-stack) already installed locally, but tbd knows nothing about it.
- Local machine has drifted ahead of what tbd provisions.

INSTALL DEFECTS
1. ensure-gh-cli.sh pins gh 2.92.0, which misses four CVEs fixed in 2.97.0:
   - gh auth status printed part of the token in plaintext (ghs_*, github_pat_*)
   - escape-sequence injection via gh api / gh pr diff (both used heavily by our shortcuts)
   - unescaped URL path components
   - gh attestation verify signer-matcher bypass
2. ensure-gh-cli.sh only installs when gh is absent; it never checks the version. A fresh
   Linux box with an old apt gh keeps it forever. setup-github-cli.md claims 'wrong version ->
   reinstall via ensure script', which the script does not do. Doc and code disagree.
3. No gh extension or skill provisioning, so gh stack is missing on any fresh machine.

VERSION CHOICE
- 2.98.0 published 2026-08-20 = 11 days old, fails the 14-day supply-chain cool-off.
- 2.97.0 published 2026-07-31 = 31 days old, has all four security fixes and full gh skill
  support. 2.97.0 is the correct pin.

STACKED PR GAP
- Zero stacked-PR guidance anywhere in shortcuts or guidelines.
- All four PR shortcuts hardcode --base main. Running one on a stacked branch retargets the PR
  at main and silently flattens the stack. This is the highest-severity guidance bug.
- github/gh-stack ships an official agent skill (skills/gh-stack/SKILL.md + 3 reference files)
  that documents per-subcommand TTY behavior we would otherwise have to reverse-engineer.

DIVISION OF LABOR
- Official gh-stack skill owns the mechanics (how to drive gh stack).
- tbd owns the policy: when stacking is worth it, and how stacks interact with beads, the PR
  shortcuts, and the review lifecycle.
- Stacking stays opt-in. Do not force it on users; honor it when they ask for it, and offer it
  when a change plainly decomposes.
