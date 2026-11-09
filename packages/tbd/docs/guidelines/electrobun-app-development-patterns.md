---
title: Electrobun App Development Patterns
description: Building desktop apps with Electrobun 2.x—runtime and process model, typed RPC, project layout, Hutch packaging and macOS signing, the delta updater, plus an evidence-based security, supply-chain, and maturity assessment
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: desktop
---
# Electrobun App Development Patterns

**Last Updated:** 2026-11-08

## Executive Summary

Electrobun builds desktop apps with a TypeScript main process (or a Zig, Rust, Go, or
Odin one), a native Zig core, system webviews or bundled Chromium (CEF), and a typed RPC
layer between the main process and its webviews.
Its build CLI, Hutch, is MIT-licensed and open source; it produces signed and notarized
macOS DMGs, installers for Windows and Linux, and the feed for a bsdiff-based delta
updater. By default it does not ship Chromium, but a Bun main process still carries a
JavaScript runtime of roughly 63 MB extracted (measured for Bun 1.3.13 on macOS arm64).

**Bun is the default main-process runtime.** `build.mainProcess` accepts
`bun | cottontail | zig | rust | go | odin` and defaults to `"bun"`
(`package/src/config/ElectrobunConfig.ts:151`). Cottontail, Electrobun’s own
JavaScriptCore runtime, is an experimental opt-in.
The default has changed twice in two months of stable releases: 2.0.1 (2026-08-22) made
Cottontail the default, and 2.0.4 (2026-10-18) moved it back to Bun.
Material written between those dates describes Cottontail as the default.

Three findings determine whether you should use it, and all three are verifiable in the
repositories:

