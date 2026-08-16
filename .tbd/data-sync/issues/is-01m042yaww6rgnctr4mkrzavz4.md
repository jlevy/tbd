---
type: is
id: is-01m042yaww6rgnctr4mkrzavz4
title: "Research backend integration architectures: Node, Bun, Python sidecars and utilityProcess"
kind: task
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m042xcf06tnmqey8pcfwwswt
created_at: 2026-08-16T01:28:24.220Z
updated_at: 2026-08-16T01:36:32.362Z
closed_at: 2026-08-16T01:36:32.362Z
close_reason: Researched utilityProcess (stable since Electron 22, stdin restricted to ignore), sidecar packaging keys, nested-binary signing, IPC transports incl. loopback DNS-rebinding risk with two 2026 CVEs, Python embedding (python-build-standalone/uv/PyInstaller/Nuitka; PyOxidizer dead), Bun --compile incl. the open macOS 27 signature bug, Node SEA --build-sea, and process lifecycle discipline.
---
The core gap in the current guideline: it says nothing about how to attach an arbitrary backend. Cover utilityProcess vs child_process vs sidecar binary, extraResources/asarUnpack packaging, nested-binary code signing, IPC transport choice and loopback security, Python embedding (python-build-standalone, uv, PyInstaller), Bun --compile, Node SEA, and process lifecycle discipline.
