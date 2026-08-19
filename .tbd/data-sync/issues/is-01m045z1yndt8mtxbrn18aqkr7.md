---
type: is
id: is-01m045z1yndt8mtxbrn18aqkr7
title: "Tauri: research build, packaging, code signing, and update pipeline"
kind: task
status: closed
priority: 1
version: 3
labels: []
dependencies:
  - type: blocks
    target: is-01m045z7zhg7tte2shyz23dast
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T02:21:13.557Z
updated_at: 2026-08-16T04:37:56.048Z
closed_at: 2026-08-16T04:37:56.047Z
close_reason: "Build/signing/CI researched. Corrected a wrong agent claim: Tauri does NOT need JIT entitlements (official signing docs omit entitlements entirely; Spacedrive/GitButler/Modrinth ship none; WKWebView content runs in Apple's own WebContent process, unlike Electron which signs its own V8-JITting helpers). Measured sizes show AppImage is always 70MB+ since it bundles WebKitGTK. Signer env var renamed to TAURI_SIGNING_PRIVATE_KEY. Rust builds cost a real 3-5x CI penalty vs JS-only."
---
tauri build, bundler targets per platform, the updater plugin and its signing requirements, macOS notarization, Windows signing incl. Azure Artifact Signing, Linux targets (deb/rpm/AppImage/Flatpak), CI patterns (tauri-action), and binary size reality vs claims.
