---
type: is
id: is-01kxj32wgrjfa51wytr33z286r
title: Fix setup --dry-run whole-state mutation regression
kind: epic
status: closed
priority: 1
version: 4
labels:
  - bug
  - setup
  - dry-run
dependencies: []
parent_id: is-01kxj30jgtpk96nys50nr6peve
child_order_hints:
  - is-01kxj32wv4z74tw81f1ecf606k
  - is-01kxj32x4qe3m6xh137axnjv68
  - is-01kxj32xg2qpdfb73qsg9pnt4s
created_at: 2026-07-15T05:13:09.911Z
updated_at: 2026-07-15T05:59:12.941Z
closed_at: 2026-07-15T05:59:12.940Z
close_reason: Dry-run mutation regression fixed end-to-end with shared setup/doctor inspection.
---
Independent operational bug confirmed while reviewing GitHub #190. Current setup stamps tbd_version/tbd_upgrades before any dry-run guard, persists config migrations, updates .tbd gitignore/gitattributes, and calls docs sync without dryRun. Existing issue #126 tests cover only legacy Claude hooks/scripts.

Outcome: setup --auto --dry-run is a true read-only preview across tracked files, ignored cache/state, integration surfaces, and the shared git common directory. It still validates inputs and reports the exact planned operations.

Related but distinct existing bugs tbd-f6y4 and tbd-wul8 track test isolation that invokes real setup against the repository.
