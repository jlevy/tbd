---
title: Electron App Development Patterns
description: Building a clean, minimal, standalone Electron app—process model, modern Vite-based build system, attaching a Node/Bun/Python backend, security baseline, packaging, code signing, and auto-update
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: desktop
---
# Electron App Development Patterns

**Last Updated**: 2026-08-16

**Related**:

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [electron-vite](https://electron-vite.org/)
- [electron-builder](https://www.electron.build/)
- [Electron Forge](https://www.electronforge.io/)
- [Companion: pnpm Monorepo Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md)
- [Companion: Supply-Chain Hardening](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)

* * *

## Updating This Document

Electron ships a major version every 8 weeks and supports only the latest three, so this
document goes stale faster than most.
Recheck it at least every two majors.

### Last Researched Versions

Versions observed 2026-08-16 by querying the npm registry and official release pages
directly. Where the newest release is younger than 14 days, the older aged version is
given as the pin, per [Supply-Chain Mitigation](#supply-chain-mitigation).

| Tool / Package | Version | Check For Updates |
| --- | --- | --- |
| **Electron** | ^43.2.0 (43.3.0/43.4.0 too recent) | [releases.electronjs.org](https://releases.electronjs.org/)—**43.4.0** (2026-08-11) is current stable: Chromium 150, Node 24.18.1, V8 15.0. Supported majors are **41, 42, 43**; **41 reaches EOL 2026-08-25**, so 42 is the practical floor. 44 is in beta and **drops macOS 12, 32-bit Windows (ia32), and linux-armv7l**. Security fixes ship on the supported line only—track the latest patch, not just the major. |
| **Node.js (host toolchain)** | 24 (LTS “Krypton”) | [nodejs.org/releases](https://nodejs.org/en/about/previous-releases)—Node 24 Active LTS (EOL Apr 2028; moves to maintenance when Node 26 enters LTS in Oct 2026); Node 26 Current; Node 22 in maintenance; **Node 20 EOL 2026-03-24**. Note the Node version *inside* Electron is set by Electron, not by your host Node. |
| **electron-vite** | ^5.0.0 | [electron-vite.org](https://electron-vite.org/)—5.0.0 (2025-12-07). Supports Vite 7 and 8. Added `build.isolatedEntries` for multi-entry isolation and stronger bytecode string protection. 6.0.0-beta.1 exists; not stable. |
| **vite-plugin-electron** | ^1.1.0 (1.1.1 too recent) | [github.com/electron-vite/vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron)—**Pinned to 1.1.0 (2026-06-24) per the 14-day rule**; 1.1.1 (2026-08-03) is 12 days old today. Same org as electron-vite, currently the more frequently released of the two. Auto-selects `rolldownOptions` on Vite 8+ and `rollupOptions` below. Use when you want a plugin inside a standard Vite project rather than a separate CLI. |
| **Vite** | ^8.2.0 (8.2.1 too recent) | [vite.dev](https://vite.dev/blog/announcing-vite8)—Vite 8 (2026-03-12) ships **Rolldown as its sole bundler**, replacing the esbuild-for-dev / Rollup-for-prod split. Requires Node 20.19+ or 22.12+. |
| **Rolldown** | ^1.2.1 (1.2.2+ too recent) | [rolldown.rs](https://rolldown.rs/)—1.0 stable May 2026; 1.2.4 (2026-08-12) newest. Adopted Rollup’s plugin API, so most Vite plugins work unmodified. Maintained by VoidZero, **acquired by Cloudflare 2026-06-04**; tools remain MIT. |
| **esbuild** | ^0.28.1 (0.28.2 too recent) | [github.com/evanw/esbuild/releases](https://github.com/evanw/esbuild/releases)—still pre-1.0. No longer inside Vite’s production path, but still the simplest standalone choice for bundling a main process without adopting a framework. |
| **electron-builder** | ^26.15.7 | [electron.build](https://www.electron.build/)—**The `latest` dist-tag points at 26.15.3 (2026-06-09) while 26.15.7 (2026-07-18) is the newest v26**, published under a separate `v26` tag; a bare `npm i electron-builder` therefore pins lower than you may expect. 27.0.0-alpha.6 is in progress: native ESM, Node 22.12+, signing consolidated under `mac.sign`/`win.sign`, APFS DMGs, MSIX target, Azure Artifact Signing via `signtool /dlib`, and an `electron-builder migrate-schema` CLI. |
| **electron-updater** | ^6.8.9 | [npmjs.com/package/electron-updater](https://www.npmjs.com/package/electron-updater)—6.8.9 (2026-06-05). 7.0.0-alpha.5 tracks electron-builder 27. |
| **Electron Forge** | ^7.11.2 | [electronforge.io](https://www.electronforge.io/)—7.11.2 (2026-05-20). 8.0.0-alpha.10 targets Node 22.12+, ESM-only, and Vite 8. The Vite plugin is still marked experimental. Supports npm, Yarn Classic, and pnpm (since 7.7.0, requires hoisted `node_modules`); **Bun is not supported** ([forge#3906](https://github.com/electron/forge/issues/3906)). |
| **@electron/packager** | ^20.0.4 (20.1.0+ too recent) | [npmjs.com/package/@electron/packager](https://www.npmjs.com/package/@electron/packager)—20.3.0 (2026-08-11) newest. The low-level bundler that Forge wraps; use directly only for a custom pipeline. |
| **@electron/rebuild** | ^4.2.0 | [github.com/electron/rebuild](https://github.com/electron/rebuild)—4.2.0 (2026-07-07). Requires Node ≥22.12.0. |
| **@electron/notarize** | ^3.1.1 | [github.com/electron/notarize](https://github.com/electron/notarize)—3.1.1 (2025-10-31). Wraps `xcrun notarytool`. |
| **@electron/osx-sign** | ^2.6.0 | [github.com/electron/osx-sign](https://github.com/electron/osx-sign)—2.6.0 (2026-07-17). |
| **@electron/fuses** | ^2.1.3 | [github.com/electron/fuses](https://github.com/electron/fuses)—2.1.3 (2026-06-29). |
| **@electron/asar** | ^4.2.1 | [github.com/electron/asar](https://github.com/electron/asar)—4.2.1 (2026-07-21). ASAR integrity needs ≥3.1.0; the macOS integrity digest added in Electron 41 needs ≥4.1.0. |
| **@electron/universal** | ^3.0.6 | [github.com/electron/universal](https://github.com/electron/universal)—3.0.6 (2026-07-02). Merges x64 and arm64 macOS builds. |
| **update-electron-app** | ^3.3.0 | [github.com/electron/update-electron-app](https://github.com/electron/update-electron-app)—3.3.0 (2026-06-28). |
| **Playwright** | ^1.62.1 | [playwright.dev](https://playwright.dev/docs/api/class-electron)—1.62.1 (2026-07-30). `_electron` is still an experimental namespace but is the standard way to drive a packaged app in tests. |
| **better-sqlite3** | ^13.0.2 (13.0.3 too recent) | [npmjs.com/package/better-sqlite3](https://www.npmjs.com/package/better-sqlite3)—13.0.3 (2026-08-05) newest. Needs `@electron/rebuild`. Consider `node:sqlite` first (see [Native Modules](#native-modules)). |
| **pnpm** | ^11.19.0 (11.20+ too recent) | [github.com/pnpm/pnpm/releases](https://github.com/pnpm/pnpm/releases)—**Pinned to 11.19.0 (2026-07-31) per the 14-day rule**; 11.20.0 through 11.22.0 are all under 14 days old today. pnpm 11 moved `nodeLinker` and `shamefullyHoist` out of `.npmrc` into `pnpm-workspace.yaml`, replaced `onlyBuiltDependencies` with `allowBuilds`, and made `strictDepBuilds` default to `true`. |
| **npm** | ^12.0.2 | [npmjs.com/package/npm](https://www.npmjs.com/package/npm)—npm 12 (2026-07-08) **disables dependency install scripts by default** (`allowScripts`); approve with `npm approve-scripts`. |
| **Bun** | ^1.3.14 | [bun.com/blog](https://bun.com/blog)—1.3.14 (2026-05-13). Fine as a package manager and as a sidecar runtime; **not** a supported driver for Forge, and still unreliable through electron-builder’s script hooks. |

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

6. **Update code examples**, not just the table—versions appear in `package.json`
   examples, the GitHub Actions workflow in Appendix F, and `electron-builder.yml`.

7. **Honor the 14-day package-age rule** when bumping versions here, with the documented
   exception for security fixes.
   Electron itself frequently qualifies for that exception.

8. **Review [Open Research Questions](#open-research-questions)** for anything now
   settled.

* * *

## Executive Summary

This document is a reference for building a **clean, minimal, standalone Electron
desktop app** with a modern build system and a backend written in whatever language
suits the problem—Node.js, Bun, Python, Go, or a combination.

The recommended default: **Electron 43 + electron-vite + TypeScript +
electron-builder**, with the renderer as an ordinary Vite web app, the main process as a
thin bundled CommonJS entry point, a CommonJS preload exposing a narrow typed API over
`contextBridge`, and any substantial backend work pushed into a **`utilityProcess`**
(for Node) or a **signed sidecar executable** (for anything else).

Three claims in this document are worth stating up front because they contradict advice
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
  This lands at the same time as npm 12, pnpm 11, and Bun all blocking dependency
  lifecycle scripts by default, and it resolves that collision for current Electron.

**Research questions this document answers**:

1. What is the minimum coherent structure of a standalone Electron app in 2026, and what
   builds what?

2. Where should backend code live, and how do you ship a non-JavaScript runtime inside a
   signed desktop app?

3. What is the current security baseline beyond the three `webPreferences` flags
   everyone quotes?

4. What does it actually take to get a signed, notarized, auto-updating app onto three
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
sandboxed process with no direct Node access, and the preload gets a polyfilled subset
rather than full Node.

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
- **There is an open signing defect.** As of August 2026,
  [bun#32159](https://github.com/oven-sh/bun/issues/32159) reports that binaries
  compiled with Bun 1.3.13+ have invalid signatures on macOS 27, causing the process to
  be killed on launch; macOS 26 tolerated the same signature.
  A fix is in progress.
  Verify against your minimum macOS target before shipping.

Bun is a reasonable sidecar runtime and a reasonable package manager.
It is not a good fit for driving the Electron *build*—see
[Package Managers](#6-package-managers-and-the-electron-toolchain).

### Python Backends

Shipping Python inside a desktop app has become substantially easier, and the current
best practice is not the one most tutorials describe.

| Approach | Status (Aug 2026) | Notes |
| --- | --- | --- |
| **python-build-standalone + uv** (recommended) | Actively maintained by Astral since Dec 2024; release tag 20260610 ships CPython 3.13.14 and 3.14.6 | Relocatable CPython builds—statically linked, with the build system patched to use relative paths. At build time, `uv pip sync` your lockfile **directly into the standalone tree** and ship that tree. Do not ship a venv: venv scripts and `pyvenv.cfg` hardcode build-machine paths, and the venv’s interpreter is a symlink back to wherever it was created. Most predictable and most debuggable. |
| **PyInstaller** | 6.22.1, actively maintained, Python 3.8–3.15 | Mature and widely used. Sizes run ~28MB for a Flask app to ~180MB with PyTorch; startup ~2–3s, and onefile mode adds unpacking time that is worst on Windows. |
| **Nuitka** | 4.x, actively maintained | Compiles to C. Faster execution, some IP protection. AGPLv3 with an exemption for compiled output; a commercial edition exists. Python 3.14 support is experimental. |
| **Briefcase** (BeeWare) | Actively maintained | Whole-app packager rather than a backend packager. Cannot cross-build; you build on each target platform. |
| **PyOxidizer** | **Dead** | Last meaningful commit Jan 2023; the author stated in Mar 2024 he is unlikely to return to it and asked for maintainers. None stepped forward. Do not start here. |

The python-build-standalone route is worth the extra assembly step because it keeps a
real Python tree in the bundle: you can read the traceback, you can `ls site-packages`,
and startup is a normal interpreter start rather than an unpack.
An end-to-end recipe is in [Appendix E](#appendix-e-python-sidecar-end-to-end).

Note the signing consequence: a Python tree contains many Mach-O objects (the
interpreter plus every compiled extension module’s `.so`). Every one of them must be
signed. See [Signing Nested Binaries](#signing-nested-binaries).

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
`asarUnpack`, `extraResources`, or `extraFiles`.

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
Fix it in an `afterPack` hook, and defensively `fs.chmodSync(bin, 0o755)` before
spawning on non-Windows.

### Signing Nested Binaries

This is where sidecar projects lose the most time, so be precise about the rules.

**Signing is not recursive.** Apple’s
[TN2206](https://developer.apple.com/library/archive/technotes/tn2206/_index.html) is
explicit that nested code must be signed from the inside out.
Every Mach-O object you add to the bundle—the sidecar, the Python interpreter, every
`.so` extension module, every bundled `.dylib`—must be signed individually **before**
the outer `.app` is signed.
Notarization rejects the bundle if any of them is unsigned.

**Placement follows Apple’s bundle layout.** `Contents/MacOS`, `Contents/Helpers`,
`Contents/Frameworks`, `Contents/PlugIns`, and `Contents/XPCServices` are the code
locations; TN2206 directs that scripts and other non-Mach-O executables belong in
`Contents/Resources`. Since `extraResources` writes to `Contents/Resources`, a Mach-O
sidecar placed there sits outside its canonical location.
Signed nested Mach-O binaries under `Resources` do ship successfully in practice, so
treat this as a risk to verify rather than a guaranteed rejection—but if you hit
notarization errors about nested code, relocating the binary to `Contents/Frameworks` or
`Contents/Helpers` in an `afterPack` hook is the standard fix.
See [Open Research Questions](#open-research-questions).

**Hardened runtime and entitlements.** Notarization requires signing with
`--options runtime`. Electron’s V8 needs, at minimum:

```xml
<key>com.apple.security.cs.allow-jit</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
```

Sidecars that load unsigned or third-party dylibs commonly also need
`com.apple.security.cs.disable-library-validation`, and Python trees typically need it.
Add entitlements because a specific failure requires them, not preemptively—each one
widens what an attacker who compromises your process can do.

**Order of operations**: `afterPack` signs nested binaries → the outer app is signed →
`afterSign` triggers notarization via `@electron/notarize` → staple the ticket.

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
Two 2026 examples:

- **CVE-2026-22812** (CVSS 8.8): a developer tool exposed an unauthenticated local HTTP
  server with permissive CORS; any website could create sessions and execute shell
  commands. The published analysis attributes it to assuming that localhost is inherently
  safe.
- **CVE-2025-66414** (CVSS 7.6): the MCP TypeScript SDK before 1.24.0 shipped without
  DNS rebinding protection by default.

If you must bind a port:

1. Bind `127.0.0.1` explicitly, never `0.0.0.0`.
2. Use an **ephemeral port** and a **secret token** minted at startup, passed to the
   backend out of band (argv or an environment variable) and required on every request.
3. **Validate the `Host` header** against an allowlist; this is what actually stops DNS
   rebinding.
4. Set a strict CORS origin allowlist.
   Never call a CORS middleware with no arguments.

Because a rebinding attack cannot carry the target’s cookies, real authentication on
every endpoint defeats it—which is why the token in step 2 is the highest-value
mitigation.

### Process Lifecycle

Orphaned backend processes are the most common bug in sidecar architectures, and they
are invisible in development because you kill the terminal.

- **Spawn from the main process, not the renderer.** Renderer-spawned children are not
  cleaned up when the app closes.
- **Kill explicitly on `before-quit`**, and treat a slow shutdown as a bug rather than
  waiting on it forever.
- **Let the child detect parent death**, because the parent will eventually crash
  without running your handler.
  On Linux, `prctl(PR_SET_PDEATHSIG)`. On macOS there is no equivalent: inherit a pipe
  and exit on EOF, or poll `getppid()` for 1. On Windows there are no POSIX signals at
  all.
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
**CVE-2026-70601**, patched 2026-08-05, is a context isolation bypass via a
`Function.prototype.bind` hijack—it defeats the boundary the rest of this section is
built on.
Because only three majors are supported at a time, staying inside the window is
a prerequisite for receiving fixes at all.

The full 20-item
[official checklist](https://www.electronjs.org/docs/latest/tutorial/security) is
versioned with the docs; read it rather than relying on this summary, which is
deliberately partial.

* * *

## 5. Packaging and Distribution

### Choosing a Packager

| Tool | Weekly downloads | Choose when |
| --- | --- | --- |
| **electron-builder** | ~3M | You want the most capable packager: more targets, differential updates, mature signing integration, Linux formats. **Default recommendation.** |
| **Electron Forge** | — | You want official Electron-team support and one tool for build/package/make/publish. |
| **@electron/packager** | ~570k | You are building a custom pipeline and want only the bundling step. Forge wraps this. |

There is a genuine tension here.
Electron Forge is the officially supported tool, lives under the `electron/` GitHub org,
and is what the Electron docs point you to.
electron-builder is a community project with an uneven release cadence—its `latest`
dist-tag currently lags its newest v26 release, and v27 has been in alpha for a while.

The recommendation still goes to electron-builder, for two reasons.
The capability gap is wide, particularly for Linux targets and differential updates.
And the adoption evidence is lopsided: of the production apps surveyed in
[§8](#8-what-shipping-apps-actually-do), every one whose packager could be confirmed
uses electron-builder except VS Code, and **none use Forge**. Choose Forge if official
support matters more to you than capability and you are willing to be an early adopter
of its Vite plugin; that is a defensible choice, not the common one.
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
| **electron-updater** (electron-builder) | macOS, Windows, **Linux** | Works against GitHub Releases, S3, or any static host. NSIS differential updates via `.blockmap` download only changed byte ranges. |
| **Electron `autoUpdater`** directly | macOS, Windows | The built-in module, backed by Squirrel.Mac and Squirrel.Windows. You supply the update feed. |

Electron update payloads are large because the runtime ships with the app, but
differential mechanisms reduce this substantially: Squirrel deltas on macOS and Windows,
and blockmap-based partial downloads for NSIS. Expect megabytes to tens of megabytes for
a typical update, not a full re-download.

**Code signing is a prerequisite for auto-update, not an optional extra.** Squirrel.Mac
refuses to apply an update that is not correctly signed.

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
  It reached release-candidate stability in Node and ships in the Node embedded in
  current Electron. Use `better-sqlite3` when you need its richer API—transactions
  wrapper, user-defined function options, BigInt control—and accept the rebuild step.
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
| **npm** | 12.0.2 | Full support. npm 12 disables install scripts by default (`allowScripts`); approve with `npm approve-scripts electron` if you are on Electron ≤41. |
| **pnpm** | 11.21.0 | Full support, with configuration. See below. |
| **Bun** | 1.3.14 | Fine for `bun install` (Electron is in Bun’s default trusted-dependency allowlist). **Not supported by Electron Forge** ([forge#3906](https://github.com/electron/forge/issues/3906), open). electron-builder’s script hooks remain unreliable under Bun ([bun#9895](https://github.com/oven-sh/bun/issues/9895), open since April 2024). |

**pnpm configuration.** pnpm 11 moved these settings out of `.npmrc`; they now live in
`pnpm-workspace.yaml`, and `.npmrc` is only read for auth and registry settings:

```yaml
# pnpm-workspace.yaml
nodeLinker: hoisted # electron-builder and Forge crawl node_modules and do not follow symlinks
allowBuilds:
  electron: true # only needed on Electron <= 41
```

Without `nodeLinker: hoisted`, packagers fail to resolve dependencies in the app
directory.
This requirement is documented in electron-builder’s issue tracker rather than
its docs, and Electron Forge documents the equivalent requirement for its pnpm support
added in 7.7.0.

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

A complete release workflow is in
[Appendix F](#appendix-f-github-actions-release-workflow).

* * *

## 8. What Shipping Apps Actually Do

The recommendations above are not derived from first principles alone.
The following is a survey of well-engineered open-source Electron apps, read from their
actual build configuration on 2026-08-16.

| App | Electron | Renderer bundler | Packager | Sandbox | Fuses |
| --- | --- | --- | --- | --- | --- |
| VS Code | 42.8.1 | esbuild (new pipeline) | custom (`@vscode/gulp-electron`) | Yes | Not visible in public config |
| Signal Desktop | 43.0.0 | **Rolldown 1.0.1** (migrated from webpack) | electron-builder 26.11.1 | Partial (phased preloads) | `@electron/fuses` present |
| Bitwarden | 43.2.0 | webpack 5.106.2 | electron-builder 26.9.0 | Yes | **7 flipped** |
| Mattermost | 43.3.0 | webpack 5.100.2 | electron-builder 26.6.0 | — | — |
| Joplin | 42.3.0 | esbuild | electron-builder 26.15.6 | — | — |
| Element Desktop | 41.0.2 | n/a (wraps Element Web) | electron-builder 26.8.2 | Yes, `app.enableSandbox()` | **8 configured** |
| Logseq | 38.4.0 | shadow-cljs + webpack + Vite | — | **No** (`sandbox: false`) | — |
| Standard Notes | 35.2.0 | webpack | electron-builder 24.9.1 | — | — |

What generalizes, and what does not:

- **electron-builder wins on adoption.** Every app here uses it except VS Code, which
  runs a custom pipeline justified by its scale, and Logseq, whose packager could not be
  confirmed. **None use Electron Forge**, despite Forge being the officially supported
  tool. This is the strongest empirical signal in the survey, and it is why
  electron-builder is the recommendation here despite not being an official Electron
  project.

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
  VS Code and Joplin use esbuild, and the maintained templates (`electron-vite-react`
  pins Electron 42.1.0, Vite 8.0.16, React 19.2.7) are all Vite.
  New projects should start on Vite/Rolldown; the webpack majority reflects when these
  apps were built.

- **Actively maintained apps stay inside the support window.** Six of the eight are on a
  supported major (41 through 43), and five of those are on 42 or 43—within about ten
  weeks of the newest release.
  Logseq (38) and Standard Notes (35) have fallen outside it and are therefore no longer
  receiving Electron security fixes.
  Note that Element, at 41, is supported only until 2026-08-25; being inside the window
  is not the same as having room to spare.

One caution on templates: `electron-react-boilerplate` (~24k stars) still pins Electron
35 and webpack, and the `electron-vite-boilerplate` template pins Electron 28.
Popularity is not currency.
`electron-vite-react` was the most current template found.

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
- **Lifecycle scripts are now blocked by default** across npm, pnpm, and Bun, and
  Electron no longer needs one.
  Keep them blocked.
- **A desktop app’s dependency tree ships to the user’s machine** and runs outside the
  browser sandbox in the main process.
  A compromised transitive dependency imported into main is worse than the same
  dependency in a server, where at least it is not running with the user’s desktop
  privileges. Keep the main process’s dependency list short and audited; push incidental
  work into the renderer (sandboxed) or a sidecar (separately signed).
- **ASAR integrity plus `onlyLoadAppFromAsar` are the tamper controls** that make
  signing meaningful after install.

* * *

## When Not to Use Electron

Electron’s cost is a Chromium and Node runtime per app: roughly 100–200MB installed
depending on platform and compression, and a memory floor well above a native app.
You are buying one rendering engine that behaves identically everywhere, the full web
ecosystem, and a deep well of documentation and hiring.

Consider alternatives when bundle size or memory is a hard product constraint, or when
the app is small enough that the runtime dominates it.
The main tradeoff you are accepting in exchange is **webview fragmentation**:
system-webview frameworks render on WebView2 on Windows, WKWebView on macOS, and
WebKitGTK on Linux, so you write once and debug three times.

A detailed comparison of Tauri, Electrobun, Wails, and Neutralino is deliberately out of
scope here and is tracked as separate research; this document stays focused on Electron.

* * *

## Best Practices

**Architecture**

- [ ] Renderer is an ordinary web app with no Node access.
- [ ] Preload exposes named capabilities, never a generic `invoke`.
- [ ] IPC types live in a type-only shared module used by both sides.
- [ ] Every `ipcMain` handler validates its sender and its payload.
- [ ] Long-running or CPU-bound work is in a `utilityProcess` or a sidecar, not in main.
- [ ] Backend processes are spawned from main, supervised, and killed on quit.

**Security**

- [ ] `sandbox`, `contextIsolation`, and `nodeIntegration` left at their defaults.
- [ ] CSP set via response header, with no `unsafe-inline` or `unsafe-eval`.
- [ ] `setWindowOpenHandler` denies by default.
- [ ] `will-navigate` blocks navigation outside the URLs the app itself loads.
- [ ] Permission request handler denies by default.
- [ ] `shell.openExternal` allowlists the scheme.
- [ ] Fuses flipped: `runAsNode`, `nodeCliInspect`, `nodeOptions`, and
  `grantFileProtocolExtraPrivileges` disabled; ASAR integrity and `onlyLoadAppFromAsar`
  enabled.
- [ ] Electron version inside the three-major support window.

**Build and release**

- [ ] Main, preload, and renderer have separate build configs.
- [ ] Preload emits a single CJS file.
- [ ] macOS: hardened runtime, minimal entitlements, every nested Mach-O signed,
  notarized and stapled.
- [ ] Windows: cloud-based signing; no expectation of instant SmartScreen bypass.
- [ ] Sidecars are `chmod +x` at build time and their path resolves through
  `process.resourcesPath` when packaged.
- [ ] Auto-update configured, and the app is signed so updates can apply.
- [ ] Playwright test launches the packaged app and exercises at least one IPC round
  trip.

* * *

## Open Research Questions

1. **Do Mach-O sidecars under `Contents/Resources` reliably pass notarization?** Apple’s
   TN2206 designates `Resources` for scripts and non-Mach-O executables, yet signed
   binaries placed there by `extraResources` are widely shipped.
   Resolving this needs a controlled test: notarize one build with a Mach-O sidecar in
   `Resources` and another with it relocated to `Contents/Helpers`, and compare.

2. **Is `node:sqlite` at full stability in the Node embedded in Electron 43?** It
   reached release-candidate status in Node and stabilized in later Node versions than
   Electron 43 embeds. Confirm before recommending it without qualification for
   production data.

3. **When does the Bun `--compile` macOS 27 signature defect
   ([bun#32159](https://github.com/oven-sh/bun/issues/32159)) land a fix?** This gates
   Bun-compiled sidecars on the newest macOS.

4. **Will electron-builder 27 ship, and on what timeline?** The alpha has been in
   progress for a while.
   Its ESM migration and consolidated signing config are worth adopting, but not before
   it is stable.

5. **Does Electron Forge 8 close the gap with electron-builder** on Linux targets and
   differential updates?
   If so, the default recommendation here should move to the officially supported tool.

* * *

## Recommendations

### Default Stack

For a new standalone desktop app with a TypeScript UI and a Node backend:

```
Electron 43 + Node 24 (host toolchain) + pnpm 11
├── electron-vite          # three-target build, HMR, hot restart
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

### Polyglot Backend Stack

When the backend is Python or another language, keep everything above and add: a sidecar
built with python-build-standalone plus `uv` (or a compiled Go/Rust binary), stdio
JSON-RPC as the transport, `extraResources` for placement, an `afterPack` hook that
signs every nested Mach-O, and explicit lifecycle supervision with a Job Object on
Windows.

### What to Avoid

- Driving the Electron **build** through Bun.
  Install with it if you like; package with Node.
- Binding a loopback HTTP port when stdio would work.
- Adding entitlements speculatively.
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
- [Breaking Changes](https://www.electronjs.org/docs/latest/breaking-changes)
- [Electron Release Timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
- [Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)

### Build and Packaging Tools

- [electron-vite](https://electron-vite.org/)
- [vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron)
- [Electron Forge](https://www.electronforge.io/)
- [electron-builder](https://www.electron.build/)
- [electron-builder v27 migration](https://www.electron.build/docs/migration/v27-breaking-changes/)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Playwright Electron support](https://playwright.dev/docs/api/class-electron)

### Signing, Notarization, and Distribution

- [Apple TN2206: macOS Code Signing In Depth](https://developer.apple.com/library/archive/technotes/tn2206/_index.html)
- [Electron Forge macOS signing guide](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [Microsoft: code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Mac App Store submission guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [update.electronjs.org](https://github.com/electron/update.electronjs.org)

### Backend Runtimes

- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
- [Node.js `node:sqlite`](https://nodejs.org/api/sqlite.html)
- [Bun standalone executables](https://bun.com/docs/bundler/executables)
- [python-build-standalone](https://github.com/astral-sh/python-build-standalone)
- [uv](https://docs.astral.sh/uv/)
- [PyInstaller](https://pyinstaller.org/en/stable/)
- [Nuitka](https://nuitka.net/)

### Security Background

- [GitHub: localhost dangers, CORS and DNS rebinding](https://github.blog/security/application-security/localhost-dangers-cors-and-dns-rebinding/)

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
- [electron-vite/electron-vite-react](https://github.com/electron-vite/electron-vite-react)—the
  most current starter template found

### Issue Reports Cited

- [bun#9895: electron-builder `rebuild` script not found](https://github.com/oven-sh/bun/issues/9895)—open
- [bun#18249: segfault during electron-builder build](https://github.com/oven-sh/bun/issues/18249)—closed
- [bun#1588: Electron failed to install correctly](https://github.com/oven-sh/bun/issues/1588)—closed
- [bun#32159: `--compile` binaries fail signature validation on macOS 27](https://github.com/oven-sh/bun/issues/32159)—open
- [forge#3906: Bun package manager support](https://github.com/electron/forge/issues/3906)—open
- [electron-builder#1790: executable permissions lost in packaging](https://github.com/electron-userland/electron-builder/issues/1790)

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
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
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
- `rollupOptions` remains the option name on Vite 8 even though Rolldown is the bundler
  underneath.
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

mac:
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize: true
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

afterPack: ./scripts/after-pack.js # sign nested binaries, restore +x
afterSign: ./scripts/notarize.js # @electron/notarize
```

Matching `entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <!-- Add only if a sidecar or native module actually requires it: -->
  <!-- <key>com.apple.security.cs.disable-library-validation</key><true/> -->
</dict>
</plist>
```

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

  // Deny every permission that has not been deliberately enabled.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
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

**1. Build the interpreter tree** (at build time, not install time).
Unpack a python-build-standalone release for each target and install the locked
dependencies **directly into that tree**—not into a venv, whose scripts and `pyvenv.cfg`
hardcode build-machine paths and whose interpreter is a symlink back to wherever the
venv was created:

```bash
# One target shown; repeat per {os, arch}. Use the install_only variant.
PBS=https://github.com/astral-sh/python-build-standalone/releases/download/20260610
curl -LO $PBS/cpython-3.13.14+20260610-aarch64-apple-darwin-install_only.tar.gz
mkdir -p resources/bin/darwin/arm64
tar -xzf cpython-*.tar.gz -C resources/bin/darwin/arm64   # yields .../python/

uv pip sync --python resources/bin/darwin/arm64/python/bin/python3 requirements.lock
cp -r backend resources/bin/darwin/arm64/backend   # the app's own Python source
```

**2. Speak newline-delimited JSON over stdio** — no port, no auth, dies with the parent:

```python
# backend/main.py
import json, sys

for line in sys.stdin:
    req = json.loads(line)
    result = handle(req)
    sys.stdout.write(json.dumps({"id": req["id"], "result": result}) + "\n")
    sys.stdout.flush()   # without this, the parent waits forever
```

**3. Supervise it from the main process:**

```ts
import { spawn, type ChildProcess } from 'node:child_process';

let backend: ChildProcess | undefined;

export function startBackend(): void {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(__dirname, '../../resources/bin', process.platform, process.arch);
  const python =
    process.platform === 'win32'
      ? path.join(root, 'python', 'python.exe')
      : path.join(root, 'python', 'bin', 'python3');

  if (process.platform !== 'win32') fs.chmodSync(python, 0o755); // +x is not reliably preserved

  backend = spawn(python, [path.join(root, 'backend', 'main.py')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32', // own process group, so we can kill the tree
  });
  backend.on('exit', (code) => scheduleRestartWithBackoff(code));
}

export function stopBackend(): void {
  if (!backend?.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(backend.pid), '/f', '/t']);
  } else {
    process.kill(-backend.pid, 'SIGTERM'); // negative pid kills the group
  }
  backend = undefined;
}
```

On Windows, prefer a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` over
`taskkill` if you can add a native dependency: it is the only approach that also cleans
up when the main process crashes.

**4. Sign every Mach-O in the tree** in `afterPack`, before the outer app is signed:

```js
// scripts/after-pack.js
const { execFileSync } = require('node:child_process');
const { globSync } = require('glob');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const resources = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app/Contents/Resources`;
  // The interpreter, every .so extension module, and every bundled .dylib.
  const machO = globSync(
    [`${resources}/bin/**/*.so`, `${resources}/bin/**/*.dylib`, `${resources}/bin/**/bin/python*`],
    { nodir: true },
  );
  for (const file of machO) {
    execFileSync('codesign', [
      '--force', '--options', 'runtime', '--timestamp',
      '--entitlements', 'build/entitlements.mac.plist',
      '--sign', process.env.CSC_NAME, file,
    ]);
  }
};
```

### Appendix F: GitHub Actions Release Workflow

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest
          - os: windows-latest
          - os: ubuntu-latest
    runs-on: ${{ matrix.os }}
    env:
      # Pin the Electron download cache to one path so the cache step below is
      # correct on all three runners (the OS-default location differs per OS).
      ELECTRON_CACHE: ${{ github.workspace }}/.cache/electron
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm

      # The Electron binary download is the largest cost in a cold build.
      - uses: actions/cache@v4
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
```

Environment variables that do not apply to a given OS are ignored, so one shared step
works across the matrix.

Notarize on tags only.
Pull request builds should package without signing, which is fast and needs no secrets.

## Related Guidelines

- For monorepo setup with pnpm, see `tbd guidelines pnpm-monorepo-patterns`
- For monorepo setup with Bun, see `tbd guidelines bun-monorepo-patterns`
- For Tauri, see `tbd guidelines tauri-app-development-patterns`
- For Electrobun, see `tbd guidelines electrobun-app-development-patterns`
- For dependency policy, see `tbd guidelines supply-chain-hardening`
- For TypeScript conventions, see `tbd guidelines typescript-rules`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
