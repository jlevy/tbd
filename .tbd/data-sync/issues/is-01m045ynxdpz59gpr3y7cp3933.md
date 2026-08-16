---
type: is
id: is-01m045ynxdpz59gpr3y7cp3933
title: "Electrobun: research core architecture, runtime, versions, platform support, maturity"
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m045yxzjgmzsxbqmv5nack0w
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T02:21:01.229Z
updated_at: 2026-08-16T02:33:31.348Z
closed_at: 2026-08-16T02:33:31.348Z
close_reason: "Verified from a repo clone. mainProcess accepts bun|cottontail|zig|rust|go|odin with cottontail (Electrobun's own JSC runtime) as DEFAULT — Bun is now optional. Zig launcher + Zig core (core/main.zig, 4126 lines) + per-platform native wrappers, bridged by bun:ffi with 100+ symbols. Two preload variants confirm sandbox and RPC are mutually exclusive. Platform floors: macOS 14+ arm64, Windows 11+ x64 only, Ubuntu 24.04+. Maturity: ~12.7k stars but single maintainer, 86 open vs ~12 closed issues, no CHANGELOG, non-semver versioning, maintainer calls it '10% of the vision'."
---
Bun-as-main-process model, native wrapper layers (ObjC/C++/Zig), system webview vs CEF, current version and release cadence, platform/arch support matrix, API stability, project health (commit cadence, contributors, issue backlog), and honest maturity assessment. Verify against the GitHub source, not blog posts.
