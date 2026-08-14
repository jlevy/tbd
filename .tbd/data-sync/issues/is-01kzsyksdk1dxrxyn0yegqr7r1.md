---
type: is
id: is-01kzsyksdk1dxrxyn0yegqr7r1
title: Bound and strictly validate writer-epoch reads
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - resource-bounds
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T03:00:20.017Z
updated_at: 2026-08-12T04:38:51.122Z
closed_at: 2026-08-12T04:38:51.122Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
The design calls the persistent writer epoch bounded, but readDataSyncEpoch and the one-second metadata reconciler currently use readFile and will allocate the entire file. A corrupt or replaced machine-local epoch can therefore create unbounded repeated allocation. Read at most a small fixed epoch budget, reject oversize/corrupt tokens, reuse the strict reader in reconciliation, and add valid/oversize marker regressions.
