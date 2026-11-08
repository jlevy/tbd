---
title: Electron App Development Patterns
description: Building a clean, minimal, standalone Electron app—process model, Vite-based build, wrapping a local web server, Node, Bun, or Python backends, security baseline, packaging, macOS signing and notarization, and auto-update
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: desktop
---
# Electron App Development Patterns

**Last Updated**: 2026-11-08

**Related**:

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [electron-vite](https://electron-vite.org/)
- [electron-builder](https://www.electron.build/)
- [Electron Forge](https://www.electronforge.io/)
- [Companion: Desktop Python Runtime Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/desktop-python-runtime-patterns.md)
  (`tbd guidelines desktop-python-runtime-patterns`)—uv layouts, isolation flags, hash
  pinning, and macOS Python hazards
- [Companion: macOS WebView Shell Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md)
  (`tbd guidelines macos-webview-shell-patterns`)—the full macOS platform rules and the
  AppKit plus WKWebView alternative
- [Companion: Tauri App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/tauri-app-development-patterns.md)
- [Companion: Electrobun App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electrobun-app-development-patterns.md)
- [Companion: pnpm Monorepo Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md)
- [Companion: Bun Monorepo Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/bun-monorepo-patterns.md)
- [Companion: Supply-Chain Hardening](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)
- [Companion: CI and Quality Gate Rules](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/ci-and-gates-rules.md)
- [Companion: TypeScript Rules](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/typescript-rules.md)

* * *

## Updating This Document

Electron ships a major version every 8 weeks and supports only the latest three, so this
document goes stale faster than most.
Since Chrome moved to a stable milestone every two weeks (M152 on 2026-08-25 through
M157 on 2026-11-03, per [Chromium Dash](https://chromiumdash.appspot.com/schedule)),
each Electron major jumps four Chromium milestones, and each supported line gets about
two patch releases a week.
Recheck this document at least every two majors.

### Last Researched Versions

Versions observed 2026-11-08 by querying the npm registry (`time` and `dist-tags`),
[releases.electronjs.org](https://releases.electronjs.org/), and GitHub releases
directly.
A release is eligible under the 14-day cool-off when its UTC publish date is on
or before 2026-10-25. Where the newest release is younger, the newest eligible version
is given as the pin, per [Supply-Chain Mitigation](#supply-chain-mitigation).

| Tool / Package | Version | Check For Updates |
| --- | --- | --- |
| **Electron** | 45.2.3 (security exception; aged pin ^45.0.0) | [releases.electronjs.org](https://releases.electronjs.org/)—**45.2.3** (2026-11-04) is current stable: Chromium 156.0.8078.80, Node 24.22.2, V8 15.6. Its one code change is a batch of Chromium, V8, Skia, ANGLE, and other upstream fixes labeled `security` ([#55592](https://github.com/electron/electron/pull/55592)), so it qualifies for the cool-off exception; 45.0.0 (2026-10-21) is the newest stable past 14 days. Supported majors are **43, 44, 45**; **42 reached end of life 2026-10-20** and 43 ends 2027-01-05 (tentative), so 44 is the practical floor. **44 and later require macOS 13 Ventura** and dropped Windows ia32 and Linux armv7l. 46 (stable 2027-01-05, tentative) moves to Chromium 160 and Node 26.13.0. |
| **Node.js (host toolchain)** | 24 or 26 (both LTS) | [nodejs.org/releases](https://nodejs.org/en/about/previous-releases)—Node 26 “Lithium” entered Active LTS 2026-10-28 (26.13.0); Node 24 “Krypton” moved to maintenance 2026-10-20 and is supported until 2028-04-30; Node 22 is in maintenance until 2027-04-30. The Node *inside* Electron is set by Electron, not by your host (45.2.3 embeds 24.22.2). |
| **electron-vite** | ^6.0.0 | [electron-vite.org](https://electron-vite.org/)—6.0.0 (2026-10-14). Vite 8 support with both `rolldownOptions` and `rollupOptions`, while keeping Vite 6 and 7 working; single-session bytecode compilation; dev-mode signal forwarding to the Electron child. Node ^20.19 or ≥22.12. |
| **vite-plugin-electron** | ^1.1.2 (1.2.0 too recent) | [github.com/electron-vite/vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron)—1.2.0 (2026-10-31) newest. Same org as electron-vite. Auto-selects `rolldownOptions` on Vite 8+ and `rollupOptions` below. Use when you want a plugin inside a standard Vite project rather than a separate CLI. |
| **Vite** | ^8.3.5 (8.3.6 too recent) | [vite.dev](https://vite.dev/blog/announcing-vite8)—Vite 8 (2026-03-12) ships **Rolldown as its sole bundler**. `build.rollupOptions` is a deprecated alias of `build.rolldownOptions` ([build options](https://vite.dev/config/build-options)). Requires Node 20.19+ or 22.12+. |
| **Rolldown** | ^1.2.15 (1.2.16 and 1.3.0 too recent) | [rolldown.rs](https://rolldown.rs/)—1.3.0 (2026-11-05) newest. Adopted Rollup’s plugin API, so most Vite plugins work unmodified. Maintained by VoidZero, **acquired by Cloudflare 2026-06-04**; tools remain MIT. |
| **esbuild** | ^0.28.2 | [github.com/evanw/esbuild/releases](https://github.com/evanw/esbuild/releases)—0.28.2 (2026-08-08), still pre-1.0. No longer inside Vite’s production path, but still the simplest standalone choice for bundling a main process without adopting a framework. |
| **electron-builder** | ^26.18.0 | [electron.build](https://www.electron.build/)—**The `latest` dist-tag is 26.18.0 (2026-10-20), while 26.18.1 (2026-10-26) is published under a separate `v26` tag**, so `latest` trails the newest v26 release. 26.x pins exact, older Electron tooling (`@electron/osx-sign` 1.3.3, `@electron/notarize` 2.5.0, `@electron/asar` 3.4.1). **Its default macOS entitlements grant `allow-jit`, `allow-unsigned-executable-memory`, and `disable-library-validation` to every binary; always supply your own** (see [Signing Nested Binaries](#signing-nested-binaries)). 27.0.0-alpha.14 (`next`, 2026-10-29) is still alpha: native ESM, Node 22.12+, an `allow-jit`-only default entitlements template, an embedded ASAR-integrity digest for Electron 41+, Ed25519-signed update manifests required by default, and a `migrate-schema` CLI ([what’s new in v27](https://www.electron.build/docs/migration/whats-new-v27/)). Rejecting plain-`http` update feeds (with an `allowInsecureFeed` opt-out) is on `main` as a pending changeset ([e9553386](https://github.com/electron-userland/electron-builder/commit/e9553386c9), 2026-11-05) and is not in alpha.14. |
| **electron-updater** | ^6.8.11 | [npmjs.com/package/electron-updater](https://www.npmjs.com/package/electron-updater)—`latest` is 6.8.11 (2026-10-20); 6.8.12 (2026-10-26) is under the `v26` tag. In 6.x the `latest*.yml` manifest is unauthenticated: its SHA-512 for each download comes from the same host, so it guards transport, not the manifest’s author. The payload’s OS code signature is checked, though: on Windows, `verifyUpdateCodeSignature` matches the installer’s Authenticode signer against `publisherName` (falling open when PowerShell cannot run, which 7 closes), and on macOS Squirrel.Mac checks the app’s designated requirement. 7.0.0-alpha.13 (`next`) adds Ed25519-signed manifests (`updateManifestPublicKey`, with key lists for rotation) and a `verifyUpdateFile` hook; neither exists in 6.x. |
| **Electron Forge** | ^8.0.1 | [electronforge.io](https://www.electronforge.io/)—8.0.1 (2026-09-29) is stable ([release notes](https://github.com/electron/forge/releases/tag/v8.0.1)): ESM-only on Node 22.17+, **the Vite plugin promoted to stable** and targeting Vite 8, main and preload emitted as `.cjs`, `publish` renamed `release`, DMGs moved to `out/make/dmg/<arch>/`, and far fewer dependencies. pnpm still needs hoisted `node_modules`; **Bun is not supported** ([forge#3906](https://github.com/electron/forge/issues/3906), open). |
| **@electron/packager** | ^20.3.0 | [npmjs.com/package/@electron/packager](https://www.npmjs.com/package/@electron/packager)—20.3.0 (2026-08-11). The low-level bundler that Forge wraps; use directly only for a custom pipeline. |
| **@electron/rebuild** | ^4.2.1 | [github.com/electron/rebuild](https://github.com/electron/rebuild)—4.2.1 (2026-10-06). Requires Node ≥22.12.0. |
| **@electron/notarize** | ^3.1.2 | [github.com/electron/notarize](https://github.com/electron/notarize)—3.1.2 (2026-10-09). Wraps `xcrun notarytool`. |
| **@electron/osx-sign** | ^2.7.2 | [github.com/electron/osx-sign](https://github.com/electron/osx-sign)—2.7.2 (2026-10-25). Signs every file under `Contents/` that `isbinaryfile` flags, inside out; see [Signing Nested Binaries](#signing-nested-binaries). |
| **@electron/fuses** | ^2.1.3 | [github.com/electron/fuses](https://github.com/electron/fuses)—2.1.3 (2026-06-29). |
| **@electron/asar** | ^4.3.1 | [github.com/electron/asar](https://github.com/electron/asar)—4.3.1 (2026-09-26). ASAR integrity needs ≥3.1.0; the macOS integrity digest added in Electron 41 needs ≥4.1.0. |
| **@electron/universal** | ^3.0.6 | [github.com/electron/universal](https://github.com/electron/universal)—3.0.6 (2026-07-02). Merges x64 and arm64 macOS builds. |
| **update-electron-app** | ^3.3.0 | [github.com/electron/update-electron-app](https://github.com/electron/update-electron-app)—3.3.0 (2026-06-28). |
| **Playwright** | ^1.64.1 (1.65.0 too recent) | [playwright.dev](https://playwright.dev/docs/api/class-electron)—1.65.0 (2026-11-05) newest. `_electron` is still an experimental namespace but is the standard way to drive a packaged app in tests. |
| **better-sqlite3** | ^13.0.3 | [npmjs.com/package/better-sqlite3](https://www.npmjs.com/package/better-sqlite3)—13.0.3 (2026-08-05). Needs `@electron/rebuild`. Consider `node:sqlite` first (see [Native Modules](#native-modules)). |
| **pnpm** | ^12.15.0 (12.16+ too recent) | [github.com/pnpm/pnpm/releases](https://github.com/pnpm/pnpm/releases)—12.18.0 (2026-11-05) newest; pnpm 12.0.0 shipped 2026-08-26, and the 11 line still gets releases (11.28.8 is its newest aged one). The Electron-relevant settings are unchanged from 11: `nodeLinker` and `allowBuilds` live in `pnpm-workspace.yaml`, and `strictDepBuilds` defaults to `true`. pnpm 12 fails on unrecognized `pnpm-workspace.yaml` settings when the project pins a pnpm version it satisfies. |
| **npm** | ^12.2.1 (12.2.2 too recent) | [npmjs.com/package/npm](https://www.npmjs.com/package/npm)—12.2.2 (2026-11-04) newest. npm 12 **disables dependency install scripts by default** (`allowScripts`); approve with `npm approve-scripts`. |
| **Bun** | ^1.4.4 | [bun.com/blog](https://bun.com/blog)—1.4.4 (2026-10-22). Fine as a package manager and as a sidecar runtime; **not** a supported driver for Forge, and still unreliable through electron-builder’s script hooks. Use ≥1.4.1 for `--compile` on macOS (see [Bun Backends](#bun-backends)). |

### Recent Platform Changes

These changes from Electron 44 through 46 affect application code, read from
[breaking-changes.md](https://github.com/electron/electron/blob/main/docs/breaking-changes.md)
and the API docs at each tag:

- **The macOS built-in `autoUpdater` got sturdier (44.7.0 and later, and 45).** The
  update zip streams to disk and an interrupted download resumes when the server sends
  `ETag` or `Last-Modified` and honors `Range`. A feed entry may declare `sha256` and
  `size`, and a mismatching download is discarded before it is unpacked.
  An entry may also carry a `delta` (`from_version`, `url`, `sha256`, `size`) made with
  Sparkle’s `BinaryDelta create`, which is tried first and falls back to the full zip
  ([auto-updater.md](https://github.com/electron/electron/blob/v45.2.3/docs/api/auto-updater.md)).
- **Native window-state persistence (44, experimental).**
  `new BrowserWindow({ name: 'main', windowStatePersistence: true })` restores position,
  size, and display mode across launches; `BaseWindow.clearPersistedState(name)` resets
  it
  ([base-window-options.md](https://github.com/electron/electron/blob/v45.2.3/docs/api/structures/base-window-options.md)).
  This replaces the `electron-window-state` package.
- **Sandboxed preloads lost their Node shims (45).** `require` loads only `electron`,
  and the `events`, `timers`, and `url` shims and the `Buffer`, `setImmediate`, and
  `clearImmediate` globals are gone.
  Use Web APIs, or bundle the polyfill you need.
- **`unload` handlers stop running on `http:` and `https:` pages (46).** Chromium
  disables the `unload` Permissions Policy feature by default; `file:` and
  custom-protocol pages are unaffected.
  Any shell that loads a loopback `http://` server is affected: move the logic to
  `pagehide` or `visibilitychange`.
- **`utilityProcess` `child.kill()` no longer force-kills (46).** It sends `SIGTERM` and
  returns, like Node’s `child_process`; the child must exit from its `SIGTERM` handler.

### Reminders When Updating

1. **Recheck the Electron support window first.** Only the latest three majors get
   fixes. If the version in the table has fallen out of that window, everything
   downstream in this document is suspect.

2. **Read the breaking-changes page for every major you skip**, at
   [electronjs.org/docs/latest/breaking-changes](https://www.electronjs.org/docs/latest/breaking-changes).
   Platform minimums and dropped architectures are the changes most likely to break a
   shipping app.

3. **Recheck platform minimums.** Electron follows Chromium’s OS deprecations, so the
   macOS and Windows floors move roughly annually.

4. **Reverify the security checklist**, which is versioned with the docs and gains items
   over time.

5. **Recheck fuse names and defaults**, which have changed as fuses were added.

6. **Update code examples**, not just the table—versions appear in the `package.json`
   and `main.js` examples, `electron-builder.yml`, Appendix E’s uv placement, and the
   GitHub Actions workflow in Appendix F, whose actions are pinned by commit SHA.

7. **Honor the 14-day package-age rule** when bumping versions here, with the documented
   exception for security fixes.
   Electron itself frequently qualifies for that exception.

8. **Recheck the default entitlements** of electron-builder and `@electron/osx-sign`,
   which have changed between majors.

9. **Review [Open Research Questions](#open-research-questions)** for anything now
   settled.

* * *

## Executive Summary

This document is a reference for building a **clean, minimal, standalone Electron
desktop app** with a modern build system and a backend written in whatever language
suits the problem—Node.js, Bun, Python, Go, or a combination.

The recommended default: **Electron 45 and electron-vite with TypeScript and
electron-builder**, with the renderer as an ordinary Vite web app, the main process as a
thin bundled CommonJS entry point, a CommonJS preload exposing a narrow typed API over
`contextBridge`, and any substantial backend work pushed into a **`utilityProcess`**
(for Node) or a **signed sidecar executable** (for anything else).

When the product is already a local web server with a browser UI, the shell is much
smaller: one plain `main.js` of about 100 lines of code that Electron loads directly,
with no bundler, preload, renderer build, or IPC
([Wrapping an Existing Local Web App](#wrapping-an-existing-local-web-app)).

Four claims in this document are worth stating up front because they contradict advice
that is still widely repeated:

- **Electron’s security defaults have been correct for years.** `sandbox: true`,
  `contextIsolation: true`, and `nodeIntegration: false` are all defaults.
  The work is not turning them on.
  It is refusing to turn them off, and designing a preload API narrow enough that an XSS
  bug cannot escalate into code execution.

- **`require('electron')` returning a file path is not a bug.** The npm package exports
  the path to the Electron binary when it is loaded by plain Node.js.
  Seeing a string instead of the API object means the script was run by `node`, not by
  `electron`.

- **The postinstall-binary problem is mostly over.** Since Electron 42, the npm package
  downloads its binary lazily on first run rather than in a `postinstall` script.
  This lands at the same time as npm 12, pnpm 11 and 12, and Bun all blocking dependency
  lifecycle scripts by default, and it resolves that collision for current Electron.

- **A Python interpreter the app spawns does not need `disable-library-validation`.**
  Library validation is enforced per process, by the process doing the loading, from its
  own code signature. It applies to an interpreter only when that interpreter is signed
  inside your bundle with the hardened runtime; an interpreter that the bundled `uv`
  installs into app data is outside its reach.

**Research questions this document answers**:

1. What is the minimum coherent structure of a standalone Electron app in 2026, and what
   builds what?

2. What is the thinnest correct shell for a product that is already a local web server?

3. Where should backend code live, and how do you ship a non-JavaScript runtime with a
   signed desktop app?

4. What is the current security baseline beyond the three `webPreferences` flags
   everyone quotes?

5. What does it actually take to get a signed, notarized, auto-updating app onto three
   platforms?

* * *

## 1. The Process Model

### Four Process Types

Electron is Chromium plus Node.js, and understanding which is which explains nearly
every constraint in the rest of this document.

| Process | Runtime | Has DOM | Has Node built-ins | Purpose |
| --- | --- | --- | --- | --- |
| **Main** | Node.js | No | Yes | App lifecycle, windows, menus, native OS integration, and the only process that may hold privileged capability. |
| **Renderer** | Chromium | Yes | No (by default) | Your UI. Treat it as an ordinary web page that happens to be local. |
| **Preload** | Node.js-adjacent, in the renderer’s context | Access to `window` | Limited (`electron`, and Node built-ins only when unsandboxed) | The bridge. Runs before page scripts and decides exactly what the renderer may ask for. |
| **Utility** | Node.js | No | Yes | Background work: backends, parsers, watchers, anything you do not want blocking the main process. |

The main process is a single-threaded event loop that also drives your window UI
responsiveness. Blocking it blocks the app.
This is the reason `utilityProcess` exists and the reason it belongs in your
architecture early rather than as a later optimization.

### What Runs Where

A rule that resolves most confusion: **there is no Node.js in the renderer, and there
should never be.** If the renderer needs to read a file, call an API with a secret, or
spawn a process, it asks the main process to do it through a named, validated channel.

One API note for apps that embed more than one web view in a window: use
`WebContentsView`. Its predecessor `BrowserView` has been deprecated since Electron 29,
and the `<webview>` tag is disabled by default and discouraged by the Electron team.

### Module Format: The ESM Situation

Electron has supported ESM since version 28, but support differs by process and the
differences matter.

| Process | ESM supported | How to opt in | Caveats |
| --- | --- | --- | --- |
| Main | Yes | `.mjs` extension or `"type": "module"` | ESM loads **asynchronously**. Only side effects of the entry point’s own imports run before the `ready` event, so anything that must happen pre-`ready` needs an explicit `await`. |
| Preload | Yes, but | **`.mjs` extension only**—`"type": "module"` is ignored for preload | **Sandboxed preloads cannot use ESM at all.** They run as plain scripts and must use `require('electron')`. Unsandboxed ESM preloads run *after* page load on zero-length responses, and dynamic Node imports there require `contextIsolation: true`. |
| Renderer | Yes | Native to Chromium | No Node built-ins, no `node_modules` resolution. Use a bundler. |

The practical consequence is worth stating plainly: **if you keep `sandbox: true`—and
you should—your preload is CommonJS.** This is not a limitation you are working around;
it is the sandboxed preload contract.
Bundle the preload to a single CJS file and stop thinking about it.

For the main process, either format works.
CommonJS output from a bundler is the lower-friction choice because it sidesteps the
async-initialization caveat entirely, which is why most shipping apps still emit CJS
there.

### The Sandbox and the Preload Boundary

With `sandbox: true` (the default since Electron 20), the renderer runs in an OS-level
sandboxed process with no direct Node access, and the preload gets a small subset rather
than full Node.
Since Electron 45 that subset is `require('electron')` plus `process` and
`global`; the old `events`, `timers`, `url`, and `Buffer` shims are gone, so use Web
APIs or bundle the polyfill.

`contextIsolation: true` (default since Electron 12) means the preload’s JavaScript
context is separate from the page’s. The page cannot reach into preload internals by
walking prototypes; the only crossing point is what you explicitly publish through
`contextBridge`.

That crossing point is your entire attack surface.
Treat it as a network API boundary owned by a service that does not trust its callers,
because that is exactly what it is.
The common Electron security failure is not a missing flag—it is a preload that exposes
something like `invoke(channel, ...args)` or `readFile(path)`, which converts any XSS in
the renderer into arbitrary IPC or arbitrary file reads.

* * *

## 2. Reference Architecture for a Standalone App

### Project Layout

A single-package app.
No monorepo until a second deliverable actually exists.

```
my-app/
├── src/
│   ├── main/
│   │   ├── index.ts            # app lifecycle, windows
│   │   ├── ipc.ts              # channel handlers, one per capability
│   │   └── backend.ts          # utilityProcess or sidecar supervision
│   ├── preload/
│   │   └── index.ts            # contextBridge surface only
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/                # ordinary Vite web app
│   └── shared/
│       └── contract.ts         # IPC types shared by main and renderer
├── resources/                  # icons, and any sidecar binaries
├── build/                      # entitlements.plist, installer assets
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json               # references the three below
├── tsconfig.node.json          # main + preload
├── tsconfig.web.json           # renderer
└── package.json                # "main": "./out/main/index.js"
```

`src/shared/` is the important piece.
It holds only types and constants—never runtime imports that pull Node built-ins into
the renderer bundle—and it is what makes IPC type-safe on both ends without codegen.

### Why Three Builds

Main, preload, and renderer have different targets, so they get different builds:

- **Main** targets Node, externalizes `electron`, and bundles everything else so the
  packaged app does not depend on `node_modules` layout.
- **Preload** targets a browser-ish context, must emit a **single CJS file** under the
  sandbox, and must externalize `electron`.
- **Renderer** targets the browser and is an ordinary Vite build with code splitting,
  asset hashing, and HMR.

Trying to serve all three from one config is the most common way Electron build setups
become unmaintainable.

### Choosing a Build Tool

| Approach | Use when | Tradeoff |
| --- | --- | --- |
| **electron-vite** (recommended default) | You want one config covering all three targets, HMR for the renderer, and hot restart for main and preload, without adopting a full framework. | A separate CLI rather than plain `vite`. Release cadence is slower than `vite-plugin-electron`. |
| **vite-plugin-electron** | You want to keep a stock Vite project and add Electron as a plugin. | You wire more of the three-target split yourself. |
| **Electron Forge + `plugin-vite`** | You want build, package, make, and publish from one tool with official Electron backing. | The Vite plugin is still marked experimental; Forge is more opinionated about the whole pipeline. |
| **Hand-rolled esbuild + Vite** | You have unusual constraints and want no framework at all. | You own the dev loop, the watch/restart logic, and the sourcemap wiring. This is a real cost that is easy to underestimate. |

Forge is the Electron team’s own tool and the only one with official support, so it is
the right answer when you want a single supported pipeline.
electron-vite is the recommended default here because it does one job—building three
targets well—and composes with electron-builder, which remains the more capable
packager.

A complete `electron.vite.config.ts` is in
[Appendix A](#appendix-a-electronviteconfigts).

### TypeScript Configuration

Use project references so the renderer cannot accidentally import Node built-ins and the
main process cannot accidentally import DOM globals.
`tsconfig.node.json` covers `src/main`, `src/preload`, and `src/shared` with
`"types": ["node", "electron"]`; `tsconfig.web.json` covers `src/renderer` and
`src/shared` with `"lib": ["ESNext", "DOM", "DOM.Iterable"]` and no Node types.
`src/shared` appears in both, which is exactly why it must stay type-only.

### The Development Loop

The dev loop you want:

- Renderer edits apply through **HMR** without losing app state.
- Preload edits **reload the renderer**, since the preload runs at document start.
- Main edits **restart the Electron process**, since there is no way to hot-swap app
  lifecycle code safely.

electron-vite implements all three.
If you hand-roll, budget real time for the restart logic: debouncing rebuilds, waiting
for the write to settle before relaunching, and killing the previous Electron instance
cleanly.

### Main Process Entry Point

The full annotated entry point is in [Appendix C](#appendix-c-main-process-entry-point).
The parts that matter:

```ts
const win = new BrowserWindow({
  show: false, // avoid the white flash; show on 'ready-to-show'
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
    // sandbox, contextIsolation, nodeIntegration are already correct by default.
    // They are listed in Appendix C explicitly, as documentation, not as a fix.
  },
});
win.once('ready-to-show', () => win.show());
```

Load the renderer from the dev server in development and from a file (or better, a
custom protocol) in production:

```ts
if (process.env.ELECTRON_RENDERER_URL) {
  await win.loadURL(process.env.ELECTRON_RENDERER_URL);
} else {
  await win.loadFile(path.join(__dirname, '../renderer/index.html'));
}
```

The security checklist prefers a custom protocol over `file://`, because `file://` pages
carry extra privileges that a custom protocol does not.
For a minimal app, `loadFile` is acceptable; for anything rendering untrusted content,
register a custom protocol as standard and secure, and disable the
`grantFileProtocolExtraPrivileges` fuse.
This is what serious apps do—VS Code serves the workbench over `vscode-file://` and
Element over `vector://`.

### Typed IPC Across the Context Bridge

There is no dominant framework for typed Electron IPC, and you do not need one.
This is not an aesthetic preference: of the production apps surveyed in
[§8](#8-what-shipping-apps-actually-do), **none** use tRPC-over-IPC, comlink, or
electron-trpc. Every one hand-writes a typed preload and gets its guarantees from
TypeScript interfaces.
A shared contract type plus a hand-written bridge gives full type safety in about thirty
lines, with no runtime dependency and no magic.

Define the contract once:

```ts
// src/shared/contract.ts — types only, no runtime imports
export type Api = {
  openProject: (id: string) => Promise<Project>;
  saveNote: (note: NoteInput) => Promise<void>;
  onProgress: (cb: (p: Progress) => void) => () => void;
};
```

Expose exactly those in the preload, one named channel per capability
([Appendix D](#appendix-d-preload-and-typed-ipc)), and validate on the main side:

```ts
ipcMain.handle('project:open', async (event, rawId) => {
  assertSender(event); // checklist item 17: validate the sender
  const id = ProjectId.parse(rawId); // validate the payload; never trust it
  return openProject(id);
});
```

Two rules make this safe:

- **Never expose a generic pass-through.** `invoke(channel, ...args)` on the bridge
  defeats the entire boundary.
- **Validate the sender and the payload in every handler.** A renderer displaying remote
  content is untrusted input; so is a compromised renderer.
  Use a schema validator (Zod or equivalent) rather than hand-rolled checks.

* * *

## 3. Attaching a Backend

This is the section the rest of the architecture exists to support: you have real
work—indexing, inference, a database, a document pipeline, an existing Python
codebase—and it needs to live somewhere that is not the main process and not the
renderer.

### Choosing a Mechanism

| Mechanism | Use when | Do not use when |
| --- | --- | --- |
| **In the main process** | The work is small, fast, and event-driven. Reading config; a few file operations. | Anything CPU-bound or long-running. It blocks your UI. |
| **`utilityProcess`** | The backend is JavaScript/TypeScript running on Node. **This is the default choice.** | You need a runtime that is not Node. |
| **Sidecar executable** | The backend is Python, Go, Rust, or a Bun-compiled binary, or it is an existing program you do not want to rewrite. | A Node module would have done. Sidecars cost you signing complexity and megabytes. |
| **`child_process.fork`** | Rarely. `utilityProcess` supersedes it. | You have disabled the `runAsNode` fuse—which you should—because that breaks `fork`. |
| **Local HTTP server** | An existing service already speaks HTTP and rewriting its transport is not worth it. | You have a choice. See [Local Server Security](#local-server-security). |

The `runAsNode` interaction deserves emphasis: hardening your app by disabling the
`runAsNode` fuse **breaks `child_process.fork`**, because forking relies on relaunching
the Electron binary in Node mode.
`utilityProcess` is the supported path that survives hardening, which makes it the right
default rather than merely the modern one.

### Wrapping an Existing Local Web App

A recurring case deserves its own name: the product is already a local server plus a
browser UI—a tool normally launched from the CLI and used at `http://127.0.0.1:{port}`.
Wrapping one in a desktop shell is the thinnest possible Electron app, and three rules
keep it that way:

- **The shell is a window plus lifecycle, nothing more.** One `BrowserWindow` pointed at
  the loopback URL, plus tray, menus, file associations, and single-instance handling.
  There is no IPC surface to design; the page already talks to the server over HTTP.
- **Keep the frontend framework-free.** If the page never imports Electron APIs and
  speaks only HTTP and WebSocket to its server, the shell stays a commodity: it can be
  replaced by another shell—or by a plain browser tab—without touching the product.
  The moment the frontend calls shell APIs, you have coupled the UI to one framework.
- **If the product also runs shell-less** (installed from a package registry and opened
  in a normal browser), keep that tier working.
  The shell is then one consumer of the same server, not a fork of it.

Everything in [Local Server Security](#local-server-security) applies with full
force—wrapping a server in a shell does not make its loopback port private.

#### The Thinnest Shape

Because the page never touches Electron APIs, the whole shell is one plain CommonJS
`main.js` that Electron runs directly (`"main": "main.js"`). There is no bundler, no
TypeScript build, no preload, no renderer bundle, and no IPC. Type-check the file with
`// @ts-check` and `tsc --checkJs` against the `electron.d.ts` that the `electron`
package ships. With Electron’s built-in `autoUpdater`, the main process has **zero**
runtime npm dependencies.

The backend meets the shell–server contract that
[macOS WebView Shell Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#the-shellserver-contract)
defines for every shell; in summary:

1. **Bind `127.0.0.1` on port 0** and let the OS choose a free port, instead of probing
   for one and binding later, which races.
2. **Once the socket is listening, print one ready line on stdout**:
   `{"event":"ready","protocol":1,"url":"http://127.0.0.1:<port>/","port":<port>,"pid":<pid>,"version":"<server version>"}`.
   Connections queue in the listen backlog until the server loop runs, so the shell can
   load the URL at once, with no polling and no regex over log text.
3. **Read a per-launch secret from the first line of stdin**, never argv or the
   environment, and keep reading: the shell holds stdin open.
4. **Treat EOF on stdin like `SIGTERM`**: start a graceful shutdown with a bounded
   deadline. The shell holds the only write end, so EOF means it quit or died
   ([Process Lifecycle](#process-lifecycle)).
5. **Require the secret on every request**: `Authorization: Bearer <secret>` from
   programmatic clients, or the session cookie.
   A shell that controls its cookie store sets that cookie directly, as below; otherwise
   a single-use exchange code at a one-time URL sets it and redirects.

```python
import json, os, signal, socket, sys, threading

bearer = sys.stdin.readline().strip()            # line 1: the per-launch secret

def shut_down_on_stdin_eof() -> None:
    while sys.stdin.buffer.read(65536):          # returns b"" only at EOF
        pass
    os.kill(os.getpid(), signal.SIGTERM)         # the same graceful, bounded path as SIGTERM

threading.Thread(target=shut_down_on_stdin_eof, daemon=True).start()

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(("127.0.0.1", 0))                      # the OS picks a free port
sock.listen(128)                                 # connections now queue in the backlog
port = sock.getsockname()[1]
print(json.dumps({"event": "ready", "protocol": 1, "url": f"http://127.0.0.1:{port}/",
                  "port": port, "pid": os.getpid(), "version": __version__}), flush=True)
serve(sock, bearer)  # e.g. uvicorn.Config(app, fd=sock.fileno(), timeout_graceful_shutdown=5)
```

The shell’s half:

- **Spawn the backend before `ready`.** Child processes do not need `ready`, so the
  interpreter and Chromium start in parallel; show the window on `ready-to-show`.
- **Set the secret as the session cookie with `session.cookies.set`** (`httpOnly`,
  `sameSite: 'strict'`, host-only on the loopback origin) before the first `loadURL`.
  Every `fetch`, `EventSource`, image, and navigation then carries it with no change to
  the page. Do not inject it with `webRequest.onBeforeSendHeaders`: that runs a
  main-process callback for every request, and a session keeps only the last listener
  for each `webRequest` event, so it collides with any other code that needs that event.
  A plain-browser tier uses the contract’s one-time URL instead, so the URL left in
  history is worthless.
- **Cookies are scoped by host, not port.** If several servers share one session, give
  each a per-instance cookie name, and never let a window navigate to another loopback
  port.
- **Deny permissions by default** in both the request and check handlers, and allow only
  what the UI uses, for the app origin only.
- **Keep every window on the app origin** with `will-navigate` and
  `setWindowOpenHandler` on every `webContents` (`web-contents-created` covers windows
  the page opens), and hand allowlisted `http:` and `https:` URLs to
  `shell.openExternal`.
- **Call `app.requestSingleInstanceLock()`.** LaunchServices enforces a single instance
  for Finder launches, but command-line launches bypass it.
- **Register `open-file` and `open-url` before `ready`**, because launch-time opens
  arrive early. `open-url` needs `CFBundleURLTypes` (electron-builder `protocols`), and
  on macOS `setAsDefaultProtocolClient` can only claim schemes already in `Info.plist`.
  A folder dropped on the Dock icon needs a `CFBundleDocumentTypes` entry with
  `LSItemContentTypes: [public.folder]` through `mac.extendInfo`, since electron-builder
  26’s `fileAssociations` has no content-type field.
- **Add a Dock menu with `app.dock.setMenu`**, and stay running with no windows on macOS
  so a Dock click reopens instantly against the warm server.
- **Check `app.isInApplicationsFolder()` before relying on updates.** Squirrel.Mac
  refuses to update from a read-only volume, which includes an app translocated because
  it was launched from Downloads; offer to move it.

```js
// @ts-check
// main.js: the whole shell for a product that is already a local web server.
'use strict';
const { app, autoUpdater, BrowserWindow, Menu, session, shell } = require('electron');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const readline = require('node:readline');

const BEARER = randomBytes(32).toString('base64url');
const COOKIE = 'app_session'; // make it per-instance if several servers share a session
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write']); // only what the UI uses
let appOrigin = ''; // for example http://127.0.0.1:53124, known once the backend listens
let quitting = false;
/** @type {string | undefined} */
let pendingTarget;

if (!app.requestSingleInstanceLock()) app.exit(0);

// Launch-time opens arrive before 'ready', so register these first.
app.on('open-file', (event, filePath) => { event.preventDefault(); openTarget(filePath); });
app.on('open-url', (event, url) => { event.preventDefault(); openTarget(url); });
app.on('second-instance', (_event, argv) => openTarget(argv.at(-1)));

// Spawn before 'ready' so the backend and Chromium start in parallel. `env` is the
// symlink that the environment lifecycle in desktop-python-runtime-patterns swaps to
// `envs/<digest>` after the bundled uv builds and smoke-tests it (see Appendix E).
const data = app.getPath('userData');
const backend = spawn(path.join(data, 'env', 'bin', 'python'),
  ['-m', 'myapp.server'], {
    cwd: data,
    env: allowlistedEnv(),
    stdio: ['pipe', 'pipe', 'inherit'], // stdin carries the secret, then stays open as the lifeline
    detached: true, // own process group, so quitting can signal grandchildren
  });
backend.stdin.write(`${BEARER}\n`); // not argv (visible to ps) or env (inherited by every child)
backend.once('exit', (code) => { if (!quitting) showBackendError(code); });
/** @type {Promise<string>} */
const ready = new Promise((resolve, reject) => {
  backend.once('error', reject);
  readline.createInterface({ input: backend.stdout }).once('line', (line) => {
    const msg = JSON.parse(line); // the contract's ready line
    if (msg.event === 'ready' && msg.protocol === 1) resolve(new URL(msg.url).origin);
    else reject(new Error(`unexpected first line from the backend: ${line}`));
  });
});

/** @param {string} url */
function isAppUrl(url) {
  try { return appOrigin !== '' && new URL(url).origin === appOrigin; } catch { return false; }
}

/** @param {string} url */
function openExternal(url) {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url); // allowlist the scheme
}

// Every webContents, including windows the page opens, stays on the app origin.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) { event.preventDefault(); openExternal(url); }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) void createWindow(url); else openExternal(url);
    return { action: 'deny' };
  });
});

/** @param {string} [url] */
async function createWindow(url) {
  const first = BrowserWindow.getAllWindows().length === 0;
  // No preload and no webPreferences: the page never uses Electron APIs, and the
  // defaults (sandbox, contextIsolation, no nodeIntegration) are the secure ones.
  const win = new BrowserWindow({
    width: 1280, height: 860, show: false,
    ...(first ? { name: 'main', windowStatePersistence: true } : {}), // 44+, experimental
  });
  win.once('ready-to-show', () => win.show());
  await win.loadURL(url ?? `${appOrigin}/`);
}

/** @param {string | undefined} target a path or an app URL */
function openTarget(target) {
  if (!target || target.startsWith('-')) return void BrowserWindow.getAllWindows()[0]?.focus();
  if (!appOrigin) { pendingTarget = target; return; }
  void createWindow(`${appOrigin}/open?target=${encodeURIComponent(target)}`); // a server route
}

app.whenReady().then(async () => {
  appOrigin = await ready;
  const ses = session.defaultSession;
  await ses.cookies.set({ url: appOrigin, name: COOKIE, value: BEARER,
                          httpOnly: true, sameSite: 'strict' });
  ses.setPermissionRequestHandler((_wc, permission, callback, details) =>
    callback(ALLOWED_PERMISSIONS.has(permission) && isAppUrl(details.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
    ALLOWED_PERMISSIONS.has(permission) && isAppUrl(requestingOrigin));
  app.dock?.setMenu(Menu.buildFromTemplate([{ label: 'New Window', click: () => void createWindow() }]));
  if (pendingTarget) openTarget(pendingTarget); else await createWindow();
  if (app.isPackaged) startUpdates();
});

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  quitting = true;
  try { if (backend.pid) process.kill(-backend.pid, 'SIGTERM'); } catch { /* already gone */ }
});

function startUpdates() {
  // Built-in Squirrel.Mac, no npm dependency. On 44.7+ and 45 the entry's sha256 and size
  // are checked before the update is unpacked.
  autoUpdater.setFeedURL({ url: 'https://updates.example.com/darwin-arm64/RELEASES.json',
                           serverType: 'json' });
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 6 * 60 * 60 * 1000);
}

function allowlistedEnv() {
  // Finder and Terminal launches inherit different environments, and an inherited
  // PYTHONPATH, VIRTUAL_ENV, or UV_* changes what the backend runs. Pass an allowlist.
  /** @type {Record<string, string>} */
  const env = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', PYTHONNOUSERSITE: '1' };
  for (const key of ['HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL',
                     'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY']) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

/** @param {number | null} code */
function showBackendError(code) { /* error page with Restart and Reveal Logs; omitted */ }
```

The matching `package.json` and the packaging that differs from
[Appendix B](#appendix-b-electron-builderyml):

```json
{
  "name": "my-app-desktop",
  "productName": "My App",
  "version": "1.0.0",
  "private": true,
  "main": "main.js",
  "scripts": { "start": "electron .", "dist": "electron-builder --mac --arm64" },
  "devDependencies": { "electron": "45.2.3", "electron-builder": "26.18.0" }
}
```

```yaml
files: [main.js, package.json]
electronLanguages: [en] # strips about 51 MB of .lproj locale directories
protocols:
  - name: My App
    schemes: [myapp]
mac:
  minimumSystemVersion: '13.0' # Electron 44+ does not run on macOS 12
  target:
    - { target: dmg, arch: [arm64] }
    - { target: zip, arch: [arm64] } # Squirrel.Mac consumes the zip
  extendInfo:
    CFBundleDocumentTypes:
      - CFBundleTypeName: Folder
        CFBundleTypeRole: Viewer
        LSHandlerRank: Alternate
        LSItemContentTypes: [public.folder]
```

`45.2.3` takes the security exception; `45.0.0` is the strictly aged pin.
Built-in `autoUpdater` feeds are a static `RELEASES.json`; Forge’s `maker-zip` writes
one from `macUpdateManifestBaseUrl` but does not add `sha256` or `size`, so a short
post-build step must.
Add `electron-updater` to `dependencies` only if you want its blockmap differential
downloads or GitHub provider instead.

### Node Backends

`utilityProcess` has been stable since Electron 22. It runs a Node script in a Chromium
services process, with no window and no renderer.

```ts
import { utilityProcess } from 'electron';

const child = utilityProcess.fork(path.join(__dirname, 'backend.js'), [], {
  serviceName: 'my-app-backend', // shows up in app.getAppMetrics()
  stdio: 'pipe',
});
child.on('spawn', () => {
  /* ready to postMessage */
});
child.on('exit', (code) => {
  /* supervise and restart with backoff */
});
```

Constraints worth knowing before you commit:

- It can only be called **after the `app` `ready` event**.
- **`stdin` is restricted to `ignore`.** You cannot drive it with a stdin-based
  protocol; use message passing.
- Native addons load normally.
  The macOS-only `allowLoadingUnsignedLibraries` option exists precisely for loading
  unsigned dylibs there.
- **From Electron 46, `child.kill()` only sends `SIGTERM`** (it used to follow up with
  `SIGKILL` after two seconds), so the child must exit from its `SIGTERM` handler.

The capability that makes `utilityProcess` more than a `fork` replacement is
`MessagePort`: you can create a channel and hand one end to a renderer, so heavy traffic
flows **directly between renderer and backend** without relaying every message through
the main process. For a streaming or high-frequency workload this is the difference
between a responsive app and a stuttering one.

### Bun Backends

`bun build --compile` produces a single-file executable, cross-compilable to 14 targets
(Linux, Windows, and macOS across x64/arm64, plus musl and baseline variants).
Ship it as a sidecar.

Before choosing this, weigh three facts:

- **Size.** A hello-world compiled binary is roughly 57MB; Bun’s own docs acknowledge
  the binary is too big.
  `--minify` and `--bytecode` reduce embedded source size and improve startup, not the
  runtime baseline.
- **Signing works, recently.** macOS codesigning of `--compile` output has been
  supported since Bun 1.2.4 (Feb 2025), via a dedicated `__BUN,__bun` Mach-O section.
- **Use Bun 1.4.1 or later for macOS targets.** Bun’s in-process signer hashed the last
  partial page zero-padded and left stale bytes after the signature, so darwin-arm64
  `--compile` output failed `codesign -v` (reported against 1.3.13 and 1.4.0); macOS 26
  still ran it, and macOS 27 kills it at launch
  ([bun#32159](https://github.com/oven-sh/bun/issues/32159)). The fix
  ([#39837](https://github.com/oven-sh/bun/pull/39837), merged 2026-08-22) first shipped
  in Bun 1.4.1 (2026-09-04). Re-sign the binary with your Developer ID either way.

Bun is a reasonable sidecar runtime and a reasonable package manager.
It is not a good fit for driving the Electron *build*—see
[Package Managers](#6-package-managers-and-the-electron-toolchain).

### Python Backends

Shipping Python with a desktop app has become substantially easier, and the current best
practice is not the one most tutorials describe.
This section covers what changes for an Electron app;
`tbd guidelines desktop-python-runtime-patterns` is the authoritative reference for the
uv layouts, isolation flags, hash pinning, and macOS Python hazards, and for the full
packager comparison.

The decision that shapes everything else is **where the interpreter lives**:

- **Ship only a signed `uv`, and let it install Python and the environment into app
  data** on first run (recommended, and the natural fit when users install packages at
  runtime). uv’s macOS release binaries have been Developer ID–signed and notarized since
  0.12.12 (2026-09-09, per the
  [0.12.x changelog](https://github.com/astral-sh/uv/blob/main/changelogs/0.12.x.md));
  the packager re-signs the copy in your bundle with your identity, and it needs no
  entitlements. The python-build-standalone interpreter uv downloads is ad-hoc signed
  without the hardened runtime, and files written by uv’s own HTTP client carry no
  `com.apple.quarantine` attribute, so Gatekeeper’s notarization check does not apply to
  them and the interpreter loads any wheel’s `.so`. The bundle holds one extra Mach-O
  instead of a tree, and the app needs no library-validation exception.
  The costs: the first run needs the network unless you also ship the Python archive and
  a wheelhouse as data, and trust moves to uv’s hash-checked download path.
- **Bundle a python-build-standalone tree, frozen at build time.** This gives an offline
  first run and no runtime installs.
  Every Mach-O in the tree is signed with your Team ID, so the hardened-runtime
  interpreter loads its own extensions without an exception.
  It needs `com.apple.security.cs.disable-library-validation` only if it must load
  native code signed by someone else or ad hoc, which is exactly what installing wheels
  after signing produces.
  It must never write into the bundle: set `PYTHONDONTWRITEBYTECODE=1` or point
  `PYTHONPYCACHEPREFIX` at app data, because any write breaks the bundle’s
  sealed-resources hash.

uv and python-build-standalone ship per-architecture macOS binaries only; the Python
guideline says how to handle that for uv
([uv’s signed binary and re-signing](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/desktop-python-runtime-patterns.md#uvs-signed-binary-and-re-signing)).
For Electron, where a universal build costs about 1.6x the runtime, separate arm64 and
x64 artifacts are usually the better trade.

Frozen packagers (PyInstaller, Nuitka, py2app, Briefcase, PyApp) remain the right tools
for a fixed backend with no runtime installs; their current versions, cool-off pins, and
fit are tracked in one place,
[Frozen Packagers: Current Status](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/desktop-python-runtime-patterns.md#frozen-packagers-current-status).
Do not start on PyOxidizer, which is abandoned.

Both python-build-standalone layouts keep a real Python tree: you can read the
traceback, you can `ls site-packages`, and startup is a normal interpreter start rather
than an unpack. The Electron-specific parts of the uv-in-the-bundle layout are in
[Appendix E](#appendix-e-python-sidecar-end-to-end).

On performance: before considering a rewrite of a Python backend in a compiled language,
move the measured hot paths into **native wheels** (Rust via PyO3/maturin is the current
standard—`pydantic-core` and `watchfiles` are the pattern).
Wheels flow through the same environment, lockfile, and update chain as every other
dependency, and they leave the backend hackable in Python—which is often part of the
product, not an implementation detail.

### Compiled Sidecars

Go and Rust backends are the least troublesome sidecars: a single static binary, no
runtime tree, straightforward signing.
Build one per `{os, arch}` you ship and select at runtime.

### Node Single Executable Applications

Node’s SEA feature reached a usable shape in 2026: `node --build-sea config.json` landed
in Node 25.5.0, replacing the older `--experimental-sea-config` plus `postject` dance.
It supports V8 snapshots, code cache, and asset bundling including `.node` addons.

It remains **stability 1.1, active development**, and the resulting binary carries a
full Node runtime. For an Electron app this is usually the wrong tool—you already have
Node inside Electron, so use `utilityProcess`. SEA matters only when the backend must
also run standalone outside the app.

### Packaging a Sidecar

electron-builder gives four placement mechanisms with materially different behavior:

| Key | What it does | Lands at | Read it at runtime via |
| --- | --- | --- | --- |
| `files` | Selects what goes **into** the ASAR archive | inside `app.asar` | normal `require`/`import` |
| `asarUnpack` | Pulls matching paths back **out** of the ASAR; reads are transparently redirected | `app.asar.unpacked/` | the same paths as if inside the ASAR |
| `extraResources` | Copies **outside** the ASAR into the resources directory | macOS `Contents/Resources/`, elsewhere `resources/` | `process.resourcesPath` |
| `extraFiles` | Copies into the app content directory | macOS `Contents/`, elsewhere the install root | relative to `app.getAppPath()` |

An executable cannot be run from inside an ASAR archive, so every sidecar needs
`asarUnpack`, `extraResources`, or `extraFiles`. On macOS, `extraFiles` with
`to: Helpers/<name>` puts a helper executable in `Contents/Helpers`, one of Apple’s code
locations; keep data (locks, configuration, archives) in `extraResources`.

```yaml
extraResources:
  - from: resources/bin/${os}/${arch}
    to: bin
    filter: ['**/*']
```

```ts
const binDir = app.isPackaged
  ? path.join(process.resourcesPath, 'bin')
  : path.join(__dirname, '../../resources/bin', process.platform, process.arch);
```

**The executable bit gets lost.** Packaging does not reliably preserve `+x`
([electron-builder#1790](https://github.com/electron-userland/electron-builder/issues/1790)).
Fix it in an `afterPack` hook, which runs before signing, rather than with a runtime
`chmod`: an installed bundle may be read-only (a translocated launch always is), and the
fix belongs in what you sign and test.

### Runtime-Extensible Apps: The Two-Layer Artifact

If users install plugins that are real packages—Python wheels, npm modules, anything a
package manager materializes on disk—one rule reshapes the whole packaging design:
**never write into the app bundle after it is signed.** On macOS, installing anything
into the `.app` breaks the code-signature seal; on every platform it collides with how
updaters replace the install atomically.

Split the artifact in two:

- **Immutable layer, inside the signed bundle**: the shell, a pinned and signed copy of
  the package installer (for example a `uv` binary), the application code or a pin of
  its package, a **hash-pinned lockfile** for the base environment, and optionally the
  runtime as an archive for offline first runs.
- **Mutable layer, in per-user app data**: the interpreter the installer fetched, and a
  real environment materialized by the bundled installer syncing the bundled lock.
  Plugins install here at runtime, through the same installer.

This split preserves a clean **update-integrity chain**: shell updates arrive through
the platform’s signed updater; each shell version carries a new hash-pinned lock; the
bundled installer applies only what that signed lock names.
The only code outside the chain is what the user explicitly chose to install—which is
the package manager’s own trust model, stated honestly rather than laundered through
your updater.

Three consequences to plan for:

- **Keep the interpreter in the mutable layer too.** Library validation is enforced by
  the process that loads the code, from its own signature, and it is not inherited by
  processes it spawns.
  An interpreter installed into app data is not hardened, so it loads plugin wheels’
  `.so` files and your signed processes never load them.
  An interpreter signed inside the bundle with the hardened runtime needs
  `com.apple.security.cs.disable-library-validation` to load them, and electron-builder
  26 applies one `entitlementsInherit` file to every nested binary, so that exception
  would reach Electron’s helpers as well.
- **Update the environment blue/green.** The platform updater replaces the bundle and
  never touches app data, so on launch the shell compares the bundled lock’s digest with
  the environment’s, builds a new environment beside the old one, smoke-tests it, and
  switches a pointer atomically, keeping the previous one for rollback.
  A base sync removes anything the lock does not list, so re-apply user-installed
  packages after it.
- **First-run materialization is a user-visible step**: budget for progress UI, never
  open a Terminal window, and write a completion marker only after success so an
  interrupted run repairs itself.

`tbd guidelines desktop-python-runtime-patterns` has the exact uv layouts and commands.

### Signing Nested Binaries

This is where sidecar projects lose the most time, so be precise about the rules.

**Signing is not recursive.** Apple’s
[TN2206](https://developer.apple.com/library/archive/technotes/tn2206/_index.html) is
explicit that nested code must be signed from the inside out.
Every Mach-O object you add to the bundle—the sidecar, the Python interpreter, every
`.so` extension module, every bundled `.dylib`—must be signed individually **before**
the outer `.app` is signed.
Notarization rejects the bundle if any of them is unsigned.

**The packager already does this; do not add your own signing loop.**
`@electron/osx-sign`, which electron-builder and Forge both use, walks all of
`Contents/`, collects every file that `isbinaryfile` flags plus every `.app` and
`.framework`, and signs them inside out with `codesign --force`
([`src/util.ts`](https://github.com/electron/osx-sign/blob/main/src/util.ts),
[`src/sign.ts`](https://github.com/electron/osx-sign/blob/main/src/sign.ts)). A bundled
`uv`, sidecar, or Python tree is therefore signed with no hook, and a custom `afterPack`
`codesign` loop is simply re-signed over.
Two settings matter instead:

- **`mac.signIgnore`** (regular expressions) excludes binary files that are not code.
  The heuristic also flags `.pyc` files, zips, tarballs, and wheels, and codesign then
  stores a signature for each in extended attributes; with a Python tree that is
  thousands of pointless signatures.
  Ignore them, or ship no `.pyc`.
- **`mac.binaries`** adds code the walk misses.

**Supply your own entitlements on electron-builder 26.** When neither option is set and
the build-resources directory has no `entitlements.mac.plist` or
`entitlements.mac.inherit.plist`, it signs the app *and every nested binary* with a
template granting `allow-jit`, `allow-unsigned-executable-memory`, and
`disable-library-validation`
([`templates/entitlements.mac.plist`](https://github.com/electron-userland/electron-builder/blob/release/v26/packages/app-builder-lib/templates/entitlements.mac.plist)).
Set both `mac.entitlements` (the app) and `mac.entitlementsInherit` (everything nested,
including your sidecars); electron-builder 26 has no per-file setting short of a custom
`mac.sign` function.
The v27 template grants only `allow-jit`.

**Placement follows Apple’s bundle layout.** `Contents/MacOS`, `Contents/Helpers`,
`Contents/Frameworks`, `Contents/PlugIns`, and `Contents/XPCServices` are the code
locations; TN2206 directs that scripts and other non-Mach-O executables belong in
`Contents/Resources`. Since `extraResources` writes to `Contents/Resources`, a Mach-O
sidecar placed there sits outside its canonical location.
In practice this passes notarization, and the evidence is stronger than “some apps get
away with it”: every Electron app that ships a native module already places individually
signed Mach-O `.node` files under `Contents/Resources/app.asar.unpacked`—asar archives
cannot be `dlopen`ed, so unpacking them is mechanical necessity—and those apps, Signal
with `better-sqlite3` among the ones surveyed here, notarize and ship.
Notarization checks that each Mach-O it finds is signed with the hardened runtime; it
does not reject binaries for living under `Resources`. If an unusual layout does produce
a nested-code error, relocating the binary to `Contents/Frameworks` or
`Contents/Helpers` is the standard fix, and for a new sidecar `extraFiles` with
`to: Helpers/<name>` puts it there from the start.

**Hardened runtime and entitlements.** Notarization requires signing with
`--options runtime`. Current Electron needs only one exception, because V8 compiles
JavaScript at runtime:

```xml
<key>com.apple.security.cs.allow-jit</key><true/>
```

That is what `@electron/osx-sign`’s default entitlements and electron-builder 27’s
template grant, and VS Code (built against Electron 43.8.6 on 2026-11-08) ships its app,
renderer, and GPU helpers with `allow-jit` alone, adding
`allow-unsigned-executable-memory` and `disable-library-validation` only to the
extension-host helper that loads arbitrary native modules
([entitlements](https://github.com/microsoft/vscode/tree/main/build/azure-pipelines/darwin)).
Older guidance listing `allow-unsigned-executable-memory` as required for V8 is out of
date.

`disable-library-validation` belongs only on a hardened-runtime executable that loads
native code signed by another team or ad hoc—in practice, an interpreter signed inside
your bundle that imports packages installed after signing.
Library validation is per process: the loading process enforces it from its own
signature, entitlements apply to executables, and in-process libraries inherit their
host’s
([Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)).
A child process runs under its own signature, so the app’s library validation does not
reach an interpreter the app spawns from app data, and a bundled tree whose every `.so`
carries your Team ID needs no exception either.
A `uv` binary needs no entitlements at all.
Add entitlements because a specific failure requires them, not preemptively—each one
widens what an attacker who compromises your process can do.

**Order of operations**: `afterPack` (restore `+x`; flip fuses here only if you do not
use the `electronFuses` key) → `@electron/osx-sign` signs nested code inside out, then
the app → electron-builder’s built-in notarization (`mac.notarize`, through
`@electron/notarize`) submits and staples the `.app`. electron-builder 26 does not
notarize the DMG; Apple’s guidance is to notarize the outermost container, so run
`xcrun notarytool submit --wait` and `xcrun stapler staple` on the DMG afterward if you
want it notarized too.

### Choosing an IPC Transport

| Transport | Choose when | Watch out for |
| --- | --- | --- |
| **`MessagePort`** (utilityProcess) | Node backend, especially high-frequency or renderer-direct traffic. | Electron-specific; no reuse outside the app. |
| **stdio, newline-delimited JSON or JSON-RPC** | Sidecar in any language. **The default choice for sidecars.** | Backpressure and partial-line framing are yours to handle. Not available for `utilityProcess`, whose stdin is `ignore`. |
| **Unix domain socket / Windows named pipe** | You need multiple concurrent streams or a long-lived connection. | Platform-specific path conventions; clean up stale socket files. |
| **Loopback HTTP or WebSocket** | An existing service already speaks it. | See below. This is the transport that causes security incidents. |
| **gRPC** | Polyglot backends, streaming, and a schema you want enforced. | Heavy toolchain for a desktop app. |

Prefer stdio. It binds no port, is reachable by nothing else on the machine, needs no
authentication, and dies with the process.

### Local Server Security

If you bind a loopback port, understand what you have exposed: **every other process on
the machine can reach it, and so, via DNS rebinding, can a web page the user is
visiting.** A hostile site can point a hostname it controls at `127.0.0.1` and issue
requests to your server from the user’s browser.

This is not theoretical.
Two recent examples:

- **CVE-2026-22812** (CVSS 8.8): a developer tool exposed an unauthenticated local HTTP
  server with permissive CORS; any website could create sessions and execute shell
  commands. The published analysis attributes it to assuming that localhost is inherently
  safe.
- **CVE-2025-66414** (CVSS 7.6): the MCP TypeScript SDK before 1.24.0 shipped without
  DNS rebinding protection by default.

If you must bind a port:

1. Bind `127.0.0.1` explicitly, never `0.0.0.0`.
2. Use an **ephemeral port** (bind port 0; probing for a free port and binding later
   races) and a **secret token** minted at startup and required on every request.
   **Pass it on the child’s stdin**, not in argv, which `ps` shows to other users, and
   not in the environment, which every grandchild inherits—plugins, `git`, language
   servers, anything the backend spawns.
3. **Validate the `Host` header** against an allowlist; this is what actually stops DNS
   rebinding.
4. Set a strict CORS origin allowlist.
   Never call a CORS middleware with no arguments.

Because a rebinding attack cannot carry the target’s cookies, real authentication on
every endpoint defeats it—which is why the token in step 2 is the highest-value
mitigation.

**In the web view, carry the token in a cookie, not a header.** Programmatic clients can
send `Authorization: Bearer <secret>`, but `EventSource` cannot send custom headers—its
constructor takes only a URL and `withCredentials`
([HTML spec](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface))—and
neither can images, scripts, stylesheets, or navigations.
A header-based token therefore leaves those routes open or pushes the token into URLs,
where it lands in history and logs.
An `HttpOnly`, `SameSite=Strict`, host-only cookie on the loopback origin covers every
request type, and the shell can set it without touching the page
([The Thinnest Shape](#the-thinnest-shape)).

**Opaque-origin sandboxes need a separate gate.** A document with an opaque
origin—served with a CSP `sandbox` directive that omits `allow-same-origin`, or loaded
in a sandboxed `<iframe>`—is cross-site for SameSite purposes.
Chromium nulls the site-for-cookies when any frame from the requester up to the top has
an opaque origin
([`site_for_cookies.cc`](https://github.com/chromium/chromium/blob/main/net/cookies/site_for_cookies.cc),
`RenderFrameHostImpl::ComputeIsolationInfoInternal`), so that document’s subresource,
`fetch`, and `EventSource` requests arrive without the `SameSite=Strict` cookie.
If you render untrusted active content that way, gate the routes it needs with something
the sandboxed document already holds, such as an unguessable per-instance path prefix,
and keep those routes read-only and narrowly scoped.
Do not weaken the cookie to `SameSite=None` to make them work.

### Process Lifecycle

Orphaned backend processes are the most common bug in sidecar architectures, and they
are invisible in development because you kill the terminal.

- **Spawn from the main process, not the renderer.** Renderer-spawned children are not
  cleaned up when the app closes.
- **Kill explicitly on `before-quit`**, and treat a slow shutdown as a bug rather than
  waiting on it forever.
- **Let the child detect parent death**, because the parent will eventually crash
  without running your handler.
  On Linux, `prctl(PR_SET_PDEATHSIG)`. On macOS there is no equivalent, so use a **stdin
  lifeline**: give the child a pipe as stdin, keep the write end only in the parent, and
  have the child treat EOF like `SIGTERM`, shutting down gracefully within a bounded
  deadline. The kernel closes that end however the parent dies, `SIGKILL` and crashes
  included, and the same pipe can deliver the token first (the backend snippet in
  [The Thinnest Shape](#the-thinnest-shape)). A stdio JSON-RPC sidecar gets this for
  free, since its read loop ends at EOF. Polling `getppid()` for 1 is a fallback.
  On Windows there are no POSIX signals at all.
- **On Windows, use a Job Object** with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. This is
  the only mechanism that survives a parent crash.
  Node does not expose it; VS Code uses `windows-process-tree`. `taskkill /F /T /PID`
  only helps when you still get to run code.
- **On POSIX**, spawn `detached: true` and kill the group with
  `process.kill(-child.pid, 'SIGTERM')` so grandchildren die too.

* * *

## 4. Security Baseline

### The Defaults Are Already Correct

| Setting | Default | Default since |
| --- | --- | --- |
| `sandbox` | `true` | Electron 20 |
| `contextIsolation` | `true` | Electron 12 |
| `nodeIntegration` | `false` | Electron 5 |
| `nodeIntegrationInSubFrames` | `false` | — |
| `nodeIntegrationInWorker` | `false` | — |
| `webviewTag` | `false` | Electron 5 |
| `webSecurity` | `true` | — |
| `allowRunningInsecureContent` | `false` | — |

Advice to “enable context isolation and disable node integration” describes the state
your app is already in.
The real risks are the deliberate downgrades—`nodeIntegration: true` to make a library
work, `webSecurity: false` to silence a CORS error in development that then ships.
Each of those is a decision that needs justification in review, not a default to
restore.

### The Preload Boundary Is an RPC Boundary

Most Electron security incidents are effectively **XSS to RCE**, and the escalation path
runs through an over-broad preload API. This is the single highest-value control.
Expose named capabilities, never a generic channel, and validate the sender and the
payload in every handler—the pattern and code are in
[Typed IPC](#typed-ipc-across-the-context-bridge).

### Content Security Policy

Set a CSP and do not weaken it to make a bundler happy.

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
```

Prefer a response header via `session.defaultSession.webRequest.onHeadersReceived` (or
your custom protocol handler) over a `<meta>` tag, because the header cannot be
manipulated by injected markup.
`'unsafe-inline'` and `'unsafe-eval'` defeat the purpose; if a dependency requires
`'unsafe-eval'`, that is information about the dependency.

### Navigation, Windows, and Permissions

Three handlers, all of which default to permissive and all of which you should set:

```ts
// 1. New windows: deny by default, open trusted external links in the real browser.
contents.setWindowOpenHandler(({ url }) => {
  if (isTrustedExternal(url)) shell.openExternal(url);
  return { action: 'deny' };
});

// 2. Navigation: allow only the URLs the app itself loads. With loadFile the
//    renderer's origin is the opaque 'null', so compare against a URL prefix
//    (dev server URL or the packaged renderer's file:// base), not an origin.
//    A custom protocol gives you a real origin to compare instead.
contents.on('will-navigate', (event, url) => {
  if (!url.startsWith(trustedRendererBase)) event.preventDefault();
});

// 3. Permissions: deny everything you have not deliberately enabled.
session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
  callback(ALLOWED_PERMISSIONS.has(permission));
});
```

`shell.openExternal` with an unvalidated URL is a remote code execution primitive on
every platform. Allowlist the scheme before calling it.

### Fuses and ASAR Integrity

Fuses are compile-time flags flipped into the binary at package time by
`@electron/fuses`. Several defaults are permissive for developer convenience and should
be changed for a shipping app.

| Fuse | Default | Ship with | Why |
| --- | --- | --- | --- |
| `runAsNode` | Enabled | **Disabled** | `ELECTRON_RUN_AS_NODE` turns your signed app into a general-purpose Node interpreter—a living-off-the-land primitive. **Breaks `child_process.fork`; use `utilityProcess`.** |
| `nodeCliInspect` | Enabled | **Disabled** | Prevents attaching a debugger to a shipped app via `--inspect`. |
| `nodeOptions` | Enabled | **Disabled** | Stops `NODE_OPTIONS` and `NODE_EXTRA_CA_CERTS` from injecting behavior at launch. |
| `grantFileProtocolExtraPrivileges` | Enabled | **Disabled** (with a custom protocol) | Removes the elevated privileges `file://` pages otherwise receive. |
| `embeddedAsarIntegrityValidation` | Disabled | **Enabled** | Validates `app.asar` at load; the app terminates on mismatch. |
| `onlyLoadAppFromAsar` | Disabled | **Enabled** | Stops an attacker from dropping a loose `app/` directory beside the archive. |
| `cookieEncryption` | Disabled | Consider | Encrypts the cookie store at rest. **One-way: enabling and later disabling corrupts the store.** |

Two ways to apply them: call `flipFuses` from `@electron/fuses` in an `afterPack` hook,
or set electron-builder’s `electronFuses` config key and let it do the flipping.
Both are used in production—see [§8](#8-what-shipping-apps-actually-do)—and the config
key is the less error-prone of the two because it cannot be skipped by a hook that
silently fails.

ASAR integrity graduated from experimental to stable in Electron 39. It is supported on
macOS (since Electron 16, via `ElectronAsarIntegrity` in `Info.plist`) and Windows
(since Electron 30, via an `Integrity` resource), using SHA-256 over both blocks and the
whole archive.
Electron 41 added a digest so the integrity data is itself tamper-evident.
Note that integrity validation and `onlyLoadAppFromAsar` together are what make code
signing meaningful: without them, a signed app will happily load modified application
code.

### Keeping Current

Checklist item 16 is “use a current version of Electron,” and it has teeth.
**CVE-2026-70601** (high, published 2026-07-27) is a context isolation bypass via a
prototype hijack—it defeats the boundary the rest of this section is built on.
Between 2026-08-16 and 2026-11-08 Electron published 15 more advisories of its own
([security advisories](https://github.com/electron/electron/security/advisories)), on
top of the Chromium backports in most patch releases, among them **CVE-2026-102672**, a
local race in Squirrel.Mac’s update installer (fixed in every supported major), and
**CVE-2026-115570** (high), blocking compromised eMudhra intermediate certificates.
Because only three majors are supported at a time, staying inside the window is a
prerequisite for receiving fixes at all.

The full 20-item
[official checklist](https://www.electronjs.org/docs/latest/tutorial/security) is
versioned with the docs; read it rather than relying on this summary, which is
deliberately partial.

* * *

## 5. Packaging and Distribution

### Choosing a Packager

| Tool | Weekly npm downloads (week of 2026-11-01) | Choose when |
| --- | --- | --- |
| **electron-builder** | ~8.1M | You want the most capable packager: more targets, differential updates, mature signing integration, Linux formats, DMGs built with `hdiutil` and no native addons. **Default recommendation.** |
| **Electron Forge** (`@electron-forge/cli`) | ~1.1M | You want official Electron-team support and one tool for build/package/make/release. |
| **@electron/packager** | ~1.8M | You are building a custom pipeline and want only the bundling step. Forge wraps this. |

There is a genuine tension here.
Electron Forge is the officially supported tool, lives under the `electron/` GitHub org,
and is what the Electron docs point you to.
electron-builder is a community project with an uneven release cadence—its `latest`
dist-tag currently lags its newest v26 release, v27 has been in alpha since June 2026,
and v26 still pins 2024–2025 releases of the Electron signing and notarization tools.

The recommendation still goes to electron-builder, for two reasons.
The capability gap is real, particularly for Linux targets and differential updates:
Forge 8 updates through Electron’s built-in `autoUpdater`, which gained Sparkle binary
deltas on macOS but has no blockmap downloads and no Linux updater.
And the adoption evidence is lopsided: of the production apps surveyed in
[§8](#8-what-shipping-apps-actually-do), every one uses electron-builder except VS Code,
and **none use Forge**. Forge 8 (2026-09-29) removed the main reasons to hesitate—its
Vite plugin is stable and its install is much lighter—so choosing it for official
support is a defensible choice.
Note that its DMG maker reaches native addons (`fs-xattr` and `macos-alias`, through
`electron-installer-dmg` and `appdmg`) that need install scripts and a compiler.
A minimal annotated config is in [Appendix B](#appendix-b-electron-builderyml).

### macOS: Signing and Notarization

Requirements: a paid Apple Developer account, a Developer ID Application certificate,
and a machine with Xcode command line tools.

The flow is: sign every nested binary inside out → sign the app with `--options runtime`
and your entitlements → submit with `xcrun notarytool submit` → `xcrun stapler staple`
the ticket → verify with `spctl`.

- `altool --notarize-app` was removed from `xcrun` on 2023-11-01. `notarytool` is the
  only path. `@electron/notarize` wraps it.
- Store credentials once with `notarytool store-credentials` and reference the keychain
  profile, rather than putting an app-specific password in CI logs.
- Typical turnaround is a few minutes, but budget for it in release timing.
- Mac App Store distribution still works, via electron-builder’s `mas` target, with its
  own certificates and sandbox requirements.
- Since Electron 42, **macOS notifications require the app to be code signed**, so an
  unsigned local build will silently fail to show notifications.
  This surprises people who assume signing only matters at release.
- **Notarization is effectively mandatory.** macOS 15 removed the Control-click
  Gatekeeper override; users must approve unnotarized software in System Settings >
  Privacy & Security
  ([Apple, 2024-08-06](https://developer.apple.com/news/?id=saqachfa)). Homebrew 5.0.0
  (2025-11-12) deprecated `--no-quarantine` and announced that official casks failing
  Gatekeeper would be disabled in September 2026
  ([announcement](https://brew.sh/2025/11/12/homebrew-5.0.0/)); most such casks carry
  `disable! date: "2026-09-01", because: :fails_gatekeeper_check`. Homebrew quarantines
  every cask download, so a personal tap needs a notarized app too.
- **Never set `LSFileQuarantineEnabled`** in `Info.plist`. It quarantines every file the
  app creates
  ([Apple](https://developer.apple.com/documentation/bundleresources/information-property-list/lsfilequarantineenabled)),
  child processes inherit the behavior, and Gatekeeper then blocks the ad-hoc-signed
  interpreters, native modules, and helpers they write: a terminal running inside an app
  that sets the key quarantined pnpm’s native `.node` files
  ([pnpm#11056](https://github.com/pnpm/pnpm/issues/11056)). Electron’s default
  `Info.plist` does not set it; Chrome’s does, so do not copy Chrome’s.
- **TCC charges a child process’s file access to the app.** Privacy prompts for Desktop,
  Documents, Downloads, and removable or network volumes name your app, use its
  `NS*UsageDescription` strings, and record the decision against its signing identity,
  because the app is the child’s responsible process
  ([Quinn, Apple DTS](https://developer.apple.com/forums/thread/678819)). The same
  backend started from Terminal uses Terminal’s grants instead.
  Ship the usage strings, and do not touch protected folders until the user navigates
  there.

`tbd guidelines macos-webview-shell-patterns` has the full macOS platform rules: TCC,
Local Network privacy, App Sandbox, App Translocation, Homebrew casks, and the minimum
macOS version.

### Windows: Authenticode

Two facts overturn most older guidance:

- **Since June 2023**, the CA/Browser Forum requires **all** code signing certificates,
  OV and EV alike, to keep private keys on FIPS 140-2 Level 2 hardware.
  Software `.pfx` files are no longer issued, which is why “copy the certificate into
  CI” no longer works.
- **Since 2024, EV certificates no longer grant an instant SmartScreen bypass.** All
  certificate types build reputation the same way.
  Paying the EV premium specifically to avoid SmartScreen warnings is no longer
  justified.

| Option | Cost | Notes |
| --- | --- | --- |
| **Azure Artifact Signing** (formerly Trusted Signing) | ~$10/month basic, ~$100/month premium | Cloud signing via Entra ID, no hardware token, integrates with CI. Renamed 2026-01-28. **The 3-year business-history requirement was dropped**, so individuals can now qualify. Availability: organizations in US, Canada, EU, UK; individuals in US and Canada. |
| **Traditional OV/EV certificate** | Varies | Requires an HSM or token. Workable in CI only through a cloud HSM such as DigiCert KeyLocker, which is what the Electron project itself uses. |
| **SignPath Foundation** | Free | OV-level signing for qualifying open-source projects. |

### Linux: Target Formats

There is no signing equivalent; distribution is about format.

| Format | Status (2026) |
| --- | --- |
| **Flatpak** | The de facto desktop standard. Flathub passed 3,200 apps. Sandboxed, auto-updating, shared runtimes. |
| **.deb / .rpm** | Still the right answer for distro-native installs. electron-builder generates both. |
| **Snap** | Well integrated on Ubuntu; single vendor-controlled store. |
| **AppImage** | Still works, increasingly niche. No sandbox, no built-in updates, and bundled libraries only get patched when you rebuild. GIMP 3 dropped it in 2025. |

Ship `.deb` plus one sandboxed format; AppImage only if your users specifically want a
portable single file.

### Auto-Update

| Option | Platforms | Constraints |
| --- | --- | --- |
| **`update-electron-app` + update.electronjs.org** | macOS, Windows | Free and hosted, but requires a **public GitHub repository**, releases published to GitHub Releases, and a **code-signed** app. **No Linux support.** |
| **electron-updater** (electron-builder) | macOS, Windows, **Linux** | Works against GitHub Releases, S3, or any static host. Differential downloads via `.blockmap` fetch only changed byte ranges (NSIS, and on macOS against the cached previous zip). The 6.x SHA-512 check comes from the same unsigned manifest; signed manifests arrive in 7. |
| **Electron `autoUpdater`** directly | macOS, Windows | The built-in module, backed by Squirrel.Mac and Squirrel.Windows, with no npm dependency. You supply the feed; on macOS a static `RELEASES.json` (`serverType: 'json'`) works. On 44.7+ and 45 it resumes downloads, checks a declared `sha256` and `size`, and applies Sparkle binary deltas ([Recent Platform Changes](#recent-platform-changes)). |

Electron update payloads are large because the runtime ships with the app.
Differential mechanisms help when only your code changes; an Electron bump rewrites the
roughly 200 MB `Electron Framework` binary, so expect most of a full download then (not
measured here).

**Code signing is a prerequisite for auto-update, not an optional extra.** Squirrel.Mac
validates the unpacked update, nested code included, against the running app’s
designated requirement—the same bundle identifier and Developer ID team—and refuses to
run from a read-only volume, including a translocated launch
([`SQRLCodeSignature.m`](https://github.com/Squirrel/Squirrel.Mac/blob/main/Squirrel/SQRLCodeSignature.m),
[`SQRLUpdater.m`](https://github.com/Squirrel/Squirrel.Mac/blob/main/Squirrel/SQRLUpdater.m)).

### Native Modules

Native addons are compiled against a specific ABI, and Electron’s Node is not your host
Node, so a module built for your system Node will fail to load inside Electron.

- **`@electron/rebuild`** recompiles native modules against Electron’s headers, and
  downloads prebuilds instead of compiling when the module publishes them.
- **Node-API (N-API) prebuilds** are the preferred upstream pattern: one prebuild per
  `{os, arch}` works across Node and Electron versions without recompilation.
  Prefer dependencies that ship them.
- **For SQLite, check `node:sqlite` first.** It is built into Node, so it needs no
  rebuild step and no native dependency at all.
  In the Node line Electron 43 through 45 embed (24.22.x on 2026-11-08), `node:sqlite`
  is at **Stability 1.2, release candidate**, promoted at Node 24.15.0, and Node 26.13.0
  (Electron 46’s) still marks it release candidate—so treat the API as settling rather
  than frozen, and keep data access behind a thin wrapper.
  Use `better-sqlite3` when you need its richer API—transactions wrapper, user-defined
  function options, BigInt control—and accept the rebuild step.
  This single change removes the most common source of native-module pain in Electron
  apps.

* * *

## 6. Package Managers and the Electron Toolchain

The headline change since early 2026 is that **all three major package managers now
block dependency lifecycle scripts by default**, and **Electron stopped needing one**.

Since Electron 42, the npm package no longer downloads its binary in a `postinstall`
script; it downloads on first run of its `bin` script, explicitly to remove a
supply-chain attack surface.
`ELECTRON_SKIP_BINARY_DOWNLOAD` was removed as a result, and
`npm install electron --ignore-scripts` now works, with `npx install-electron` available
to fetch on demand.

So the build-script configuration below matters **only if you are on Electron 41 or
older**. On current Electron you can leave dependency scripts blocked, which is the
safer posture anyway.

| Manager | Version | Electron status |
| --- | --- | --- |
| **npm** | 12.2.1 | Full support. npm 12 disables install scripts by default (`allowScripts`); approve with `npm approve-scripts electron` if you are on Electron ≤41. |
| **pnpm** | 12.15.0 | Full support, with configuration. See below. VS Code’s repository pins pnpm 12 (`packageManager: pnpm@12.16.0` on 2026-11-08). |
| **Bun** | 1.4.4 | Fine for `bun install` (Electron is in Bun’s default trusted-dependency allowlist). **Not supported by Electron Forge** ([forge#3906](https://github.com/electron/forge/issues/3906), open). electron-builder’s script hooks remain unreliable under Bun ([bun#9895](https://github.com/oven-sh/bun/issues/9895), open since April 2024). |

**pnpm configuration.** Since pnpm 11, and unchanged in 12, these settings live in
`pnpm-workspace.yaml`; `.npmrc` is read only for auth, registry, TLS, and proxy settings
([pnpm settings](https://pnpm.io/settings)). Forge’s own pnpm check still suggests
putting `node-linker` in `.npmrc`; on pnpm 11 and later use the workspace file:

```yaml
# pnpm-workspace.yaml
nodeLinker: hoisted # electron-builder and Forge crawl node_modules and do not follow symlinks
allowBuilds:
  electron: true # only needed on Electron <= 41
```

Without `nodeLinker: hoisted`, packagers fail to resolve dependencies in the app
directory.
This requirement is documented in electron-builder’s issue tracker rather than
its docs, and Electron Forge enforces the equivalent requirement in its system check
(since its pnpm support in 7.7.0, and still in 8).

**On Bun specifically.** Advice that Bun and Electron are broadly incompatible rests on
issue reports from 2024–2025, most of which have since been resolved: the
electron-builder segfault ([bun#18249](https://github.com/oven-sh/bun/issues/18249)) is
closed, the install failure ([bun#1588](https://github.com/oven-sh/bun/issues/1588),
filed against Bun 0.2.2 in 2022) is closed, and the Quasar lockfile mismatch is closed
with a documented workaround.
The two still open are the ones that matter: Forge does not support Bun, and
electron-builder’s `rebuild` script lookup still fails under Bun.
So the accurate claim is narrow: **Bun is a fine package manager and sidecar runtime for
an Electron project; it is not a supported driver for the Electron build step.** Install
with Bun if you like, and invoke the packager through Node.

* * *

## 7. Testing and CI

**Testing.** Playwright drives a real Electron app through its `_electron` namespace,
launching the built main process and giving you a normal page object for the renderer.
This is the highest-value test layer for a desktop app, because it covers the
main/preload/renderer wiring that unit tests cannot.
Keep unit tests for pure logic in `src/shared` and backend code, and use golden tests
for IPC contracts.

**CI.** Build on the OS you are targeting: macOS builds need macOS for signing and
notarization, and Windows installers need Windows.
A three-way matrix is the norm.

Specific things that bite:

- **Signing secrets in CI.** macOS needs the certificate imported into a temporary
  keychain that is deleted afterward.
  Windows needs a cloud signing service, since key material can no longer live in a
  file.
- **Notarization is slow and rate-limited.** Do not notarize on every pull request; sign
  and notarize on release tags only.
- **Universal macOS builds** via `@electron/universal` merge x64 and arm64 outputs,
  which requires both to have been built.
- **`@electron/rebuild` needs a native toolchain** on each runner.
- **Cache the Electron binary download** between runs; it is the largest single cost in
  a cold build.
- **Know which macOS you build on.** On GitHub Actions `macos-latest` and `macos-26` are
  macOS 26 on arm64, `macos-15` is also available, and the macOS 14 images were retired
  on 2026-11-02 ([runner images](https://github.com/actions/runner-images)).
- **Verify what you ship**, after the build:
  `codesign --verify --deep --strict --verbose=2`, `xcrun stapler validate`, and
  `spctl -a -vvv -t exec` on the `.app`.
- **Budget for the Electron release cadence.** With about two patch releases per
  supported line per week, most of them carrying Chromium security backports, the
  security exception to the cool-off is routine.
  Make “bump Electron, rebuild, sign, notarize, publish” one cheap, scripted step.

A complete release workflow is in
[Appendix F](#appendix-f-github-actions-release-workflow).

* * *

## 8. What Shipping Apps Actually Do

The recommendations above are not derived from first principles alone.
The following is a survey of well-engineered open-source Electron apps, read from their
actual build configuration: the Electron and packager columns on 2026-11-08 (from each
default branch’s `package.json`), the other columns on 2026-08-16.

| App | Electron | Renderer bundler | Packager | Sandbox | Fuses |
| --- | --- | --- | --- | --- | --- |
| VS Code | 43.8.6 (`nativeBuild.target`) | esbuild (new pipeline) | custom (`@vscode/gulp-electron`) | Yes | Not visible in public config |
| Signal Desktop | 45.2.1 | **Rolldown 1.0.1** (migrated from webpack) | electron-builder 26.11.1 | Partial (phased preloads) | `@electron/fuses` present |
| Bitwarden | 43.8.3 | webpack | electron-builder 26.18.0 | Yes | **7 flipped** |
| Mattermost | 45.2.1 | webpack | electron-builder 26.6.0 | — | — |
| Joplin | 42.11.18 | esbuild | electron-builder 26.15.7 | — | — |
| Element Desktop | 41.0.2 | n/a (wraps Element Web) | electron-builder 26.8.2 | Yes, `app.enableSandbox()` | **8 configured** |
| Logseq | 42.11.16 | shadow-cljs + webpack + Vite | electron-builder 26.17.0 | **No** (`sandbox: false`) | — |
| Standard Notes | 35.2.0 | webpack | electron-builder ^24.9.1 | — | — |

What generalizes, and what does not:

- **electron-builder wins on adoption.** Every app here uses it except VS Code, which
  runs a custom pipeline justified by its scale.
  **None use Electron Forge**, despite Forge being the officially supported tool.
  This is the strongest empirical signal in the survey, and it is why electron-builder
  is the recommendation here despite not being an official Electron project.

- **CJS for main and preload is universal.** Every app in the survey emits CJS for the
  preload, and all but VS Code emit CJS for main.
  ESM has been available since Electron 28 and production has not moved.
  Treat “bundle main to CJS” as the boring, correct default.

- **Nobody uses an IPC framework.** Not tRPC-over-IPC, not comlink, not electron-trpc.
  Every app hand-writes a typed preload and gets its safety from TypeScript interfaces:
  VS Code has a custom typed channel abstraction over `MessagePort` in
  `src/vs/base/parts/ipc/`, Signal declares an `IPCType` interface, Bitwarden exposes
  five namespaces (`ipc.auth`, `ipc.autofill`, `ipc.platform`, `ipc.keyManagement`,
  `ipc.tools`) through `contextBridge`. The pattern in
  [Appendix D](#appendix-d-preload-and-typed-ipc) is what these apps converge on.

- **Sandboxing is the baseline, and exceptions are visible.** VS Code, Element, and
  Bitwarden run sandboxed renderers.
  Logseq sets `sandbox: false` and keeps `contextIsolation: true` as a compensating
  control—which is the honest way to take that tradeoff if you must.

- **Custom protocols are what serious apps use instead of `file://`.** VS Code registers
  `vscode-file://` and Element registers `vector://`, both as standard and secure
  schemes. This is the checklist’s advice and it is followed in practice.

- **The two most security-focused apps have near-identical fuse configurations.**
  Bitwarden flips seven in `apps/desktop/scripts/after-pack.js`; Element configures
  eight through electron-builder’s `electronFuses` key in `electron-builder.ts`. Both
  disable `runAsNode`, `enableNodeOptionsEnvironmentVariable`, and
  `enableNodeCliInspectArguments`, and both enable `enableCookieEncryption`,
  `enableEmbeddedAsarIntegrityValidation`, and `onlyLoadAppFromAsar`. They differ on
  `grantFileProtocolExtraPrivileges`: Element disables it, Bitwarden leaves it enabled
  and notes a CORS limitation.
  That is the same table recommended in
  [Fuses and ASAR Integrity](#fuses-and-asar-integrity), independently arrived at twice.

- **Rust plus Node-API is the modern native module pattern**, replacing hand-written
  C++. Signal ships `libsignal-client`, `ringrtc`, and `sqlcipher`; Bitwarden builds
  `desktop_native/napi/` with `@napi-rs/cli` across six architectures.

- **Bundler choice does not generalize yet.** Webpack is still the most common, but it
  is legacy weight rather than a current recommendation: Signal has moved to Rolldown,
  VS Code and Joplin use esbuild, and the maintained templates are all Vite.
  New projects should start on Vite/Rolldown; the webpack majority reflects when these
  apps were built.

- **Staying inside the support window takes continuous work.** On 2026-11-08 (supported
  majors 43 through 45), four of the eight are inside it: Signal and Mattermost on 45,
  VS Code and Bitwarden on 43. Joplin (42.11.18, the last 42.x release) and Logseq
  (42.11.16, up from 38 on 2026-08-16) are one major behind, since 42 reached end of
  life on 2026-10-20; Element (41) and Standard Notes (35) are further behind.
  None of the four outside the window receive Electron security fixes.

One caution on templates: popularity is not currency, and currency does not last.
`electron-react-boilerplate` (~24k stars) has moved to electron-vite 5, Vite 7, and
Electron ^44.4.0, while `electron-vite-react`, the most current template on 2026-08-16,
still pins Electron ^42.1.0, which is past end of life.
Check a template’s Electron major against the support window before starting from it.

### Python-Backed Apps

Four 2026 Electron apps that ship or install Python, read from source on 2026-11-08:

| App | Electron | How Python arrives | Where the environment lives | Updates | macOS arm64 download |
| --- | --- | --- | --- | --- | --- |
| [Comfy Desktop 2](https://github.com/Comfy-Org/Comfy-Desktop) | 40.4.1 | A small bundled python-build-standalone “bootstrap” interpreter, plus a prebuilt relocatable environment downloaded per install (810 MB on macOS) | Per-install directory; app data in Application Support | ToDesktop and electron-updater | 196 MB DMG |
| [Open WebUI Desktop](https://github.com/open-webui/desktop) | 45.2.1 | Downloads python-build-standalone 3.12.13 on first run and checks its SHA-256, then `pip install uv` and `uv pip install` of the app into that interpreter, with no venv | `userData/python` | electron-updater | 135 MB DMG |
| [JupyterLab Desktop](https://github.com/jupyterlab/jupyterlab-desktop) | ^42.4.0 | A bundled conda-pack tarball, excluded from signing with `signIgnore` (CI signs the binaries inside it first), extracted with `conda-unpack` on first run | `~/Library/jupyterlab-desktop`, chosen because conda environments cannot live in paths with spaces | update-electron-app | 380 MB DMG |
| [Positron](https://github.com/posit-dev/positron) | VS Code fork | None bundled; discovers the user’s interpreters and, with consent, installs uv with the official installer and runs `uv python install` | The user’s environments | VS Code-style | 881 MB DMG |

What they show:

- **Every app whose plugins are pip packages keeps a writable environment outside the
  code signature**, in app data or the user’s home, as the
  [two-layer artifact](#runtime-extensible-apps-the-two-layer-artifact) requires.
- **Isolation from the user’s toolchain has to be explicit.** The predecessor of Comfy
  Desktop 2 bundled uv without `--no-config`, so a user’s `~/.config/uv/uv.toml` made
  installs unsatisfiable
  ([Comfy-Org/desktop#1722](https://github.com/Comfy-Org/desktop/issues/1722)).
- **Runtime-installed binaries meet Gatekeeper when anything quarantines them.** Comfy
  Desktop 2 ships a repair step that strips `com.apple.quarantine` and ad-hoc re-signs
  every Mach-O in the environment, and retries when macOS kills a process.
- **Entitlements drift upward.** Open WebUI Desktop’s entitlements grant
  `disable-library-validation`, `allow-unsigned-executable-memory`,
  `allow-dyld-environment-variables`, and `debugger`, although its interpreter runs as a
  separate process from app data, where the app’s library validation does not apply.
- **The browser-patch burden is felt.** JupyterLab Desktop’s maintainers discussed
  archiving it in 2025 partly because it ships “a whole browser, with all its zero days”
  ([#890](https://github.com/jupyterlab/jupyterlab-desktop/issues/890)), and on
  2026-11-08 its main branch pins Electron 42, two weeks past end of life.
  Comfy Desktop 2’s Electron 40 is further behind.

* * *

## Supply-Chain Mitigation

This repository enforces a **14-day package-age rule**: do not install or upgrade to a
version less than 14 days old, so that a compromised release has time to be discovered.
See
[supply-chain-hardening](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)
for the general policy and tooling.

Electron-specific considerations:

- **Security patches are the documented exception.** Electron ships fixes on supported
  lines only, and an Electron CVE is usually a renderer-reachable one.
  Take the patch and document the exception.
  Patch releases whose changes are labeled `security` (Chromium and V8 backports)
  qualify, and with about two releases per line per week they are the norm rather than
  the exception.
- **Lifecycle scripts are now blocked by default** across npm, pnpm, and Bun, and
  Electron no longer needs one.
  Keep them blocked.
- **A desktop app’s dependency tree ships to the user’s machine** and runs outside the
  browser sandbox in the main process.
  A compromised transitive dependency imported into main is worse than the same
  dependency in a server, where at least it is not running with the user’s desktop
  privileges. Keep the main process’s dependency list short and audited; push incidental
  work into the renderer (sandboxed) or a sidecar (separately signed).
  A shell around an existing local server can have none at all
  ([The Thinnest Shape](#the-thinnest-shape)).
- **A bundled Python environment has its own supply chain.** Apply the cool-off once, at
  release time, when you lock it, and ship hash-pinned locks so nothing resolves on the
  user’s machine; `tbd guidelines desktop-python-runtime-patterns` covers the details.
- **ASAR integrity plus `onlyLoadAppFromAsar` are the tamper controls** that make
  signing meaningful after install.

* * *

## When Not to Use Electron

Electron’s cost is a Chromium and Node runtime per app, and a memory floor well above a
native app. On macOS the runtime alone is about **121 MB to download** (the 45.2.3
`darwin-arm64` zip is 121,208,238 bytes) and about **300 MB installed**: measured on
2026-11-08 from installed Electron 44.9.3 arm64 apps, `Electron Framework.framework` is
299.6 MB (a 202.2 MB Mach-O, 51 MB of `.lproj` locales, and 18.9 MB of libraries), so a
minimal app lands just above it, or near 250 MB with `electronLanguages` set.
A universal build is about 1.6x: the framework Mach-O doubles (430.6 MB in a 45.2.1
universal app) while resources are shared, and the two universal apps measured have
480–493 MB frameworks.
Figures of 85–120 MB that circulate for Electron are the compressed download, not the
installed size. You are buying one rendering engine that behaves identically everywhere,
the full web ecosystem, in-app DevTools, and a deep well of documentation and hiring.

Consider alternatives when bundle size or memory is a hard product constraint, or when
the app is small enough that the runtime dominates it.
The main tradeoff you are accepting in exchange is **webview fragmentation**:
system-webview frameworks render on WebView2 on Windows, WKWebView on macOS, and
WebKitGTK on Linux, so you write once and debug three times.
That cost is concrete rather than
theoretical—`tbd guidelines tauri-app-development-patterns` catalogues what actually
breaks, and the Linux list is long.

The cross-platform alternatives worth evaluating have their own guidelines: **Tauri**
(`tbd guidelines tauri-app-development-patterns`) for a small, signed, auto-updating app
if you can accept Rust in the build, and **Electrobun**
(`tbd guidelines electrobun-app-development-patterns`) for internal or trusted-audience
distribution only, since its updater verifies no signature (it checks HTTPS, the
manifest’s identity, and an optional digest).
Wails and Neutralino are not covered.

**For a macOS-only app, consider a hand-written AppKit plus `WKWebView` shell**
(`tbd guidelines macos-webview-shell-patterns`). It suits the case where Electron’s
cross-platform argument does not apply, such as a local web server that only needs a
window, menus, and lifecycle on the Mac.
The shell is a few megabytes instead of about 300, needs no `allow-jit` entitlement
because page JavaScript runs in WebKit’s own WebContent process, and gets WebKit
security fixes from macOS updates rather than from your release train.
The trade-off is the engine: users get the system WebKit, which varies with their macOS
version and cannot be pinned, with no Chromium parity—behavior, performance budgets, and
automation measured in Chrome must be re-verified in Safari—and Web Inspector attaches
from Safari rather than living in the window.

* * *

## Best Practices

**Architecture**

- [ ] Renderer is an ordinary web app with no Node access.
- [ ] Preload exposes named capabilities, never a generic `invoke`.
- [ ] IPC types live in a type-only shared module used by both sides.
- [ ] Every `ipcMain` handler validates its sender and its payload.
- [ ] Long-running or CPU-bound work is in a `utilityProcess` or a sidecar, not in main.
- [ ] Backend processes are spawned from main, supervised, and killed on quit.
- [ ] Each backend shuts down on stdin EOF, as on `SIGTERM`, so it never outlives a
  crashed shell.

**Security**

- [ ] `sandbox`, `contextIsolation`, and `nodeIntegration` left at their defaults.
- [ ] CSP set via response header, with no `unsafe-inline` or `unsafe-eval`.
- [ ] `setWindowOpenHandler` denies by default.
- [ ] `will-navigate` blocks navigation outside the URLs the app itself loads.
- [ ] Permission request and check handlers deny by default.
- [ ] `shell.openExternal` allowlists the scheme.
- [ ] A loopback server binds `127.0.0.1` on port 0, validates `Host`, and requires a
  per-launch token delivered on stdin and carried as an `HttpOnly`, `SameSite=Strict`
  cookie.
- [ ] Fuses flipped: `runAsNode`, `nodeCliInspect`, `nodeOptions`, and
  `grantFileProtocolExtraPrivileges` disabled; ASAR integrity and `onlyLoadAppFromAsar`
  enabled.
- [ ] Electron version inside the three-major support window.

**Build and release**

- [ ] Main, preload, and renderer have separate build configs.
- [ ] Preload emits a single CJS file.
- [ ] macOS: hardened runtime; explicit `entitlements` and `entitlementsInherit` files
  granting `allow-jit` only unless a specific failure requires more; every nested Mach-O
  signed by the packager; notarized and stapled.
- [ ] macOS: no `LSFileQuarantineEnabled`, and no runtime writes into the bundle.
- [ ] Windows: cloud-based signing; no expectation of instant SmartScreen bypass.
- [ ] Sidecars get `+x` in `afterPack`, before signing, and their path resolves through
  `process.resourcesPath` when packaged.
- [ ] macOS artifacts are per architecture unless a universal build is worth about 1.6x
  the runtime size.
- [ ] Auto-update configured, and the app is signed so updates can apply.
- [ ] Playwright test launches the packaged app and exercises at least one IPC round
  trip.

* * *

## Open Research Questions

1. **Will electron-builder 27 ship, and on what timeline?** It has been in alpha since
   June 2026 (27.0.0-alpha.14 on 2026-10-29). Its signed update manifests,
   `allow-jit`-only default entitlements, and current `@electron/osx-sign` and
   `@electron/notarize` are worth adopting, but not before it is stable.

2. **Does the notary service accept data archives that contain ad-hoc-signed Mach-O
   files?** Shipping a python-build-standalone archive or a wheelhouse as data enables
   an offline first run without signing a Python tree.
   Apple says the notary service processes nested containers; JupyterLab Desktop signs
   the binaries inside its tarball before notarizing, which suggests the question is
   real. Untested here.

3. **How large are macOS delta updates in practice?** A Sparkle binary delta or an
   electron-updater blockmap should keep a code-only update small; an Electron patch
   bump rewrites the framework binary.
   Neither has been measured here.

Answered in the text: the Bun `--compile` signing defect is fixed in Bun 1.4.1
([Bun Backends](#bun-backends)), and Forge 8 is stable but does not close the
differential-update and Linux gap with electron-builder
([Choosing a Packager](#choosing-a-packager)).

* * *

## Recommendations

### Default Stack

For a new standalone desktop app with a TypeScript UI and a Node backend:

```
Electron 45 + Node 24 or 26 (host toolchain) + pnpm 12
├── electron-vite 6        # three-target build, HMR, hot restart
├── Vite 8 (Rolldown)      # renderer
├── TypeScript             # project references, three tsconfigs
├── utilityProcess         # backend
├── electron-builder       # packaging, signing, differential updates
├── electron-updater       # auto-update on all three platforms
├── @electron/fuses        # hardening at package time
├── Playwright             # end-to-end against the built app
└── node:sqlite            # persistence, when its API suffices
```

On the package manager: npm works with zero Electron-specific configuration and is an
equally sound choice.
pnpm appears here because it matches the companion monorepo guidelines; its
`nodeLinker: hoisted` requirement is the one non-obvious step, covered in
[§6](#6-package-managers-and-the-electron-toolchain).

### Minimal Stack

When the app is genuinely small and you want the fewest moving parts: Electron plus
esbuild for main and preload, Vite for the renderer, and `@electron/packager` behind a
short script. Accept that you own the dev loop.

### Local Web Server Shell

When the product is already a local server with a browser UI: Electron plus
electron-builder, one plain `main.js` with no build step, the built-in `autoUpdater`
with a static `RELEASES.json`, and the backend contract in
[The Thinnest Shape](#the-thinnest-shape).
For a macOS-only product, compare it against an AppKit plus `WKWebView` shell
(`tbd guidelines macos-webview-shell-patterns`) before committing to 300 MB of runtime.

### Polyglot Backend Stack

When the backend is Python or another language, keep everything above and add: a signed
`uv` in the bundle that installs Python and a hash-pinned environment into app data
(`tbd guidelines desktop-python-runtime-patterns`), or a compiled Go or Rust binary;
stdio JSON-RPC as the transport, or loopback HTTP with the token and cookie rules above;
`extraFiles` to `Contents/Helpers` for executables and `extraResources` for data;
explicit entitlements files; and explicit lifecycle supervision, with a stdin lifeline
on macOS and a Job Object on Windows.
Ship separate arm64 and x64 macOS artifacts.

### What to Avoid

- Driving the Electron **build** through Bun.
  Install with it if you like; package with Node.
- Binding a loopback HTTP port when stdio would work.
- Adding entitlements speculatively, or shipping electron-builder 26’s default ones.
- Signing a Python interpreter into the bundle with `disable-library-validation` when an
  interpreter in app data would do.
- Setting `LSFileQuarantineEnabled`, or writing into the signed bundle at runtime.
- Passing a session token in argv or the environment.
- Starting a Python sidecar on PyOxidizer.
- Relying on an Electron major outside the three-version support window.

* * *

## References

### Official Documentation

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron ESM Support](https://www.electronjs.org/docs/latest/tutorial/esm)
- [utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [Electron Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [ASAR Integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)
- [Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Updating Applications](https://www.electronjs.org/docs/latest/tutorial/updates)
- [autoUpdater API (v45.2.3)](https://github.com/electron/electron/blob/v45.2.3/docs/api/auto-updater.md)
- [BaseWindow options, including `windowStatePersistence`](https://github.com/electron/electron/blob/v45.2.3/docs/api/structures/base-window-options.md)
- [Breaking Changes](https://www.electronjs.org/docs/latest/breaking-changes)
- [Electron release schedule](https://releases.electronjs.org/schedule)
- [Electron Release Timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
- [Electron security advisories](https://github.com/electron/electron/security/advisories)
- [Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)

### Build and Packaging Tools

- [electron-vite](https://electron-vite.org/)
- [vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron)
- [Electron Forge](https://www.electronforge.io/)
- [Electron Forge 8 release notes](https://github.com/electron/forge/releases/tag/v8.0.1)
- [electron-builder](https://www.electron.build/)
- [electron-builder: what’s new in v27](https://www.electron.build/docs/migration/whats-new-v27/)
- [electron-builder v27 migration](https://www.electron.build/docs/migration/v27-breaking-changes/)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Playwright Electron support](https://playwright.dev/docs/api/class-electron)

### Signing, Notarization, and Distribution

- [Apple TN2206: macOS Code Signing In Depth](https://developer.apple.com/library/archive/technotes/tn2206/_index.html)
- [Apple: Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- [Apple: `disable-library-validation` entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation)
- [Apple: `LSFileQuarantineEnabled`](https://developer.apple.com/documentation/bundleresources/information-property-list/lsfilequarantineenabled)
- [Apple: Gatekeeper changes in macOS Sequoia (2024-08-06)](https://developer.apple.com/news/?id=saqachfa)
- [Quinn (Apple DTS): On File System Permissions](https://developer.apple.com/forums/thread/678819)
- [@electron/osx-sign](https://github.com/electron/osx-sign)
- [Squirrel.Mac](https://github.com/Squirrel/Squirrel.Mac)
- [Electron Forge macOS signing guide](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [Microsoft: code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Mac App Store submission guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [update.electronjs.org](https://github.com/electron/update.electronjs.org)
- [Homebrew 5.0.0](https://brew.sh/2025/11/12/homebrew-5.0.0/)
- [GitHub Actions runner images](https://github.com/actions/runner-images)

### Backend Runtimes

- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
- [Node.js `node:sqlite`](https://nodejs.org/api/sqlite.html)
- [Bun standalone executables](https://bun.com/docs/bundler/executables)
- [python-build-standalone](https://github.com/astral-sh/python-build-standalone)
- [uv](https://docs.astral.sh/uv/)
- [uv 0.12.x changelog (Developer ID signing from 0.12.12)](https://github.com/astral-sh/uv/blob/main/changelogs/0.12.x.md)
- [PyInstaller](https://pyinstaller.org/en/stable/)
- [Nuitka](https://nuitka.net/)

### Security Background

- [GitHub: localhost dangers, CORS and DNS rebinding](https://github.blog/security/application-security/localhost-dangers-cors-and-dns-rebinding/)
- [HTML spec: the `EventSource` interface](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)
- [Chromium `site_for_cookies.cc`](https://github.com/chromium/chromium/blob/main/net/cookies/site_for_cookies.cc)

### Production Apps Surveyed

Read directly from their build configuration for
[§8](#8-what-shipping-apps-actually-do).

- [microsoft/vscode](https://github.com/microsoft/vscode)—typed IPC channels in
  [`src/vs/base/parts/ipc/`](https://github.com/microsoft/vscode/tree/main/src/vs/base/parts/ipc),
  `utilityProcess` wrapper in
  [`src/vs/platform/utilityProcess/electron-main/utilityProcess.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/platform/utilityProcess/electron-main/utilityProcess.ts)
- [signalapp/Signal-Desktop](https://github.com/signalapp/Signal-Desktop)—multi-target
  build in
  [`rolldown.config.ts`](https://github.com/signalapp/Signal-Desktop/blob/main/rolldown.config.ts)
- [bitwarden/clients](https://github.com/bitwarden/clients)—fuse configuration in
  [`apps/desktop/scripts/after-pack.js`](https://github.com/bitwarden/clients/blob/main/apps/desktop/scripts/after-pack.js),
  preload in
  [`apps/desktop/src/preload.ts`](https://github.com/bitwarden/clients/blob/main/apps/desktop/src/preload.ts)
- [element-hq/element-desktop](https://github.com/element-hq/element-desktop)—fuses via
  `electronFuses` in
  [`electron-builder.ts`](https://github.com/element-hq/element-desktop/blob/develop/electron-builder.ts)
- [laurent22/joplin](https://github.com/laurent22/joplin),
  [mattermost/desktop](https://github.com/mattermost/desktop),
  [logseq/logseq](https://github.com/logseq/logseq)
- [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate)
  and
  [electron-vite/electron-vite-react](https://github.com/electron-vite/electron-vite-react)—starter
  templates
- Python-backed apps, read from source on 2026-11-08:
  [Comfy-Org/Comfy-Desktop](https://github.com/Comfy-Org/Comfy-Desktop),
  [open-webui/desktop](https://github.com/open-webui/desktop),
  [jupyterlab/jupyterlab-desktop](https://github.com/jupyterlab/jupyterlab-desktop),
  [posit-dev/positron](https://github.com/posit-dev/positron)

### Issue Reports Cited

- [bun#9895: electron-builder `rebuild` script not found](https://github.com/oven-sh/bun/issues/9895)—open
- [bun#18249: segfault during electron-builder build](https://github.com/oven-sh/bun/issues/18249)—closed
- [bun#1588: Electron failed to install correctly](https://github.com/oven-sh/bun/issues/1588)—closed
- [bun#32159: `--compile` binaries fail signature validation on macOS 27](https://github.com/oven-sh/bun/issues/32159)—closed
  by [#39837](https://github.com/oven-sh/bun/pull/39837), first released in Bun 1.4.1
- [forge#3906: use Bun when `bunx` is used](https://github.com/electron/forge/issues/3906)—open
- [electron-builder#1790: executable permissions lost in packaging](https://github.com/electron-userland/electron-builder/issues/1790)
- [pnpm#11056: quarantine propagated to native `.node` files](https://github.com/pnpm/pnpm/issues/11056)—closed
- [Comfy-Org/desktop#1722: the user’s global uv `exclude-newer` breaks installs](https://github.com/Comfy-Org/desktop/issues/1722)—open

* * *

## Appendices

### Appendix A: electron.vite.config.ts

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve(__dirname, 'src/main/index.ts'), formats: ['cjs'] },
      sourcemap: true,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Sandboxed preloads cannot be ESM and cannot be code-split. One CJS file.
      lib: { entry: resolve(__dirname, 'src/preload/index.ts'), formats: ['cjs'] },
      sourcemap: true,
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') },
    },
    plugins: [react()],
    build: {
      rolldownOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
});
```

Notes on why this is short:

- electron-vite already externalizes `electron` and every Node built-in, so you do not
  list them. `externalizeDepsPlugin()` additionally keeps everything in `dependencies`
  out of the main and preload bundles, which is what you want for native modules.
  Anything that should be bundled belongs in `devDependencies`.
- `build.lib.formats: ['cjs']` is the supported way to pin the output format; the
  default is CJS or ESM depending on your `package.json` `type`, and being explicit
  avoids a surprise if that changes.
- On Vite 8 the option is `rolldownOptions`; `rollupOptions` still works as a deprecated
  alias. electron-vite 6 accepts both, so use `rollupOptions` only if you must also build
  with Vite 7.
- Leave `package.json` without `"type": "module"`. The built main and preload are CJS
  (emitted as `out/main/index.js` and `out/preload/index.js`), and a `"type": "module"`
  declaration would make Node treat those `.js` files as ESM.

### Appendix B: electron-builder.yml

```yaml
appId: com.example.myapp
productName: My App
directories:
  output: release
  buildResources: build

files:
  - out/**/*
  - package.json

# Sidecars cannot execute from inside the ASAR archive.
extraResources:
  - from: resources/bin/${os}/${arch}
    to: bin
    filter: ['**/*']

asar: true
asarUnpack:
  - '**/*.node' # native modules must be real files on disk

# Flipped by electron-builder itself, so a failing hook cannot skip it.
electronFuses:
  runAsNode: false
  enableNodeOptionsEnvironmentVariable: false
  enableNodeCliInspectArguments: false
  grantFileProtocolExtraPrivileges: false # only with a custom protocol instead of file://
  enableEmbeddedAsarIntegrityValidation: true
  onlyLoadAppFromAsar: true

mac:
  category: public.app-category.productivity
  minimumSystemVersion: '13.0' # Electron 44+ does not run on macOS 12
  hardenedRuntime: true
  gatekeeperAssess: false
  # Always set both: without them, v26 signs the app and every nested binary with a
  # template that also grants allow-unsigned-executable-memory and
  # disable-library-validation.
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  signIgnore: ['\.pyc$', '\.whl$', '\.tar\.gz$'] # binary data that is not code
  notarize: true # needs APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER
  target:
    - target: dmg
      arch: [x64, arm64]
    - target: zip # required for Squirrel.Mac auto-update
      arch: [x64, arm64]

win:
  target:
    - target: nsis
      arch: [x64, arm64]
  # Windows cannot sign from a .pfx file since June 2023; use a cloud signing service.

linux:
  category: Utility
  target:
    - target: deb
      arch: [x64, arm64]
    - target: flatpak
      arch: [x64]

publish:
  provider: github

afterPack: ./scripts/after-pack.js # restore +x on sidecars; osx-sign does the signing
```

Matching `entitlements.mac.plist`, which must be ASCII with no byte-order mark:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
</dict>
</plist>
```

Add `allow-unsigned-executable-memory` or `disable-library-validation` only when a
specific, reproduced failure requires it, and then prefer giving that one binary its own
entitlements through a custom `mac.sign` function over widening `entitlementsInherit`
for every helper. A file in `Contents/MacOS` that is not an executable slows
notarization, so keep data out of it.

### Appendix C: Main Process Entry Point

```ts
import { app, BrowserWindow, session, shell, ipcMain } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The URL prefix the renderer legitimately lives under: the dev server in
// development, the packaged renderer directory in production. With loadFile
// the page's origin is the opaque 'null', so trust is a URL prefix, not an
// origin. (A custom app:// protocol would give you a real origin instead.)
const trustedRendererBase =
  process.env.ELECTRON_RENDERER_URL ??
  pathToFileURL(path.join(__dirname, '../renderer/')).href;

function applySecurityPolicy(ses: Electron.Session): void {
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self'; " +
            "img-src 'self' data:; connect-src 'self'; object-src 'none'; " +
            "base-uri 'none'; frame-ancestors 'none'",
        ],
      },
    });
  });

  // Deny every permission that has not been deliberately enabled, for both
  // asynchronous requests and synchronous checks.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      // These three are already the defaults. They are written out because a reviewer
      // should see an explicit, deliberate value here rather than an absence.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Never let the app navigate outside the URLs it loads itself.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(trustedRendererBase)) event.preventDefault();
  });

  // Open external links in the real browser; never in an app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    const { protocol } = new URL(url);
    if (protocol === 'https:') void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return win;
}

app.whenReady().then(() => {
  applySecurityPolicy(session.defaultSession);
  registerIpcHandlers(ipcMain);
  startBackend(); // utilityProcess or sidecar; see Appendix E
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend(); // never leave an orphan
});
```

### Appendix D: Preload and Typed IPC

```ts
// src/shared/contract.ts — types only. Imported by main and renderer.
export const Channels = {
  openProject: 'project:open',
  saveNote: 'note:save',
  progress: 'backend:progress',
} as const;

export type Api = {
  openProject: (id: string) => Promise<Project>;
  saveNote: (note: NoteInput) => Promise<void>;
  onProgress: (cb: (p: Progress) => void) => () => void;
};
```

```ts
// src/preload/index.ts — compiled to a single CJS file.
import { contextBridge, ipcRenderer } from 'electron';
import { Channels, type Api, type Progress } from '../shared/contract';

const api: Api = {
  // One named method per capability. No generic channel pass-through.
  openProject: (id) => ipcRenderer.invoke(Channels.openProject, id),
  saveNote: (note) => ipcRenderer.invoke(Channels.saveNote, note),

  onProgress: (cb) => {
    const listener = (_e: unknown, p: Progress) => cb(p);
    ipcRenderer.on(Channels.progress, listener);
    return () => ipcRenderer.off(Channels.progress, listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
```

```ts
// src/renderer/env.d.ts — makes window.api typed in the renderer.
import type { Api } from '../shared/contract';
declare global {
  interface Window {
    api: Api;
  }
}
```

```ts
// src/main/ipc.ts — validate the sender and the payload, every time.
import { z } from 'zod';
import { Channels } from '../shared/contract';

const ProjectId = z.string().uuid();

export function registerIpcHandlers(ipcMain: Electron.IpcMain): void {
  ipcMain.handle(Channels.openProject, async (event, raw) => {
    assertTrustedSender(event); // checklist item 17
    const id = ProjectId.parse(raw); // reject anything unexpected
    return openProject(id);
  });
}

// Same trustedRendererBase as the entry point (Appendix C): dev server URL in
// development, the packaged renderer's file:// base in production.
function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? '';
  if (!url.startsWith(trustedRendererBase)) throw new Error('untrusted IPC sender');
}
```

### Appendix E: Python Sidecar End to End

This appendix covers the parts of a Python backend that are specific to Electron: where
`uv` and the lock go in the bundle, how the main process finds them, what to sign and
ignore, and how to supervise the backend.
Everything uv does—isolation flags, the spawn environment, serialized calls, the
release-time lock, and hash-verified installs—is owned by
`tbd guidelines desktop-python-runtime-patterns`:
[3. Isolating an App-Owned uv](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/desktop-python-runtime-patterns.md#3-isolating-an-app-owned-uv)
and
[4. Pinning Exactly What Was Tested](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/desktop-python-runtime-patterns.md#4-pinning-exactly-what-was-tested).
Call its uv commands from one function in the main process, never from the renderer.

**1. Bundle `uv` and the lock.** Put the executable in `Contents/Helpers` with
`extraFiles` and the data in `Contents/Resources` with `extraResources`, and restore
`+x` on `uv` in `afterPack`, before signing (a translocated bundle is read-only at
runtime):

```yaml
extraFiles:
  - from: vendor/uv/${arch}/uv # >= 0.12.12 is Developer ID-signed upstream; re-signed with yours
    to: Helpers/uv # Contents/Helpers, an Apple code location
extraResources:
  - from: build/py # the app's uv.toml and the release-time lock: data, covered by the seal
    to: py
```

**2. Resolve the paths in the main process:**

```ts
const data = app.getPath('userData'); // ~/Library/Application Support/<App>
const uv = app.isPackaged
  ? path.join(process.resourcesPath, '..', 'Helpers', 'uv')
  : path.join(__dirname, '../../vendor/uv', process.arch, 'uv');
const py = path.join(process.resourcesPath, 'py'); // uv.toml and the lock
const env = path.join(data, 'env'); // the symlink the Python guideline's lifecycle swaps
```

Build the environment with the Python guideline’s reference implementation, under
`data`, before starting the backend, and show progress in the app’s own window.

**3. Speak newline-delimited JSON over stdio**—no port, no auth, and the read loop ends
at EOF, so the backend exits when the shell does, however it dies:

```python
# myapp/backend.py
import json, sys

for line in sys.stdin:
    req = json.loads(line)
    result = handle(req)
    sys.stdout.write(json.dumps({"id": req["id"], "result": result}) + "\n")
    sys.stdout.flush()   # without this, the parent waits forever
```

A backend that serves the UI over loopback HTTP uses the shell–server contract instead
([The Thinnest Shape](#the-thinnest-shape)).

**4. Supervise it from the main process:**

```ts
import { spawn, type ChildProcess } from 'node:child_process';

let backend: ChildProcess | undefined;

export function startBackend(): void {
  const python =
    process.platform === 'win32'
      ? path.join(env, 'Scripts', 'python.exe')
      : path.join(env, 'bin', 'python');

  backend = spawn(python, ['-m', 'myapp.backend'], {
    cwd: data,
    env: backendEnv(), // an allowlist, per the Python guideline's spawn environment
    stdio: ['pipe', 'pipe', 'pipe'], // stdin is both the request channel and the lifeline
    detached: process.platform !== 'win32', // own process group, so we can kill the tree
  });
  backend.on('exit', (code) => scheduleRestartWithBackoff(code));
}

export function stopBackend(): void {
  if (!backend?.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(backend.pid), '/f', '/t']);
  } else {
    process.kill(-backend.pid, 'SIGTERM'); // negative pid signals the group
  }
  backend = undefined;
}
```

On Windows, prefer a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` over
`taskkill` if you can add a native dependency: it is the only approach that also cleans
up when the main process crashes.

**5. Sign, ignore, and verify.** The only Mach-O this layout adds is `uv`, which
`@electron/osx-sign` signs along with everything else under `Contents/`; it needs no
entitlements, and the app keeps `allow-jit` as its only one.
The interpreter in app data is ad-hoc signed, not hardened, and not quarantined, so it
needs nothing from you.
Use `mac.signIgnore` for binary data that is not code—a bundled Python archive or
wheelhouse, and `.pyc` files if you bundle a tree—and verify after the build:

```bash
APP="release/mac-arm64/My App.app"
codesign --verify --deep --strict --verbose=2 "$APP"
codesign -dvv "$APP/Contents/Helpers/uv" 2>&1 | grep Authority   # your Developer ID
xcrun stapler validate "$APP"
spctl -a -vvv -t exec "$APP"
```

If you bundle a python-build-standalone tree instead, the Python guideline’s layout B
covers installing into it; on the Electron side, keep the interpreter from writing
bytecode into the bundle and grant it `disable-library-validation` only if it must load
packages installed after signing, through a custom `mac.sign` function rather than
`entitlementsInherit`.

### Appendix F: GitHub Actions Release Workflow

```yaml
name: Release
on:
  push:
    tags: ['v*']

permissions:
  contents: write # electron-builder uploads to the GitHub release

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest # macOS 26, arm64
          - os: windows-latest
          - os: ubuntu-latest
    runs-on: ${{ matrix.os }}
    env:
      # Pin the Electron download cache to one path so the cache step below is
      # correct on all three runners (the OS-default location differs per OS).
      ELECTRON_CACHE: ${{ github.workspace }}/.cache/electron
    steps:
      # Actions pinned by commit SHA (a tag is mutable); the comment names the release.
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
          cache: pnpm

      # The Electron binary download is the largest cost in a cold build.
      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: ${{ github.workspace }}/.cache/electron
          key: electron-${{ matrix.os }}-${{ hashFiles('pnpm-lock.yaml') }}

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      # electron-builder's notarization wants APPLE_API_KEY as a file path.
      - name: Write Apple API key
        if: runner.os == 'macOS'
        run: printf '%s' "$APPLE_API_KEY_P8" > "$RUNNER_TEMP/apple_api_key.p8"
        env:
          APPLE_API_KEY_P8: ${{ secrets.APPLE_API_KEY_P8 }}

      - name: Build and publish
        run: pnpm exec electron-builder --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS: signing certificate plus notarization credentials.
          CSC_LINK: ${{ secrets.MAC_CERT_P12 }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERT_PASSWORD }}
          APPLE_API_KEY: ${{ runner.temp }}/apple_api_key.p8
          APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
          # Windows: cloud signing (Azure Artifact Signing); key material cannot
          # live in a file. Also requires win.azureSignOptions in electron-builder.yml.
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}

      - name: Verify the macOS signature and ticket
        if: runner.os == 'macOS'
        run: |
          for app in release/mac*/*.app; do
            codesign --verify --deep --strict --verbose=2 "$app"
            xcrun stapler validate "$app"
            spctl -a -vvv -t exec "$app"
          done
```

Environment variables that do not apply to a given OS are ignored, so one shared step
works across the matrix.
electron-builder 26 needs `APPLE_API_KEY` as a path to the `.p8` file, hence the step
that writes it; v27 also accepts the key’s base64 contents.

Notarize on tags only.
Pull request builds should package without signing, which is fast and needs no secrets.
Let an update bot propose SHA bumps for the actions, so pinning does not mean freezing
(`tbd guidelines ci-and-gates-rules`).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
