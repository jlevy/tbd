---
type: is
id: is-01m0g6g4sp6d9ztjhqmmtb0s1h
title: "PR #248 review R2: doctor golden is environment-dependent and breaks when npm global bin is off PATH"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0g6fe52d2fr6vftwvzssgqj
created_at: 2026-08-20T18:21:26.710Z
updated_at: 2026-08-20T20:29:46.388Z
closed_at: 2026-08-20T20:29:46.388Z
close_reason: "Fixed on PR #248 head a0e3dbf by a parallel session, and independently verified here: 20 unit tests pass (incl. npmPrefixCommand for win32 and the quoted-PATH cases), the doctor golden passes both on a healthy host and under npm_config_prefix=/tmp/off-path-prefix, both SKILL.md files list agent-session-bootstrap, and .tbd/config.yml carries no dev-build version churn. Live doctor is silent when healthy and warns with the full suggestion when off PATH."
resolution: null
duplicate_of: null
---
packages/tbd/tests/cli-orientation-golden.tryscript.md:107-116 — the HEALTH CHECKS block is a literal capture with no wildcard, so when the new finding fires it inserts two lines and 'Doctor full output' fails. Reproduced with npm_config_prefix=/tmp/off-path-prefix.

The suite therefore breaks for exactly the contributors the feature exists for. Fix: insert '...' (tryscript zero-or-more-lines wildcard) after the Git version line, with a comment. Tighter alternatives were tested and do not work: a PATH export in before: does not survive into test commands, and env: does not expand $TRYSCRIPT_PACKAGE_ROOT.
