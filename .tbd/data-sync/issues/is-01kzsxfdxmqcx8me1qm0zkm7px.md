---
type: is
id: is-01kzsxfdxmqcx8me1qm0zkm7px
title: Make stale shared-lock recovery ownership-safe and heartbeat live holders
kind: bug
status: closed
priority: 0
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - concurrency
  - lock
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T02:40:28.594Z
updated_at: 2026-08-12T04:38:51.109Z
closed_at: 2026-08-12T04:38:51.109Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
The final lock-graph audit found that withLockfile can atomically rename a stale lock and let a successor acquire, but the displaced live holder later calls rmdir(lockPath) unconditionally and can delete the successor's directory. A live operation longer than staleMs also looks dead because the lock has no heartbeat, invalidating the web writer-epoch proof. Store a unique owner token inside each lock directory, release only when the path still belongs to that owner, heartbeat the owned directory well below staleMs while the critical section runs, stop/await heartbeat before release, and add adversarial stale-break/release tests.

## Notes

Final lock review found a second ownership edge in the same seam: if stale recovery renames the provisional lock directory between mkdir and owner-file creation, acquisition failure cleanup must not remove the successor. The owner file's O_EXCL creation remains the acquisition arbiter; cleanup now requires the provisional token, and any visible ownership loss skips canonical-path cleanup entirely. An adversarial mocked-open regression forces the exact mkdir → rename → successor → resumed-open sequence and proves the first callback waits while the successor remains owned.
