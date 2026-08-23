---
type: is
id: is-01m0g6g42f97tjgey10y2pqrpd
title: "PR #248 review R1: npm global bin check is a permanent no-op on Windows"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m0g6fe52d2fr6vftwvzssgqj
created_at: 2026-08-20T18:21:25.966Z
updated_at: 2026-08-20T20:29:46.379Z
closed_at: 2026-08-20T20:29:46.379Z
close_reason: "Fixed on PR #248 head a0e3dbf by a parallel session, and independently verified here: 20 unit tests pass (incl. npmPrefixCommand for win32 and the quoted-PATH cases), the doctor golden passes both on a healthy host and under npm_config_prefix=/tmp/off-path-prefix, both SKILL.md files list agent-session-bootstrap, and .tbd/config.yml carries no dev-build version churn. Live doctor is silent when healthy and warns with the full suggestion when off PATH."
resolution: null
duplicate_of: null
---
packages/tbd/src/lib/npm-global-bin.ts:78 — readNpmGlobalPrefix calls execFileAsync('npm', ['prefix','-g']). On Windows npm is npm.cmd, which Node documents as not launchable via child_process.execFile(). The call throws ENOENT, the catch maps it to null, classifyNpmGlobalBin returns ok/'npm not available', and doctor suppresses the line — so the check never runs on Windows and npmGlobalBinDir's win32 branch is unreachable at runtime.

Fix: select the invocation from the platform via an exported npmPrefixCommand(platform) helper; on win32 use cmd.exe /d /s /c npm prefix -g (same form already used in src/cli/web/server.ts:363-364). Not shell:true (Node DEP0190). Unit test both platforms from any host.
