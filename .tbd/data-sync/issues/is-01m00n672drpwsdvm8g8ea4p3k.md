---
type: is
id: is-01m00n672drpwsdvm8g8ea4p3k
title: Harden and release repeatable tbd repository upgrades
kind: task
status: closed
priority: 1
version: 8
labels: []
dependencies: []
created_at: 2026-08-14T17:30:19.070Z
updated_at: 2026-08-14T20:59:29.333Z
closed_at: 2026-08-14T20:59:29.332Z
close_reason: Released and independently verified tbd v0.6.3 with format-aware, version-independent repository launchers and representative upgrade coverage.
---
Dogfood the published v0.6.2 repository upgrade, preserve its exact generated diff, then remove release literals from generated launchers and release v0.6.3 with one centralized, format-aware fallback and packed upgrade coverage for 0.6.2, 0.4.2, and 0.5.0.

## Notes

PR #226 merged after senior review at b036fbe2f0ececcdf1d74134b284e59f19c97ea2. Final-head CI and exact-merge main CI run 31839418137 passed all gates. Tag v0.6.3 points exactly to that merge; release run 31840047653 passed audit, build, publint, packed web QA, packaged upgrades from 0.6.2/f07, 0.4.2/f06, and 0.5.0/f06, release metadata, clean checkout, npm publish, and GitHub Release creation. Public npm get-tbd@0.6.3 reports shasum 6f6c0541208d8a14d6658e86e1e8ce70d434037b, integrity sha512-AQhqMsO9Pd5YtTcFNUv6J1P/YMYHA65ub7pkKBHQ4oV8iUq9Vy+5AYff66h0XXuhRdGdKegfT4QmCHRalne9hA==, and SLSA provenance. Published CLI reports 0.6.3; the global npm/FNM installation was upgraded exactly with lifecycle scripts disabled, and an independent 69-package production graph audited with zero vulnerabilities. Published setup on a fresh exact-main clone was clean and byte-identical twice; all four launchers were release-literal-free and used the format probe plus centralized fallback. PR #225 remains closed as superseded. Session-created dependency symlinks and disposable proof/audit/debug artifacts were staged in Trash and Trash was left unemptied.
