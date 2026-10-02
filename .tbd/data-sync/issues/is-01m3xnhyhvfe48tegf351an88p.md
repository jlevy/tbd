---
type: is
id: is-01m3xnhyhvfe48tegf351an88p
title: Keep fresh Claude SessionStart hook ordering stable on setup refresh
kind: bug
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-10-02T06:41:47.575Z
updated_at: 2026-10-02T06:41:47.575Z
---
Found during v0.10.0 final fresh global-install rehearsal at 50902c72. First setup writes [tbd-session, ensure-gh-cli]; second writes [ensure-gh-cli, tbd-session]; third is byte-identical. Only array order differs, preserving commands, matchers, timeouts and all other files. Source filtering/reappend logic is unchanged from v0.9.0 (setup.ts current1565-1568/1603-1604; v0.9.0 976-988/1011-1019). Independent reviewer workflow_review classed as low cosmetic convergence issue, deferred from frozen release. Make initial order match refresh without altering custom handlers; add fresh-to-repeat regression. Evidence: /Users/levy/wrk/release-evidence/tbd-v0.10.0/bootstrap-final/installed-{first,repeat,third}.patch. Final reviewer disposition to be recorded on PR321.