- **The updater checks integrity, not authenticity.** Since 2.0.6 it requires HTTPS and
  can check a SHA-256 digest of the update archive, but the digest is optional and comes
  from the same host as the payload, so it detects corruption, not tampering.
  There is no signature, no key compiled into the app, and no check of the staged
  bundle’s code signature; on macOS the updater strips the quarantine flag from what it
  downloaded. Anyone who controls your update host can run code on every installed copy.
  Details and evidence are in
  [The Updater](#the-updater-checks-integrity-not-authenticity).

- **Sandboxing and IPC are mutually exclusive.** A sandboxed webview cannot use RPC at
  all, so the Electron posture of “sandboxed renderer talking over a narrow audited
  bridge” is not available.
  There is also no `contextIsolation` equivalent.

- **The bus factor is one.** All 481 commits on `main` between 2026-08-16 and 2026-11-08
  are by one account, no pull request was merged in that period, 54 issues were opened
  and 5 closed, private vulnerability reporting is disabled, and the two open security
  reports (#515, #518) have no maintainer comment.

**Recommendation in one line:** reasonable for internal tools, prototypes, and apps you
distribute to a trusted audience without the built-in updater; not currently a
responsible choice for a security-sensitive product or one shipped to the general
public. The full form is in [Recommendations](#recommendations).

**Related:**

- [Electrobun documentation](https://docs.electrobun.dev/electrobun/)
- [Electrobun changelog](https://docs.electrobun.dev/electrobun/guides/changelog/)
- [Electrobun source](https://github.com/blackboardsh/electrobun)
- [Hutch source](https://github.com/blackboardsh/hutch) (the build CLI)
- [Companion: Electron App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electron-app-development-patterns.md)
- [Companion: Tauri App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/tauri-app-development-patterns.md)
- [Companion: macOS WebView Shell Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md)
- [Companion: Desktop Python Runtime Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/desktop-python-runtime-patterns.md)
- [Companion: Supply-Chain Hardening](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)
- [Companion: TypeScript Rules](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/typescript-rules.md)

* * *

## Updating This Document

Electrobun moves fast: beta releases land most days, stable releases every one to six
weeks, and defaults have changed between stable releases.
Recheck the npm dist-tags, release ages, the updater, and the open security issues
before relying on anything below.

### Last Researched Versions

Observed 2026-11-08 by querying the npm registry and the GitHub REST API, and by reading
(not running) clones of `blackboardsh/electrobun` at tag `v2.0.6` (commit `c9e637c4`)
and `blackboardsh/hutch` at tag `v0.29.0` (commit `a2c9255e`), the Hutch version that
2.0.6 pins in `package/hutch.config.ts`. Commits on `main` after 2.0.6 were read through
the GitHub commits API.

**Citation convention:** a bare `path:line` refers to `blackboardsh/electrobun` at
`v2.0.6`; `hutch/path:line` refers to `blackboardsh/hutch` at `v0.29.0`. `docs/…/`
abbreviates `docs/src/content/docs/electrobun/`, and a file named once in full is
shortened to its filename afterward.
Sizes use MB = 10^6 bytes.

| Thing | Version | Check For Updates |
| --- | --- | --- |
| **electrobun (stable)** | 2.0.6 | [npmjs.com/package/electrobun](https://www.npmjs.com/package/electrobun)—`latest`, published **2026-11-04**. Stable releases since 2026-08-16: 2.0.1 (08-22), 2.0.2 (09-29), 2.0.4 (10-18), 2.0.5 (10-26), 2.0.6 (11-04). There is no 2.0.0 or 2.0.3 stable. |
| **electrobun (beta)** | 2.0.7-beta.7 | Same registry, `beta` tag—published 2026-11-08. 78 versions were published between 2026-08-16 and 2026-11-08, and 374 since 2024-08-08. |
| **14-day cool-off** | Newest stable outside it: **2.0.4** | On 2026-11-08 a release is eligible if its UTC publish date is on or before 2026-10-25. 2.0.5 (published 2026-10-26) and 2.0.6 (2026-11-04) are inside the window; 2.0.5 becomes eligible on 2026-11-09 and 2.0.6 on 2026-11-18. See [Choosing a Version Under a Cool-Off](#choosing-a-version-under-a-cool-off). |
| **Hutch (build CLI)** | 0.29.0 | Paired per release by the `// @hutch cli=0.29.0 cottontail=0.7.3` pragma in `package/hutch.config.ts`. Hutch archives are attached to Electrobun GitHub releases; the Hutch repository has no releases of its own. |
| **Bundled Bun** (default runtime) | 1.4.4 | `package/src/shared/bun-version.ts`; upstream release published 2026-10-22. |
| **Cottontail** (experimental runtime) | 0.7.3 | The pragma above. |
| **Bundled CEF** | 156.0.7+g47dbc1d (Chromium 156.0.8078.17) | `package/src/shared/cef-version.ts`. Shipped as a separate archive, downloaded only when `bundleCEF` is set. |
| **macOS support** | 14+, arm64 and x64 | README platform table; `package/scripts/macos-release.js:1` sets `MACOS_DEPLOYMENT_TARGET = "14.0"`. Intel builds returned in 2.0.5 ([#560](https://github.com/blackboardsh/electrobun/issues/560)). |
| **Windows support** | 11+, x64 (official), ARM64 (beta) | README platform table. Requires the Evergreen WebView2 runtime, which is **not** bundled. |
| **Linux support** | Ubuntu 24.04+, x64 and arm64 | Needs GTK3, WebKitGTK 4.1, Ayatana AppIndicator, librsvg. Other distributions are community-supported. |

### Reminders When Updating

1. **Recheck dist-tags and release ages first.**
   `npm view electrobun dist-tags time --json` shows both.
   Apply the 14-day cool-off from `tbd guidelines supply-chain-hardening`, and recheck
   which security fixes the newest release outside the window lacks.

2. **Recheck the updater.** Search `package/src/sdks/main/core/Updater.ts` and
   `package/src/extractor/` for a signature checked against a key compiled into the app,
   and for a code-signature or Team ID comparison of the staged bundle.
   Check whether the archive digest is still optional.
   These questions govern the recommendation in this document.

3. **Recheck security reporting and the open security issues**, particularly
   [#515](https://github.com/blackboardsh/electrobun/issues/515) (notarization
   credentials), [#518](https://github.com/blackboardsh/electrobun/issues/518) (RPC
   transport), and [#589](https://github.com/blackboardsh/electrobun/issues/589) (cookie
   flags), and whether private vulnerability reporting
   (`GET /repos/blackboardsh/electrobun/private-vulnerability-reporting`) or a
   `SECURITY.md` now exists.

4. **Recheck the runtime default**: the `@default` on `build.mainProcess` in
   `package/src/config/ElectrobunConfig.ts`. It changed twice between 2026-08-22 and
   2026-10-18.

5. **Verify claims against source at a tag, not the documentation.** Several docs pages
   still configure Cottontail while the templates and the config default use Bun.

6. **Read the changelog page for each release** under
   `docs/src/content/docs/electrobun/guides/changelog/`, then the diff.
   GitHub release notes are auto-generated compare links.

7. **Recheck Hutch’s download verification** in `hutch/src/toolchain_store.zig` (Bun,
   Zig, Rust, Go, and Odin toolchains) and in `npm/electrobun/bin/resolve-hutch.cjs`.

8. **Recheck the platform matrix.** It has both narrowed and widened between releases.

* * *

## 1. Architecture and Process Model

### The Layers

An Electrobun app is a stack of four things, verified by reading the repository:

| Layer | Implementation | Role |
| --- | --- | --- |
| **Launcher** | Zig binary (`package/src/launcher/main.zig`) | Reads `Resources/build.json`, selects and spawns the main-process runtime, and forwards SIGINT, SIGTERM, and SIGHUP to it. On Linux sets `LD_LIBRARY_PATH` and, when CEF is present, `LD_PRELOAD`. On Windows uses `CreateProcessW` with `CREATE_NO_WINDOW`. |
| **Main process** | Bun (default), Cottontail (experimental), Zig, Rust, Go, or Odin | Runs your application code. Owns the native event loop through FFI. Full system access. |
| **Native core** | Zig (`package/src/core/main.zig`, about 4,600 lines) plus per-platform wrappers | Window and webview lifecycle, the WebSocket transport, thread-safe registries. Exposed over a C ABI. |
| **Webviews** | WKWebView (macOS), WebView2 (Windows), WebKitGTK (Linux), or bundled CEF | Your UI. Separate OS processes. |

The native wrappers are `nativeWrapper.mm` (Objective-C++, about 11,700 lines) on macOS
and `nativeWrapper.cpp` (C++) on Windows and Linux, sharing a set of header-only C++
libraries in `package/src/native/shared/`. The TypeScript SDK loads them with `dlopen`
and binds roughly 200 native symbols (`package/src/sdks/main/proc/native.ts`).

A detail worth knowing because it explains a class of bug: the main thread runs the
blocking native GUI event loop, while your application code runs in a **worker thread**.
Native callbacks therefore fire on a different thread from your JavaScript, which is why
the SDK creates its callbacks with `threadsafe: true`, and why a 2ms delay still sits in
`package/src/preload/internalRpc.ts:28` labelled “work around Bun JSCallback threading
issue.”

### Choosing a Main-Process Runtime

Abridged from `package/src/config/ElectrobunConfig.ts:141-153`:

```ts
mainProcess?: "bun" | "cottontail" | "zig" | "rust" | "go" | "odin"; // @default "bun"
```

- **`bun` (default)** bundles your entrypoint with Bun’s bundler and ships the Bun
  executable as `Contents/MacOS/bun`. The templates and the Hutch script runner both
  default to Bun. Configure it under `build.bun`, including an optional
  `build.bun.version` (`hutch/src/electrobun.zig:4011-4026`).
- **`cottontail`** is experimental and opt-in: set `build.mainProcess: "cottontail"` and
  configure `build.cottontail`. Hutch packages only the standard-library capabilities it
  detects in your bundle, so dynamically loaded code may need explicit
  `build.cottontail.capabilities`. A config that omits `mainProcess` and provides only a
  `cottontail` block fails with a migration error rather than silently switching
  runtimes (`hutch/src/electrobun_cli/load_config_helper.js:124`).
- **`zig`, `rust`, `go`, `odin`** replace the JavaScript main process entirely.
  They are not a sidecar mechanism; your window management is written in that language.
  Odin is unavailable on Windows ARM64.

Choose Bun unless you have measured a reason not to.
The runtime default has moved twice, so pin `mainProcess` explicitly rather than relying
on the default.

### Webview Selection and the Linux Exception

Per platform you choose a system webview or bundled Chromium:

```ts
mac:   { bundleCEF: false },
linux: { bundleCEF: true },
win:   { bundleCEF: false },
```

macOS links CEF weakly and falls back to WebKit; Windows detects CEF at runtime; **Linux
ships two separate native libraries** (`libNativeWrapper.so` for GTK and
`libNativeWrapper_cef.so` for CEF) because Linux lacks reliable weak linking.

The Linux case deserves attention because it undercuts the framework’s main selling
point. Electrobun’s documentation recommends CEF on Linux “for consistent Chromium
behavior and native overlay compositing” (`docs/…/apis/bundling-cef.mdx:132`), and the
`photo-booth` template sets `linux: { bundleCEF: true }`. Bundling CEF means bundling
Chromium, which is the cost Electron is criticised for.
**On Linux you largely give up the size advantage**, or you accept a materially
different rendering engine from your other platforms.

* * *

## 2. Reference Architecture

### Project Layout and Configuration

```
my-app/
├── src/
│   ├── bun/
│   │   └── index.ts          # main process entry
│   └── mainview/
│       ├── index.ts          # webview entry
│       ├── index.html
│       └── index.css
├── electrobun.config.ts      # app, build, runtime, release
├── hutch.config.ts           # scripts: install, dev, build
└── hutch.lock                # lockfile of Hutch's built-in resolver
```

Since 2.0 a project has two config files: `electrobun.config.ts` describes the app, and
`hutch.config.ts` holds the scripts and the optional `electrobun.version` pin.
Top-level keys of `electrobun.config.ts` are `app`, `build`, `runtime`, `scripts` (build
hooks), and `release`, plus `bunny` for Carrot packaging metadata.

**Treat the templates at a tag as authoritative, not the published docs.** The templates
and the config default use Bun, but several docs pages, including the Hello World guide
and examples in the build-configuration and bundling guides, still configure
`mainProcess: "cottontail"`. This is the `photo-booth` template at v2.0.6, with quotes
and indentation normalized:

```ts
import type { ElectrobunConfig } from 'electrobun';

export default {
  app: {
    name: 'photo-booth',
    identifier: 'photobooth.electrobun.dev',
    version: '0.0.1',
  },
  build: {
    mainProcess: 'bun',
    bun: { entrypoint: 'src/bun/index.ts' },
    views: {
      mainview: { entrypoint: 'src/mainview/index.ts' },
    },
    copy: {
      'src/mainview/index.html': 'views/mainview/index.html',
      'src/mainview/index.css': 'views/mainview/index.css',
    },
    mac: {
      bundleCEF: false,
      codesign: true,
      entitlements: {
        'com.apple.security.device.camera':
          'This app needs camera access to take photos for your photo booth',
      },
    },
    linux: { bundleCEF: true },
    win: { bundleCEF: false },
  },
} satisfies ElectrobunConfig;
```

Its `hutch.config.ts`:

```ts
export default {
  scripts: {
    install: ['hutch', 'install', '--frozen-lockfile'],
    start: ['hutch', 'electrobun', 'dev'],
    dev: ['hutch', 'electrobun', 'dev', '--watch'],
    build: ['hutch', 'electrobun', 'build', '--env=stable'],
    'build:canary': ['hutch', 'electrobun', 'build', '--env=canary'],
  },
};
```

A string value in `mac.entitlements` also becomes the matching usage-description key in
`Info.plist` (`NSCameraUsageDescription` here; mapping table at
`hutch/src/electrobun.zig:8009-8028`).

### Bringing Your Own Frontend Build

Electrobun bundles view code with Bun’s bundler, but you can run any frontend toolchain
and map its output in through `copy`. The `react-tailwind-vite` template does exactly
this:

```ts
build: {
  mainProcess: 'bun',
  bun: { entrypoint: 'src/bun/index.ts' },
  copy: {
    'dist/index.html': 'views/mainview/index.html',
    'dist/assets': 'views/mainview/assets',
  },
  watchIgnore: ['dist/**'],   // Vite owns dist; do not double-watch it
}
```

This is the pattern the community has converged on: React plus Tailwind plus Vite, built
by Vite, copied into the bundle.

### Creating a Window

```ts
import { BrowserWindow } from 'electrobun/main';

const mainWindow = new BrowserWindow({
  title: 'Hello Electrobun!',
  url: 'views://mainview/index.html',
  frame: { width: 800, height: 800, x: 200, y: 200 },
});
```

The `views://` scheme resolves to assets bundled by `build.views` and `build.copy`.
Views must be declared in the config to exist at runtime.
`url` also accepts `http://localhost` and remote URLs, which is how the Vite templates
load their dev server.

The main API surface is `BrowserWindow`, `BrowserView`, `Electroview` (browser side),
`Tray`, `ApplicationMenu`, `Utils`, `PATHS`, and `Updater`.

### Typed RPC

This is the part of Electrobun that is genuinely nicer than Electron’s equivalent.
The contract is a plain TypeScript type, split into awaitable `requests` and
fire-and-forget `messages`, and both sides are typed from it with no codegen.

Main process:

```ts
import { BrowserView, Utils, type RPCSchema } from 'electrobun/main';

export type BunnyRPC = {
  bun: RPCSchema<{
    requests: {};
    messages: { bunnyClicked: void };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      cursorMove: { screenX: number; screenY: number };
    };
  }>;
};

const rpc = BrowserView.defineRPC<BunnyRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {},
    messages: {
      bunnyClicked: () => {
        Utils.openExternal('https://docs.electrobun.dev/electrobun/');
      },
    },
  },
});
```

Webview side, importing the same type:

```ts
import Electrobun, { Electroview } from 'electrobun/view';
import type { BunnyRPC } from '../bun/index';

const rpc = Electroview.defineRPC<BunnyRPC>({
  maxRequestTime: 5000,
  handlers: { requests: {}, messages: {} },
});

const electrobun = new Electrobun.Electroview({ rpc });
```

Underneath, traffic runs over a **loopback WebSocket** (`ws://127.0.0.1`, a port in
50000–65535) encrypted per webview with AES-256-GCM, with a native `postMessage` bridge
as the fallback (`package/src/browser/index.ts:245-257`). Every webview also gets a
built-in `evaluateJavascriptWithResponse` request.

### The Development Loop

`hutch electrobun init` scaffolds from about 30 official templates;
`npx electrobun init` and `bunx electrobun init` do the same through the npm bootstrap,
which downloads the paired Hutch.
`hutch run dev` then builds, launches, watches, and relaunches the app on change.

Two loops exist (`docs/…/guides/hot-reloading.mdx`):

- **Whole-app watch mode** (`hutch electrobun dev --watch`) rebuilds and relaunches for
  any main-process or bundled-view change.
  Main-process state resets.
- **Webview HMR** works only for views served by a dev server: the Vite templates’
  `hutch run dev:hmr` runs Vite on port 5173 alongside the app, and accepted changes
  apply without relaunching.

There is no in-process hot reload of the main process.
DevTools are available through `webview.openDevTools()`.

* * *

## 3. Attaching a Backend

Electrobun has **no documented sidecar mechanism and no equivalent of electron-builder’s
`extraResources`.** The working approach is the one the community has assembled:

1. **Place the binary** with `build.copy`
   (`package/src/config/ElectrobunConfig.ts:322`), mapping it into the bundle like any
   other asset.
2. **Resolve its path** at runtime through `PATHS.RESOURCES_FOLDER`, the bundle’s
   `Resources` directory.
3. **Spawn it** with the runtime’s process API—`Bun.spawn()` under Bun, which the SDK
   itself uses for its update helper (`package/src/sdks/main/core/Updater.ts:2182`).
4. **Stop it yourself.** The launcher forwards signals to the main process only.
   In `before-quit`, which runs synchronously and does not await promises
   (`docs/…/apis/events.mdx`), close the child’s stdin or send it `SIGTERM`.

If the backend serves the UI over HTTP, follow the framework-independent
[shell–server contract](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#the-shellserver-contract):
the server binds `127.0.0.1` on port 0 and, once listening, prints one JSON ready line
on stdout (`{"event":"ready","protocol":1,"url":…,"port":…,"pid":…,"version":…}`); the
shell writes a per-launch secret as the first stdin line, never in argv or the
environment, and keeps stdin open, so EOF, like `SIGTERM`, starts a bounded graceful
shutdown. Under Bun that is
`Bun.spawn([path, ...args], { stdin: "pipe", stdout: "pipe" })`, then
`proc.stdin.write(secret + "\n")` and `proc.stdin.flush()` without calling
`proc.stdin.end()`, then reading `proc.stdout` until the ready line arrives.
Of the contract’s client-authentication options, prefer the single-use exchange code at
a one-time URL, so the server sets its own cookie: setting one directly through
`Session.cookies.set()` drops `httpOnly` on macOS
([#589](https://github.com/blackboardsh/electrobun/issues/589)). For a Python backend,
see `tbd guidelines desktop-python-runtime-patterns`. If the backend answers only the
main process, newline-delimited JSON over stdio avoids binding a port at all.

Two Electrobun-specific facts:

- **Release builds sign nested binaries automatically.** Hutch signs every Mach-O in the
  bundle, deepest first, with the hardened runtime and your entitlements file
  (`hutch/src/electrobun.zig:2197-2295`). A bundled executable therefore receives the
  three default entitlements, including `disable-library-validation`, unless you set
  them to `false` (see [Code Signing](#code-signing)).
- **The macOS bundle layout is standard:** executables in `Contents/MacOS/`, resources
  in `Contents/Resources/`, app code in `Contents/Resources/app/`
  (`hutch/src/electrobun.zig:7889-7893`).

If your backend is a compiled language, consider making it the main process instead:
`mainProcess` accepts `zig`, `rust`, `go`, and `odin`, which avoids the sidecar problem
at the cost of writing your window management in that language.

* * *

## 4. Security Baseline

This section is longer than the equivalent in the Electron guideline because Electrobun
does not ship a comparable set of defaults, and because **the framework has no security
documentation and no security policy**: no `SECURITY.md`, private vulnerability
reporting disabled, and no published advisories (GitHub API, 2026-11-08). That absence
is itself the most important thing to know before choosing it.

### What Electrobun Gets Right

- **Webview code has no direct runtime access.** There is no ambient Bun, Node, or
  filesystem API in the page.
  The RPC surface is the only way out.
- **Webviews are separate OS processes**, so a renderer crash does not take the app
  down.
- **RPC traffic is encrypted** with AES-256-GCM, and the transport binds `127.0.0.1`
  only.
- **The native bridge is main-frame-only on macOS** since 2.0.6
  (`isMainFrameScriptMessage`, `package/src/native/macos/nativeWrapper.mm:2969, 2990`);
  embedded frames must relay through `postMessage`. The Linux equivalent is unreleased
  (commit `575df99d`, 2.0.7-beta.2).
- **Navigation control exists** through glob-pattern URL rules (`navigationRules`).

### The Sandbox and RPC Are Mutually Exclusive

Two preload variants exist in the source.
The sandboxed one (`package/src/preload/index-sandboxed.ts:1-30`) states its own limits:
“NO RPC, NO encryption, NO webview tags,” and “sandboxed webviews cannot communicate
with Bun.” With `sandbox: true` the macOS wrapper registers only the `eventBridge`
message handler, not `hostBridge`, `bunBridge`, or `internalBridge`
(`nativeWrapper.mm:3148-3190`).

So the choice is binary.
A sandboxed webview is inert—lifecycle events and one-way emission only.
A webview that can talk to your application is not sandboxed.
**Electron’s default posture, a sandboxed renderer communicating over a narrow audited
bridge, has no equivalent here**, and sandboxing is opt-in rather than the default.

The practical consequence: cross-site scripting in an Electrobun webview yields the full
RPC surface, which in a typical app carries filesystem and OS access.
In Electron the same bug is contained by context isolation and a deliberately narrow
`contextBridge` surface.
If a view needs no RPC—a page served by your own local server, for example—make it
sandboxed, and the trade-off stops mattering for that view.

### There Is No Context Isolation

Electron’s `contextIsolation` runs preload code in a separate JavaScript context so page
script cannot reach or overwrite the bridge.
Electrobun has no equivalent: preloads are `WKUserScript`s injected into the page world
(`nativeWrapper.mm:3461` assigns `[WKContentWorld pageWorld]` to a variable named
`isolatedWorld`), and isolated-world support is open issue
[#140](https://github.com/blackboardsh/electrobun/issues/140) (open since 2026-02-07).
The preload globals `window.__electrobun` and `window.__electrobun_encrypt` are
reachable from page JavaScript and can be overwritten, and the per-webview key sits in
`window.__electrobunSecretKeyBytes` (`package/src/preload/encryption.ts:47`) and is
imported as an extractable key (`:36-41`). The encryption protects the transport against
other local processes; it does not protect the bridge from the page itself.

### The Transport and Other Open Issues

Open issue [#518](https://github.com/blackboardsh/electrobun/issues/518) (open since
2026-08-09, no maintainer comment) reports that the WebSocket upgrade is authenticated
only by a small sequential webview ID, so a local process can displace a webview’s
socket, and that frames up to 500 MB are accepted.
Both are present in 2.0.6: `websocket_payload_limit = 1024 * 1024 * 500`
(`package/src/core/main.zig:119`). The report rates the impact as local denial of
service and transport hijack, not RPC forgery, because the key is not exposed to other
processes. The core starts this listener whenever the webview runtime is configured
(`core/main.zig:1676`), so an app with only sandboxed views still listens.

Open issue [#589](https://github.com/blackboardsh/electrobun/issues/589) (2026-10-20):
on macOS `Session.cookies.set()` drops `httpOnly` and ignores `sameSite`.

### Practical Rules

Given the above, the discipline has to come from your application rather than the
framework:

- **Never load remote or untrusted content into a webview that has RPC.** In Electron
  this is a strong recommendation; here it is closer to a hard requirement, because you
  have no second line of defence.
- **Use `sandbox: true` for every view that does not need RPC.**
- **Keep the RPC surface narrow and specific**, exactly as you would a `contextBridge`
  surface: named capabilities, no generic pass-through, no method that takes an
  arbitrary path or command.
- **Validate every RPC payload** in the main process.
  The type contract is compile-time only; it guarantees nothing at runtime.
- **Set a Content-Security-Policy yourself.** The framework offers no guidance and no
  default.
- **Use navigation rules** to pin the app to its own `views://` origin.
- **Do not rely on cookie flags set through `Session.cookies` on macOS** until #589 is
  fixed; set security-relevant cookies from the server.
- **Be deliberate about `bundleCEF`.** CEF and the system webviews have different
  security update cadences: system webviews are patched by the OS vendor, while bundled
  CEF is only as current as your last release.

* * *

## 5. Packaging and Distribution

### Build Output

`hutch electrobun build --env=canary` or `--env=stable` builds for the host platform
only; each of the six targets (macOS, Windows, and Linux on arm64 and x64) builds on its
own runner, and cross-compiling from Apple Silicon to Intel is not supported.

| Platform | Installer | Installs to |
| --- | --- | --- |
| **macOS** | DMG with an `/Applications` symlink, containing a self-extracting wrapper app (below). `build.mac.createDmg: false` skips the DMG. | Wherever the user drags it, normally `/Applications`. |
| **Windows** | Zip holding a setup executable and a hidden payload. | `%LOCALAPPDATA%` |
| **Linux** | `.tar.gz` holding a self-extracting `installer`. Optional Flatpak config emits a payload and a `flatpak-builder` manifest; Hutch does not run `flatpak-builder`. | `$XDG_DATA_HOME`, default `~/.local/share` |

Every release build also emits the update feed: `<channel>-<os>-<arch>-update.json`, a
`.tar.zst` of the app, and, when `release.baseUrl` reaches a previous release, a
`.patch` against it.
Installed apps keep a small archive recipe rather than a full tar; the updater
reconstructs the original tar in memory for delta patching.

There is no `.deb`, `.rpm`, `.AppImage`, or Snap target, so Linux users get no
package-manager integration unless you build a Flatpak from the emitted manifest.

### The macOS App Is a Self-Extracting Wrapper

A macOS release is **two signed, notarized app bundles**
(`hutch/src/electrobun.zig:1116-1167`, `:1900-1931`, `:2685-2760`):

1. Hutch builds the real app, signs it, notarizes and staples it, then tars and
   zstd-compresses it.
2. It builds an **outer wrapper** `.app` whose `Contents/MacOS/launcher` is the Zig
   extractor, with `Contents/Resources/<hash>.tar.zst` and `metadata.json` beside it.
   The wrapper is signed, notarized, and stapled, then placed in a DMG that is signed
   and notarized too: up to three notarization submissions per architecture.
3. On first launch the extractor (`package/src/extractor/main.zig:8234-8440`)
   decompresses the inner app into
   `~/Library/Application Support/<identifier>/<channel>/self-extraction.partial`,
   renames the running wrapper aside, moves the inner app into the wrapper’s path, and
   relaunches it with a detached `open -n` (`:8439`).

Consequences:

- **What the DMG installs is not what runs.** Anything that inspects or replaces the
  installed bundle (Homebrew casks, MDM, Sparkle) sees the wrapper before first launch
  and the inner app after it.
- **The first invocation loses its process context.** It cannot preserve arguments,
  working directory, standard streams, signals, or exit status
  ([#540](https://github.com/blackboardsh/electrobun/issues/540), open since
  2026-09-03), so an app that is also run as a CLI misbehaves on first use.
- **Read-only and translocated launches are unhandled.** The extractor has no handling
  for App Translocation or a read-only volume (no matches for `translocat`, `/Volumes`,
  or `EROFS` in `extractor/main.zig`). Launching directly from the mounted DMG, or from
  a quarantined download that macOS translocates, is untested here; the rename into the
  wrapper’s own path looks likely to fail in both cases (inference from source).
- **Quarantine is stripped.** The extractor runs `xattr -r -d com.apple.quarantine` on
  bundles it installs (`extractor/main.zig:1584`, `:2046-2052`). For what the flag
  governs, see
  [Quarantine and Gatekeeper](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#quarantine-and-gatekeeper).
- **First launch briefly needs disk space for two copies:** the compressed app inside
  the wrapper and the extracted inner app.

### Bundle Size

The current README and docs make no numeric size claim.
Component sizes for macOS arm64, from the v2.0.6 and Bun 1.4.4 release assets and the
2.0 changelog’s size table (`docs/…/guides/changelog/v2-x.mdx`):

| Component | Size | Notes |
| --- | --- | --- |
| Electrobun core devkit (launcher, extractor, native wrapper, tools) | 6.8 MB compressed | `electrobun-core-darwin-arm64.tar.gz`, v2.0.6 (7.3 MB for x64) |
| Bun 1.4.4 (the bundled version) | 40.3 MB zipped | `bun-darwin-aarch64.zip`; extracted size not measured here |
| Bun 1.3.13 | 63.1 MB extracted | 2.0 changelog. On Linux and Windows it is 101–118 MB, which the maintainer attributes to ICU data that macOS provides as a system library. |
| Cottontail 0.2.3 | 57.7 MB extracted | 2.0 changelog |
| CEF 156.0.7 | 147.7 MB compressed | `electrobun-cef-darwin-arm64.tar.gz`, v2.0.6 (156.4 MB for x64) |

So a Bun-main-process app with the system WKWebView carries roughly 60–70 MB of runtime
before any app code, and about 150 MB more compressed with CEF. These totals are
estimates from component sizes, not a measured app.
The maintainer attributes most of the runtime’s size to JavaScriptCore and its JIT
([#599](https://github.com/blackboardsh/electrobun/issues/599)). A Zig, Rust, Go, or
Odin main process avoids the JavaScript runtime.

If you are choosing Electrobun for size, measure your own built DMG and installed app,
and remember that a Linux build following the project’s CEF recommendation carries
Chromium anyway.

### The Updater Checks Integrity, Not Authenticity

**What it does.** The `Updater` API applies bsdiff patches named after the previous
bundle hash, so an app several releases behind follows a patch trail; it falls back to
the full `.tar.zst` when a patch is missing or fails.
Patch output and full downloads stream into a staged app, which replaces the installed
one with rollback if the replacement fails.
Windows applies updates after exit through Task Scheduler.
It runs only when app code calls it: nothing in the SDK checks for updates on its own
(no callers outside `Updater.ts`).

**What 2.0.6 verifies:**

- **Transport.** HTTPS is mandatory except for loopback HTTP in local development: for
  the base URL (`package/src/sdks/main/core/Updater.ts:2235-2242`), for every download
  (`package/src/extractor/prepare_update_http.zig:13-33`), and for redirects, which
  cannot downgrade from HTTPS and, on loopback, must keep the same host and port
  (`prepare_update_http.zig:117-136`). Before 2.0.6 the updater fetched whatever scheme
  the base URL used.
- **Manifest identity.** The manifest’s identifier, channel, platform, and architecture
  must match the app, and its version and hash must be well-formed
  (`Updater.ts:438-482`).
- **An optional archive digest.** `artifact.tarSha256` and `artifact.tarSize` describe
  the uncompressed tar and are validated only if present (`Updater.ts:484-498`). The
  updater first requests `*-update-v2.json` and, **on a 404, falls back to the legacy
  `*-update.json`, which carries no digest** (`Updater.ts:1814-1830`, commented “only
  absence permits legacy use”); only the v2 document must carry one
  (`Updater.ts:1848-1850`).
- **When the digest is checked.** After the archive has been streamed, decompressed
  (with zstd frame checksums disabled, `prepare_update.zig:544`), and extracted into the
  staging folder: `validateFinal()` compares size and digest against the reconstructed
  tar (`package/src/extractor/prepare_update.zig:473-477`, called at `:520` for patch
  chains and `:558` for full downloads).
  The extractor therefore parses unverified input before any check.

**What it does not verify:**

- **No signature of any kind.** Searching `Updater.ts` and `package/src/extractor/` for
  `ed25519`, `ecdsa`, `rsa`, `publickey`, `minisign`, `signify`, `gpg`, `pgp`,
  `verifySignature`, `SecStaticCode`, `SecRequirement`, `codesign`, and `spctl` finds
  only test URLs, a Windows manifest `publicKeyToken`, and comments about preserving
  signatures. There is no key compiled into the app, no key path, and no algorithm.
- **The digest authenticates nothing.** It comes from the same unauthenticated host as
  the payload, so whoever controls the host serves a matching digest, or none.
  The project’s own docs agree: the digest “is not a signature of the manifest”
  (`docs/…/guides/updates.mdx:72-76`).
- **No code-signature or Team ID check of the staged app.** On macOS the apply step
  strips quarantine from the staged bundle (`extractor/main.zig:7437`), then compares
  only `Resources/version.json` *inside the downloaded payload* against values that came
  from the manifest (`validateApplyUpdateBundleIdentity()`, `:7094`, called at
  `:7440-7445`), then swaps.
  Nothing runs `codesign --verify` or compares the staged app’s Team ID with the
  installed one. The docs advise signing apps “with the platform’s normal code-signing
  system when authenticity is required,” but the updater never checks that signature.
  For what removing the quarantine flag does and does not change, see
  [Quarantine and Gatekeeper](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#quarantine-and-gatekeeper).

Evidence permalinks:
[the manifest fallback](https://github.com/blackboardsh/electrobun/blob/v2.0.6/package/src/sdks/main/core/Updater.ts#L1814-L1850),
[the digest check](https://github.com/blackboardsh/electrobun/blob/v2.0.6/package/src/extractor/prepare_update.zig#L473-L477),
[the macOS apply step](https://github.com/blackboardsh/electrobun/blob/v2.0.6/package/src/extractor/main.zig#L7425-L7445).

The consequence is direct.
Anyone who can publish to your update host—a compromised bucket, CDN, or account—can
execute arbitrary code on every installed copy.
HTTPS since 2.0.6 closes the network path, not the host path.
For comparison, Squirrel.Mac refuses an update that does not satisfy the running app’s
code-signing requirement, Sparkle requires an EdDSA signature made with a key you hold,
and Tauri’s updater requires a signature verified against a public key in the app.

**On `main` after 2.0.6 (unreleased), the manifest format changed twice in four days.**
Commit `dd47ea3b` (2026-11-06) dropped the v2 manifest and put the digest fields into
`*-update.json`; commit `2947a5f5` (2026-11-08) moved them to a hash-named sidecar,
`<channel>-<os>-<arch>-<hash>-checksum.json`, after the first change broke updates for
installed clients whose parsers reject unknown fields.
A 404 on the sidecar still proceeds without a digest.
The unreleased Managed Deploys service (commit `504139fa`, below) publishes through
Blackboard’s hosted API and adds no signing step.
Recheck all of this at the next stable release.

**If you ship Electrobun today, do not call the updater, and distribute updates through
a channel that verifies authenticity.** The unreleased `release.updateAuthority` option
(`"direct" | "external" | "none"`, on `main`) disables it explicitly.

### Code Signing

| Platform | State |
| --- | --- |
| **macOS** | Implemented in Hutch, which is open source, so the behavior is auditable. Release builds (`canary` or `stable`, never `dev`) with `build.mac.codesign: true` sign with `ELECTROBUN_DEVELOPER_ID`, a Developer ID Application identity. Every Mach-O and nested `.app`, `.framework`, `.bundle`, `.xpc`, or `.appex` is signed deepest first with `codesign --force --timestamp --options runtime`, so **the hardened runtime is always on**; then the outer bundle; then `codesign --verify --deep --strict` runs (`hutch/src/electrobun.zig:2197-2295`, `:2530-2555`). With `notarize: true` Hutch runs `xcrun notarytool submit --wait`, then `stapler staple` and `stapler validate` (`:2575-2675`). Both options default to `false`. |
| **Windows** | **No code signing.** “Windows release signing is not currently part of Hutch’s packaging pipeline” (`docs/…/guides/code-signing.mdx`). Binaries ship unsigned, which means SmartScreen warnings and no trust chain. |
| **Linux** | No GPG signing and no repository integration. |

macOS details that affect a shipping app:

- **Default entitlements.** Hutch merges three defaults into your `mac.entitlements`:
  `com.apple.security.cs.allow-jit`,
  `com.apple.security.cs.allow-unsigned-executable-memory`, and
  `com.apple.security.cs.disable-library-validation`
  (`hutch/src/electrobun_cli/load_config_helper.js:45-49`, deep-merged at `:97-118`).
  They stay unless you set them to `false`. One entitlements file applies to every
  executable Mach-O except `.dylib`, `.node`, and framework contents
  (`hutch/src/electrobun.zig:2499-2503`), to nested `.app` bundles, and to the outer
  bundle.
- **`Info.plist` gaps.** The generated plist (`hutch/src/electrobun.zig:8039-8102`)
  writes `CFBundleExecutable` (`launcher`), the identifier, name, `CFBundleVersion`
  (from `app.version`), icon, usage descriptions, URL types, and document types.
  It writes **no `CFBundleShortVersionString`**, the user-visible version that Finder,
  the About panel, and update frameworks such as Sparkle display, and **no
  `LSMinimumSystemVersion`**, so Finder cannot tell a macOS 13 user that the app needs a
  newer system. The config cannot add arbitrary keys.
  The `postBuild` hook runs after the inner app’s plist is written and before it is
  signed (`hutch/src/electrobun.zig:5313`, `:5417-5419`, `:1137-1143`), and `postWrap`
  does the same for the wrapper (`:1912`, `:1098`, `:2689-2694`), so both can patch the
  keys in (read from source; not tested).
- **macOS 14 is the floor** on both architectures (`package/scripts/macos-release.js:1`,
  passed as `-mmacosx-version-min`). Issue
  [#597](https://github.com/blackboardsh/electrobun/issues/597) asks whether it could be
  13.0; it is unanswered.
- **Notarization credentials.** Hutch accepts an App Store Connect API key
  (`ELECTROBUN_APPLEAPIKEYPATH`, `ELECTROBUN_APPLEAPIKEY`, `ELECTROBUN_APPLEAPIISSUER`)
  or an Apple ID with an app-specific password (`ELECTROBUN_APPLEID`,
  `ELECTROBUN_APPLEIDPASS`, `ELECTROBUN_TEAMID`). The Apple ID path passes the password
  on the `notarytool` command line (`hutch/src/electrobun.zig:2622-2631`), where other
  processes of the same user can read it; this is open issue #515 (open since
  2026-08-04). Use the API key.

The Windows position is the sharpest practical problem after the updater: an unsigned
Windows binary is an immediate friction point for any non-technical audience.

### Runtime Dependencies

Windows assumes the Evergreen WebView2 runtime is already installed and **bundles no
bootstrapper** (no reference in Hutch 0.29.0 or the docs).
On a machine without it, the app does not run.
Linux requires GTK3, WebKitGTK 4.1, Ayatana AppIndicator, and librsvg.

### Build-Time Supply Chain

Most of what ends up in an Electrobun app never passes through your npm lockfile or a
release-age gate:

- **The npm package is a 47 KB bootstrap.** `electrobun` on npm has no dependencies and
  no install scripts (`npm/electrobun/package.json`); your lockfile pins only it.
  On first use it downloads `hutch-artifacts.json` and the Hutch archive from the
  same-version GitHub release and checks size and SHA-256 against that index
  (`npm/electrobun/bin/resolve-hutch.cjs:1199-1222`): a consistency check against the
  same origin, not a pin in your repository.
  The initializer also installs a global Hutch launcher, and the documented direct
  install is `curl … | sh`.
- **Hutch verifies the core devkit and CEF archives** against
  `electrobun-artifacts.json` from the same release.
  GitHub releases are mutable (`"immutable": false` for v2.0.4, v2.0.5, and v2.0.6), so
  whoever controls the release can replace an archive and its index together.
- **Hutch downloads the Bun binary it ships inside your app without a pinned digest.**
  It fetches `https://github.com/oven-sh/bun/releases/download/bun-v{version}/…` and
  checks only that the executable reports the expected version
  (`hutch/src/toolchain_store.zig:250-262`, `:530-535`; no SHA-256 anywhere in that
  file). The Zig, Rust, Go, and Odin toolchains are fetched the same way.
  That binary is outside your lockfile and your cool-off.
  Bun publishes a `SHASUMS256.txt` with a detached signature (`SHASUMS256.txt.asc`) in
  each release, which you can use to pin it yourself (see
  [If You Adopt It](#if-you-adopt-it)).
- **Hutch’s default resolver uses its own lockfile.** Without a `packageManager`
  selection, Hutch installs `package.json` dependencies into `hutch.lock`, ignores any
  other lockfile, and never runs lifecycle scripts (`hutch/src/main.zig:54-57`). It
  reads `minimumReleaseAge` from `bunfig.toml` and accepts `--minimum-release-age` in
  seconds (`hutch/src/package_manager/support/options/bunfig.zig:35-58`), so a cool-off
  can be set there (read from source; not tested).
  Setting `packageManager` to `npm`, `pnpm`, `bun`, or `yarn` in `hutch.config.ts` keeps
  your existing lockfile and gate.
- **The Electrobun version floats unless pinned.** npm-launched commands use the npm
  package’s paired release, but a direct Hutch project follows its release channel
  between explicit syncs unless `hutch.config.ts` sets `electrobun.version`
  (`docs/…/guides/changelog/v2-x.mdx`).

* * *

## 6. Native Integration Gaps

As of 2.0.6 none of these has a workaround inside the framework:

- **File associations always export an app-specific type.** `app.fileAssociations`
  writes `CFBundleDocumentTypes` plus a `UTExportedTypeDeclarations` entry conforming to
  `public.data`, built from your bundle identifier and the extension
  (`hutch/src/electrobun.zig:8206-8275`). An app therefore cannot register for an
  existing type such as `net.daringfireball.markdown`, and Finder will not offer it
  under Open With ([#551](https://github.com/blackboardsh/electrobun/issues/551), open
  since 2026-09-09).
- **A webview can freeze after sleep with no recovery hook.** After some sleep and wake
  cycles the WKWebView’s WebContent-to-Networking IPC dies: input is dead and fetches
  never resolve, and only a relaunch recovers
  ([#550](https://github.com/blackboardsh/electrobun/issues/550), open since
  2026-09-09). Electrobun has no wake event (application events are `open-url`,
  `reopen`, `before-quit`, and menu clicks), no `webViewWebContentProcessDidTerminate:`
  handler in `nativeWrapper.mm`, and no API to recycle a web process.
- **No single-instance API** (no match for single-instance patterns in the source or
  docs). LaunchServices normally keeps one instance per bundle for Finder and `open`, but
  `open -n` bypasses that, and the first-launch handoff uses `open -n`.
- **Deep links** work through `app.urlSchemes` (`CFBundleURLTypes`) and arrive as
  `open-url` events, but on macOS registration requires the app to be in `/Applications`
  (`package/src/config/ElectrobunConfig.ts:74`).
- **Argument forwarding on Linux and Windows** is still a feature request
  ([#483](https://github.com/blackboardsh/electrobun/issues/483)).

* * *

## 7. What Shipping Apps Actually Do

The ecosystem is real but small.
In August 2026 roughly 200 repositories appeared in the dependents graph, but most were
single-star experiments; about a dozen were maintained, non-trivial open-source
applications. Star counts and declared versions below were observed 2026-11-08.

| Project | Stars | Electrobun | Why it is worth reading |
| --- | --- | --- | --- |
| [Dash](https://electrobun.dev/dash/) | n/a | not public | Blackboard’s own product (closed source); the README says “Dash itself is built with Electrobun.” It succeeds [co(lab)](https://github.com/blackboardsh/colab), now archived. |
| [llm-space](https://github.com/deer-flow/llm-space) | 2.1k | `^1.18.1` | Largest community app. Monorepo structure, React. |
| [dev-3.0](https://github.com/h0x91b/dev-3.0) | 329 | `1.18.1` | Parallel AI coding agent control panel; React 19, terminal embedding. |
| [guerillaglass](https://github.com/okikeSolutions/guerillaglass) | 10 | `2.0.6` | **The best sidecar reference**, and the only surveyed app on 2.x: Swift sidecars on macOS plus Rust sidecars cross-platform, with `packageManager: "bun"` in `hutch.config.ts`. |
| [spectrum](https://github.com/fmsouza/spectrum) | 6 | `^1.18.1` | **Signed and notarized macOS releases**—the clearest worked example of shipping, on 1.x. |
| [MaplatEditor](https://github.com/code4history/MaplatEditor) | 19 | `^1.18.1` | An in-progress migration from Electron; useful for seeing what does and does not port. |

Patterns that recur across these projects:

- **Four of the five public apps still declare 1.18.x**, eleven weeks after the first
  2.x stable release. The 2.x move to Hutch, `hutch.config.ts`, and runtime selection is
  a real migration, not a version bump.
- **React plus Tailwind plus Vite**, with Vite output mapped in through `build.copy`.
  The official templates offer Vue, Svelte, Solid, and Angular, but the community
  converged on React.
- **`bundleCEF: false`** on macOS and Windows, relying on system webviews.
- **Developer and AI tooling dominates.** Almost every non-trivial app is a developer
  tool, which reflects the early-adopter audience rather than a limitation of the
  framework.
- **macOS-first.** Several projects are macOS-only, and cross-platform support in
  practice trails the matrix on paper.

No widely recognised consumer product has been publicly identified as built on
Electrobun.

* * *

## 8. Maturity and Risk

For Electrobun, unlike Electron or Tauri, project risk is a first-order engineering
consideration rather than a footnote.
Figures below were observed 2026-11-08 through the GitHub REST and search APIs and the
npm registry.

**Signals of genuine capability.**

- 13,045 GitHub stars and 381 forks.
- Substantial native engineering: a Zig core of about 4,600 lines, an Objective-C++
  macOS wrapper of about 11,700, C++ wrappers for Windows and Linux, and working CEF
  integration with per-platform linking.
- The typed RPC design is cleaner than Electron’s IPC.
- Testing is serious for a project this size: the 2.0 changelog cites about 1,800
  first-party tests and Kitchen Sink scenarios plus 8,460 Node and Bun compatibility
  test files, and release validation since 2.0.5 covers all six platform targets,
  including macOS signing and notarization.
- The docs include a hand-written changelog with a page for each stable release since
  1.0.0 and an `unreleased.mdx` page that tracks `main`.

**Signals of risk.**

- **Bus factor of one.** All 481 commits on `main` between 2026-08-16 and 2026-11-08 are
  by `YoavCodes`, with no co-author trailers; all-time, that account has 2,684
  contributions and the next contributor 24. Hutch’s 380 commits are all by the same
  account, and npm lists one maintainer.
  No pull request was merged in that period; 25 are open and 1 was closed unmerged.
  `CONTRIBUTING.md:27` says the maintainer will “ruthlessly close PRs” that cost more to
  review than they are worth, without explanation.
- **Issue flow.** 135 open and 274 closed overall; between 2026-08-16 and 2026-11-08, 54
  were opened and 5 closed.
  Most historical closures came from one bulk pass: the 2.0 reconciliation “resolved 138
  issues and 47 pull requests” (`changelog/v2-x.mdx`).
- **No security process.** No `SECURITY.md`, private vulnerability reporting disabled
  (`{"enabled":false}`), and no published advisories.
  [#515](https://github.com/blackboardsh/electrobun/issues/515) (since 2026-08-04) and
  [#518](https://github.com/blackboardsh/electrobun/issues/518) (since 2026-08-09) have
  no maintainer comment, and the code each describes is unchanged in 2.0.6 and Hutch
  0.29.0.
- **Long-open platform bugs**, including a Windows Dev Drive crash
  ([#490](https://github.com/blackboardsh/electrobun/issues/490)), white bands during
  Windows resize ([#484](https://github.com/blackboardsh/electrobun/issues/484)), and
  eager binding of macOS-only FFI symbols that breaks a Bun main process elsewhere
  ([#520](https://github.com/blackboardsh/electrobun/issues/520)), all open since July
  or August 2026.
- **Churn in fundamentals.** The default runtime went from Bun-only (1.x) to Cottontail
  (2.0.1, 2026-08-22) to Bun (2.0.4, 2026-10-18). The 2.0 line moved the build to Hutch
  and split configuration across two files.
  On `main`, the update-manifest format changed twice in the four days after 2.0.6, the
  second time to repair a preview change that had broken updates for installed clients.
- **Version numbers carry no contract.** npm went from `0.13.0-beta.26` to
  `1.0.0-beta.0` on the same day (2026-01-28), the first non-prerelease 1.x on npm is
  1.12.1 (2026-02-08), and there is no 2.0.0 or 2.0.3 stable.
  Majors mark feature milestones, not API stability.
- **Documentation trails the source**, including on the runtime default.
- **Scope is growing into hosted services.** The unreleased 2.0.7 line (commit
  `504139fa`, 2026-11-07) adds Managed Deploys, staged upload and publication of update
  artifacts through Blackboard’s hosted Dash service, and Electrobun Insights, analytics
  built into the native core with a persistent installation ID. Insights is off by
  default (`insights.enabled` defaults to `false`).
- **The maintainer’s surface keeps widening:** a Bun fork (`blackboardsh/bun`),
  Cottontail, Hutch with its own package manager, a native GPU UI engine (2.0.6), and
  the hosted services.
  `CONTRIBUTING.md:5` calls Electrobun “10% of the vision.”

None of this says the project is bad.
It says the risk profile is that of an early-stage single-maintainer project, and it
should be evaluated on those terms rather than on its star count.

* * *

## Best Practices

- [ ] Pin an exact version in `package.json`, pin `electrobun.version` in
  `hutch.config.ts`, and keep the `// @hutch` pragma consistent.
  Semver gives you no protection here.
- [ ] Apply the 14-day cool-off, and follow
  [Choosing a Version Under a Cool-Off](#choosing-a-version-under-a-cool-off) when the
  release outside the window lacks a fix you need.
- [ ] Read the changelog page and the diff before upgrading.
- [ ] Verify config-schema questions against the templates at your tag, not the
  published docs.
- [ ] Set `build.mainProcess` explicitly.
- [ ] Keep the RPC surface narrow and named; validate every payload in the main process.
- [ ] Use `sandbox: true` for every view that needs no RPC.
- [ ] Never load remote or untrusted content into an RPC-enabled webview.
- [ ] Set a CSP explicitly; the framework provides none.
- [ ] Use navigation rules to pin the app to `views://`.
- [ ] **Do not call the built-in updater** unless you have verified that it checks a
  signature against a key compiled into the app.
- [ ] Pin the Bun binary with a digest you record (see
  [If You Adopt It](#if-you-adopt-it)).
- [ ] Notarize with an App Store Connect API key, not an Apple ID.
- [ ] Set every entitlement explicitly, including `false` for defaults you do not need.
- [ ] Add `CFBundleShortVersionString` and `LSMinimumSystemVersion` in `postBuild` and
  `postWrap`.
- [ ] Test the artifact users get: install from the DMG, first launch, launch from the
  mounted DMG and from a quarantined download, and sleep and wake.
- [ ] Measure your real bundle size rather than citing a headline figure.
- [ ] On Windows, expect unsigned binaries and plan for SmartScreen friction.
- [ ] Confirm the Evergreen WebView2 runtime is present on target Windows machines.
- [ ] Test on every platform you ship; the support matrix changes between releases.

* * *

## Open Research Questions

1. **Will the updater gain authenticity checks, and when?** A signature verified against
   a key compiled into the app, or a code-signature and Team ID comparison of the staged
   bundle, would change the public-distribution recommendation.
   Recheck `Updater.ts` and `package/src/extractor/` on every upgrade.

2. **Does the self-extracting wrapper work from a read-only DMG or a translocated path,
   and can the inner app ship without it?** Neither is a documented mode; both are
   untested here.

3. **Can Sparkle be integrated?** The `NSApplication` lives in the main process behind
   `libNativeWrapper`, and Electrobun has no hook for loading an Objective-C framework
   there; it would likely need FFI or a native main process (unverified).

4. **How large is a real app on Bun 1.4.4?** The extracted size of Bun 1.4.4 and of a
   complete built app were not measured here.

5. **Will Hutch pin toolchain digests?** Today it checks only the reported version.

6. **How stable are the runtime default and the update-manifest format?** Both changed
   repeatedly in the three months before this research.

* * *

## Recommendations

### When Electrobun Is a Reasonable Choice

- Internal tools and prototypes where you control distribution and can update out of
  band.
- Apps for a technical, trusted audience, shipped without the built-in updater.
- Cross-platform apps that want one TypeScript main process on macOS, Windows, and Linux
  with typed RPC, and can absorb churn.
- Cases where bundle size dominates and you have measured that Electrobun delivers it
  for your app.

### When to Choose Something Else

- **Anything security-sensitive**, because of the update path, the absent context
  isolation, and the sandbox and RPC exclusivity.
- **Consumer software distributed at scale**, where unsigned Windows binaries, a
  self-extracting first launch, and an updater without authenticity checks are not
  acceptable.
- **Long-lived products with small teams**, where a bus factor of one in a core
  dependency is a real risk.
- **Linux-first products**, where you lose the size advantage to CEF and get no
  package-manager integration.
- **macOS-only apps that put a native window around a web UI**, such as the UI of a
  local server. A hand-written AppKit plus WKWebView shell in Swift carries no JavaScript
  runtime and no self-extracting wrapper, installs as a plain notarized `.app`, and
  gives direct access to what Electrobun lacks: Sparkle updates, registration for
  existing document types through `application(_:open:)`,
  `webViewWebContentProcessDidTerminate(_:)` and wake handling, and a deployment target
  you choose. See `tbd guidelines macos-webview-shell-patterns`.

Choose **Electron** when you need maturity, ecosystem, signing and update
infrastructure, and a security model with real defaults; see
`tbd guidelines electron-app-development-patterns`. Choose **Tauri** when you want a
small bundle with a multi-maintainer project and an update path that verifies what it
installs; see `tbd guidelines tauri-app-development-patterns`.

### Public Distribution

**Keep Electrobun eliminated for software distributed to the public.** Revisit only when
both of these hold:

- Updates carry a signature verified against a key compiled into the app, or the updater
  verifies the staged bundle’s code signature and Team ID against the installed app.
- The contributor base broadens: merged outside pull requests, a second maintainer with
  release access, and private vulnerability reporting enabled.

HTTPS-only updates and an auditable, open-source signing pipeline are real improvements,
but neither addresses who can publish an update.

### Choosing a Version Under a Cool-Off

`tbd guidelines supply-chain-hardening` forbids installing a version younger than 14
days without a recorded exception that a human signs off.
For Electrobun that rule can leave you on a release that lacks a fix you need.
As observed 2026-11-08, a release is eligible if its UTC publish date is on or before
2026-10-25:

| Release | Published | Age | Cool-off | Changes relevant to this choice |
| --- | --- | --- | --- | --- |
| 2.0.6 | 2026-11-04 | 4 days | Eligible from 2026-11-18 | HTTPS-only updater and optional archive digest; macOS native bridge restricted to the main frame; new native UI engine. |
| 2.0.5 | 2026-10-26 | 13 days | Eligible from 2026-11-09 | Bun 1.4.4, which rejects certificate chains containing the compromised eMudhra and emSign keys ([oven-sh/bun#46300](https://github.com/oven-sh/bun/pull/46300)); matching TLS fixes in Hutch 0.28.2’s download client and in Cottontail; Intel Macs. |
| 2.0.4 | 2026-10-18 | 21 days | Eligible | Bun default; bundles Bun 1.4.0 and Hutch 0.28.1; the updater accepts plain-HTTP update hosts and carries no archive digest. |

The tension: 2.0.4, the newest stable outside the window, predates both the HTTPS-only
updater and the certificate-revocation fix.
Its Bun main process trusts chains containing the compromised keys, and its Hutch
downloads toolchains with the same gap.

The recommendation:

- **Do not ship 2.0.4 to users.** The certificate fix applies to every app whose Bun
  main process makes outbound TLS connections, and to every build that downloads
  toolchains. Pin 2.0.5 once it clears the window, or take it now under a recorded
  exception that cites the certificate compromise.
- **Do not take 2.0.6 early for the updater hardening.** It matters only if you call the
  built-in updater, which this guideline recommends against.
  Move to 2.0.6 when it clears, or earlier under an exception if your app embeds frames
  and needs the main-frame bridge restriction.
- **2.0.4 is acceptable** only for local prototypes whose main process makes no outbound
  TLS connections and that never use the updater.
- **The general rule for later releases:** when the newest release outside the window
  lacks a security fix that applies to your app, take a recorded exception for the
  oldest release that has the fix, rather than shipping the known-vulnerable one or
  jumping to the newest.

### If You Adopt It

1. **Pin everything exactly**: `electrobun` in `package.json` (no range),
   `electrobun.version` in `hutch.config.ts`, and `build.mainProcess`.
2. **Skip the built-in updater.** Never call the `Updater` APIs; nothing checks for
   updates unless your code does.
   On a release that has `release.updateAuthority`, set it to `"external"`.
3. **Ship updates through an external signed channel**: Sparkle with EdDSA-signed update
   archives, which also checks the update’s Apple code signature, or a notarized
   [Homebrew cask](https://docs.brew.sh/Cask-Cookbook).
   Neither is tested with the self-extracting wrapper.
   A cask installs the wrapper and the first launch swaps in the inner app, so its `zap`
   stanza must also remove `~/Library/Application Support/<identifier>` (inference from
   source); Sparkle has no integration path yet (see
   [Open Research Questions](#open-research-questions)).
4. **Verify Bun before Hutch can execute it.** Verify Bun’s signed checksum file using a
   trusted release key, then verify each target archive against its recorded SHA-256.
   Provision Hutch with that verified runtime in an isolated build and confirm that it
   does not fetch or execute an unchecked replacement.
   If the pinned Hutch version cannot enforce that, isolate the build from signing
   credentials and verify the artifact independently before promoting it to a separate
   signing step.
   [Hutch’s hook runner](https://github.com/blackboardsh/hutch/blob/v0.29.0/src/electrobun.zig#L5644-L5655)
   executes `postBuild` through Bun, so a check in that hook is only an artifact check.
   Pin `build.bun.version` as well; a version pin alone does not verify the download.
5. **Notarize with an App Store Connect API key**, and keep it out of shell profiles.
6. **Set entitlements explicitly**, writing `false` for any of the three defaults your
   app does not need, and test the signed build.
7. **Patch `Info.plist`** in `postBuild` (inner app) and `postWrap` (wrapper) to add
   `CFBundleShortVersionString` and `LSMinimumSystemVersion` `14.0`.
8. **Use `sandbox: true` wherever you can**, keep the RPC surface minimal, and never
   load remote content into an RPC view.
9. **Accept unsigned Windows binaries** or exclude Windows, and budget time for
   platform-specific bugs that a larger project would have found already.

* * *

## References

### Official

- [Electrobun documentation](https://docs.electrobun.dev/electrobun/)
- [Changelog](https://docs.electrobun.dev/electrobun/guides/changelog/)
- [Architecture overview](https://docs.electrobun.dev/electrobun/guides/architecture/overview/)
- [Build configuration](https://docs.electrobun.dev/electrobun/apis/cli/build-configuration/)
- [Updates](https://docs.electrobun.dev/electrobun/guides/updates/)
- [Code signing](https://docs.electrobun.dev/electrobun/guides/code-signing/)
- [Electrobun source](https://github.com/blackboardsh/electrobun) and
  [v2.0.6 tag](https://github.com/blackboardsh/electrobun/tree/v2.0.6)
- [Hutch source](https://github.com/blackboardsh/hutch) and
  [v0.29.0 tag](https://github.com/blackboardsh/hutch/tree/v0.29.0)
- [v1 announcement](https://blackboard.sh/blog/electrobun-v1/)

### Issues Cited

- [#140: isolated world support for preload scripts](https://github.com/blackboardsh/electrobun/issues/140)
- [#483: argv passing on Linux and Windows](https://github.com/blackboardsh/electrobun/issues/483)
- [#484: Windows white bands during resize](https://github.com/blackboardsh/electrobun/issues/484)
- [#490: Windows Dev Drive path corruption crash](https://github.com/blackboardsh/electrobun/issues/490)
- [#515: code signing setup exposes a personal Apple ID credential](https://github.com/blackboardsh/electrobun/issues/515)
- [#518: RPC WebSocket transport hardening](https://github.com/blackboardsh/electrobun/issues/518)
- [#520: Bun FFI eager symbol binding breaks non-macOS loading](https://github.com/blackboardsh/electrobun/issues/520)
- [#540: first-launch self-extraction loses direct process invocation](https://github.com/blackboardsh/electrobun/issues/540)
- [#550: macOS webview freezes after sleep](https://github.com/blackboardsh/electrobun/issues/550)
- [#551: file associations cannot use an existing UTI](https://github.com/blackboardsh/electrobun/issues/551)
- [#560: Intel Mac builds restored (closed)](https://github.com/blackboardsh/electrobun/issues/560)
- [#589: macOS cookies drop httpOnly and ignore sameSite](https://github.com/blackboardsh/electrobun/issues/589)
- [#597: macOS deployment target 14.0](https://github.com/blackboardsh/electrobun/issues/597)
- [#599: size of the bundled Bun runtime](https://github.com/blackboardsh/electrobun/issues/599)

### Commits Cited (Unreleased, on `main`)

- [`dd47ea3b`: one update manifest with optional archive integrity](https://github.com/blackboardsh/electrobun/commit/dd47ea3b)
- [`2947a5f5`: checksum sidecars](https://github.com/blackboardsh/electrobun/commit/2947a5f5)
- [`504139fa`: managed updates and Insights](https://github.com/blackboardsh/electrobun/commit/504139fa)
- [`575df99d`: Linux WebKit bridge restricted to the top frame](https://github.com/blackboardsh/electrobun/commit/575df99d)

### Projects Surveyed

- [Dash](https://electrobun.dev/dash/), [co(lab)](https://github.com/blackboardsh/colab)
  (archived), [llm-space](https://github.com/deer-flow/llm-space),
  [dev-3.0](https://github.com/h0x91b/dev-3.0),
  [guerillaglass](https://github.com/okikeSolutions/guerillaglass),
  [spectrum](https://github.com/fmsouza/spectrum),
  [MaplatEditor](https://github.com/code4history/MaplatEditor)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
