---
type: is
id: is-01kxrxs3w5b32mp7344bfk6rd0
title: Running the test suite from the repo stamps the real .tbd/config.yml with a dev version
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-07-17T20:55:07.908Z
updated_at: 2026-07-17T20:55:07.908Z
---
Observed 2026-07-17 ~20:53Z: after committing a clean .tbd/config.yml, the lefthook pre-push run (build:check + pnpm test via scrub-git-env) left tbd_version stamped to 0.4.0-dev.306.8e110bc-dirty with a matching tbd_upgrades entry at 20:53:04.390Z in the REAL repo config. Some test or hook runs a setup-version stamp against process.cwd() instead of its fixture dir. Related history: tbd-a1lc (GIT_DIR leakage). Repro: clean tree, run pnpm test from repo root, check git diff .tbd/config.yml.
