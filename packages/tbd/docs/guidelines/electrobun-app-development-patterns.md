---
title: Electrobun App Development Patterns
description: Building desktop apps with Electrobun—runtime and process model, typed RPC, project layout, packaging and the delta updater, plus an evidence-based maturity and security assessment
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: desktop
---
# Electrobun App Development Patterns

**Last Updated**: 2026-08-16

**Related**:

- [Electrobun documentation](https://framework.blackboard.sh/electrobun/)
- [Electrobun source](https://github.com/blackboardsh/electrobun)
- [Companion: Electron App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electron-app-development-patterns.md)
- [Companion: Tauri App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/tauri-app-development-patterns.md)

* * *

## Updating This Document

Electrobun moves fast and its stable channel lags its development channel by months, so
version facts here go stale quickly.
Recheck the npm dist-tags and the open security issues before relying on anything below.

### Last Researched Versions

Observed 2026-08-16 by querying the npm registry and reading a clone of the repository
at `main`.

| Thing | Version | Check For Updates |
| --- | --- | --- |
| **electrobun (stable)** | 1.18.1 | [npmjs.com/package/electrobun](https://www.npmjs.com/package/electrobun)—`latest` published **2026-05-04**. |
| **electrobun (beta)** | 2.0.1-beta.14 | Same registry, `beta` tag—published **2026-08-15**. The 2.0 line adds multi-runtime main processes and decouples from Bun. There is no stable 2.0. |
| **Release cadence** | 296 versions since 2024-08-08 | Beta releases land most days; the stable tag moves every few months. **The two channels are roughly 3.5 months apart.** |
| **Bundled Bun** | 1.3.13 | `package/src/shared/bun-version.ts`—only relevant when `mainProcess: "bun"`. |
| **Bundled CEF** | 147.0.10+chromium-147.0.7727.118 | `package/src/shared/cef-version.ts`—shipped as a separate tarball, downloaded only when `bundleCEF` is set. |
| **macOS support** | 14+, arm64 only | `README.md`, `platform.ts`. x86_64 macOS is not supported ([#485](https://github.com/blackboardsh/electrobun/issues/485)). |
| **Windows support** | 11+, x64 only | `platform.ts:27` hardcodes `x64` for Windows; ARM64 runs only under emulation. Requires the Evergreen WebView2 runtime, which is **not** bundled. |
| **Linux support** | Ubuntu 24.04+ | Needs GTK3, WebKitGTK 4.1, Ayatana AppIndicator, librsvg. Other distributions are community-supported. |

### Reminders When Updating

1. **Recheck the two dist-tags first.** `latest` and `beta` diverge substantially, and
   which one you document changes the config schema (see
   [Project Layout and Configuration](#project-layout-and-configuration)).

2. **Recheck the open security issues**, particularly
   [#518](https://github.com/blackboardsh/electrobun/issues/518) (RPC transport) and
   [#515](https://github.com/blackboardsh/electrobun/issues/515) (signing credentials),
   and re-verify whether the updater has gained signature verification.
   That single question governs the recommendation in this document.

3. **Verify claims against source, not documentation.** The published docs currently
   describe a config schema that the templates on `main` no longer use.
   Treat the repository as authoritative.

4. **Recheck the platform matrix.** Architecture support is narrower than the marketing
   surface suggests and has been changing.

5. **Recheck whether a CHANGELOG exists.** As of this writing there is none, and release
   notes are auto-generated commit ranges, so upgrades require reading diffs.

* * *

## Executive Summary

Electrobun builds desktop apps from TypeScript with a native Zig core, system webviews,
and a typed RPC layer between the two.
It targets a much smaller bundle than Electron by not shipping Chromium, and it ships a
bsdiff-based delta updater.

**The headline for anyone arriving from older material: Electrobun is no longer a
Bun-first framework.** The `mainProcess` config option now selects among
`bun | cottontail | zig | rust | go | odin`, and the default is **cottontail**,
Electrobun’s own JavaScriptCore runtime.
The source states plainly that “Bun is an optional Electrobun application runtime.”
The maintainer has attributed the decoupling to Bun’s Zig-to-Rust core rewrite
destabilizing downstream FFI bindings.

Three findings determine whether you should use it, and all three are verifiable in the
repository:

- **The auto-updater verifies nothing.** There is no signature verification and no
  content-digest check of the downloaded payload anywhere in the client update path.
  Anyone able to serve or tamper with your update endpoint gets arbitrary code execution
  on every user’s machine.
  Details and the exact evidence are in [The Updater](#the-updater-verifies-nothing).

- **Sandboxing and IPC are mutually exclusive.** A sandboxed webview cannot use RPC at
  all, so the Electron posture of “sandboxed renderer talking over a narrow audited
  bridge” is not available.
  There is also no `contextIsolation` equivalent.

- **The bus factor is one.** Roughly 12,700 GitHub stars and genuine engineering depth,
  but effectively a single maintainer, 86 open issues against about a dozen closed, no
  CHANGELOG, and versioning that carries no semver signal.

**Recommendation in one line:** promising for internal tools, prototypes, and apps you
distribute to a trusted audience without auto-update; not currently a responsible choice
for a security-sensitive product or one shipped to the general public.
The full form is in [Recommendations](#recommendations).

**Research questions this document answers**:

1. What actually runs where in an Electrobun app, now that Bun is optional?
2. What does a minimal, correct project look like, and which config schema applies?
3. What is the real security boundary, and how does it compare to Electron’s?
4. What does it take to package, sign, and update an Electrobun app, and what is
   missing?

* * *

## 1. Architecture and Process Model

### The Layers

An Electrobun app is a stack of four things, verified by reading the repository:

| Layer | Implementation | Role |
| --- | --- | --- |
| **Launcher** | Zig binary (`launcher/main.zig`) | Reads `build.json`, selects and spawns the main-process runtime. On Linux sets `LD_LIBRARY_PATH` and, when CEF is present, `LD_PRELOAD`. On Windows uses `CreateProcessW` with `CREATE_NO_WINDOW`. |
| **Main process** | Cottontail (default), or Bun, Zig, Rust, Go, Odin | Runs your application code. Owns the native event loop through FFI. Full system access. |
| **Native core** | Zig (`core/main.zig`, ~4,100 lines) plus per-platform wrappers | Window and webview lifecycle, the WebSocket transport, thread-safe registries. Exposed over a C ABI. |
| **Webviews** | WKWebView (macOS), WebView2 (Windows), WebKitGTK (Linux), or bundled CEF | Your UI. Separate OS processes. |

The native wrappers are `nativeWrapper.mm` (Objective-C++) on macOS and
`nativeWrapper.cpp` (C++) on Windows and Linux, sharing 35-plus header-only C++
libraries. The TypeScript SDK reaches them through `bun:ffi`, binding over 100 symbols.

A detail worth knowing because it explains a class of bug: the main thread runs the
blocking native GUI event loop, while your application code runs in a **worker thread**.
Native callbacks therefore fire on a different thread from your JavaScript, which is why
every `JSCallback` is created with `threadsafe: true`, and why a 2ms delay still sits in
`preload/internalRpc.ts` labelled “work around Bun JSCallback threading issue.”

### Choosing a Main-Process Runtime

From `package/src/config/ElectrobunConfig.ts`:

```ts
mainProcess?: "bun" | "cottontail" | "zig" | "rust" | "go" | "odin";
```

**Cottontail is the default** and is what the templates use.
It is Electrobun’s own JavaScriptCore-based runtime.
Choose `bun` only if you specifically need Bun APIs; note that doing so ties you to
Bun’s FFI layer at a moment when Bun is rewriting its core.
The compiled-language options exist in the 2.0 line and replace the main process
entirely—they are not a sidecar mechanism.

### Webview Selection and the Linux Exception

Per platform you choose a system webview or bundled Chromium:

```ts
mac:   { bundleCEF: false },
linux: { bundleCEF: true },
win:   { bundleCEF: false },
```

macOS links CEF weakly and falls back to WebKit gracefully; Windows detects CEF at
runtime; **Linux ships two separate native binaries** (`libNativeWrapper.so` at ~1.46MB
for GTK, `libNativeWrapper_cef.so` at ~3.47MB for CEF) because Linux lacks reliable weak
linking.

The Linux case deserves attention because it undercuts the framework’s main selling
point. Electrobun’s own documentation recommends CEF over WebKitGTK on Linux, citing
WebKitGTK’s severe limitations, and the shipped `photo-booth` template does exactly
that.
Bundling CEF means bundling Chromium, which is the cost Electron is criticised for.
**On Linux you largely give up the size advantage**, or you accept a materially
different rendering engine from your other platforms.

* * *

## 2. Reference Architecture

### Project Layout and Configuration

```
my-app/
├── src/
│   ├── bun/
│   │   └── index.ts          # main process entry (despite the directory name)
│   └── mainview/
│       ├── index.ts          # webview entry
│       ├── index.html
│       └── index.css
└── electrobun.config.ts
```

The directory is conventionally `src/bun/` even when the runtime is Cottontail; that is
template convention, not a requirement.

**Which config schema applies depends on your channel, and this trips people up.** The
published build-configuration documentation describes `build.bun.entrypoint` and
`build.views`. The templates on `main` use a different shape.
This is the current form, taken verbatim from the `photo-booth` template:

```ts
import type { ElectrobunConfig } from 'electrobun';

export default {
  app: {
    name: 'photo-booth',
    identifier: 'photobooth.electrobun.dev',
    version: '0.0.1',
  },
  build: {
    mainProcess: 'cottontail',
    cottontail: { entrypoint: 'src/bun/index.ts' },
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
        'com.apple.security.device.camera': 'This app needs camera access to take photos',
      },
    },
    linux: { bundleCEF: true },
    win: { bundleCEF: false },
  },
} satisfies ElectrobunConfig;
```

Top-level keys are `app`, `build`, `runtime`, `scripts`, and `release`.

### Bringing Your Own Frontend Build

Electrobun bundles view code with Bun’s bundler, but you can run any frontend toolchain
and map its output in through `copy`. The React template does exactly this with Vite:

```ts
build: {
  mainProcess: 'cottontail',
  cottontail: { entrypoint: 'src/bun/index.ts' },
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

The main API surface is `BrowserWindow`, `BrowserView`, `Electroview` (browser side),
`Tray`, `ApplicationMenu`, `Utils`, and `Updater`.

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
        Utils.openExternal('https://framework.blackboard.sh/electrobun/');
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

Underneath, traffic runs over a **loopback WebSocket** (`ws://127.0.0.1:{random port}`)
encrypted per webview with AES-256-GCM, falling back to a native postMessage bridge on
Windows. Every webview also gets a built-in `evaluateJavascriptWithResponse` method.

### The Development Loop

`bunx electrobun init` scaffolds from one of roughly 31 official templates, then
`bun start` runs the app; the underlying CLI is Hutch.
DevTools are available through `webview.openDevTools()`, source maps come from the
bundler config, and the main process can be debugged with a standard inspector.

**There is no documented hot module replacement or hot reload.** Code changes require a
restart. If you are coming from electron-vite’s renderer HMR plus main-process
hot-restart, this is a real step down in iteration speed.

* * *

## 3. Attaching a Backend

Electrobun has **no documented sidecar mechanism and no equivalent of electron-builder’s
`extraResources`.** Nothing here is framework-supported; it is the pattern the community
has assembled.

The working approach has three parts:

1. **Place the binary** with `build.copy`, mapping it into the bundle like any other
   asset.
2. **Spawn it** with the runtime’s process API—`Bun.spawn()` when the main process is
   Bun.
3. **Resolve its path** at runtime through `RESOURCES_FOLDER`.

Bridge it with newline-delimited JSON over stdio, for the same reasons that apply in any
desktop app: no port to bind, nothing else on the machine can reach it, and it dies with
its parent. The
[Electron guideline’s backend section](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electron-app-development-patterns.md)
covers transport choice, loopback risk, and process lifecycle in depth; that analysis is
framework-independent and applies here unchanged.

Two Electrobun-specific cautions:

- **Signing nested binaries is unverifiable from source.** Signing lives inside the
  closed-source Hutch CLI, so you cannot audit how, or whether, it signs binaries you
  add to the bundle. Expect to debug notarization failures without being able to read the
  signing code.
- **The macOS bundle layout is unconventional.** Binaries live in `Contents/MacOS/` with
  a `Resources/` directory nested inside `MacOS/` rather than at the standard
  `Contents/Resources/`. If you have tooling or expectations built around Apple’s
  canonical layout, they will not transfer.

If your backend is a compiled language, consider instead making it the main process:
`mainProcess` accepts `zig`, `rust`, `go`, and `odin` in the 2.0 line, which avoids the
sidecar problem entirely at the cost of writing your window management in that language.

* * *

## 4. Security Baseline

This section is longer than the equivalent in the Electron guideline because Electrobun
does not ship a comparable set of defaults, and because **there is no security
documentation for the framework at all**. That absence is itself the most important
thing to know before choosing it.

### What Electrobun Gets Right

- **Webview code has no direct runtime access.** There is no ambient Bun, Node, or
  filesystem API in the page.
  The RPC surface is the only way out.
- **Webviews are separate OS processes**, so a renderer crash does not take the app
  down.
- **RPC traffic is encrypted** with AES-256-GCM, which matters given the transport is a
  loopback socket.
- **Navigation control exists** through glob-pattern URL rules.

### The Sandbox and RPC Are Mutually Exclusive

Two preload variants exist in the source.
The sandboxed one states its own limits:

> No RPC, NO encryption, NO webview tags … No RPC handlers — sandboxed webviews cannot
> communicate with Bun.

So the choice is binary.
A sandboxed webview is inert—lifecycle events and one-way emission only.
A webview that can talk to your application is not sandboxed.
**Electron’s default posture, a sandboxed renderer communicating over a narrow audited
bridge, has no equivalent here**, and sandboxing is opt-in rather than the default.

The practical consequence: cross-site scripting in an Electrobun webview yields the full
RPC surface, which in a typical app carries filesystem and OS access.
In Electron the same bug is contained by context isolation and a deliberately narrow
`contextBridge` surface.

### There Is No Context Isolation

Electron’s `contextIsolation` runs preload code in a separate JavaScript context so page
script cannot reach or overwrite the bridge.
Electrobun has no equivalent.
The preload globals `window.__electrobun` and `window.__electrobun_encrypt` are
reachable from page JavaScript and can be overwritten, which means the RPC encryption
key lives in a location the page can read.
The encryption protects the transport against other local processes; it does not protect
the bridge from the page itself.

Open issue [#518](https://github.com/blackboardsh/electrobun/issues/518) tracks further
transport weaknesses, including a 500MB payload cap and no authentication on the
WebSocket upgrade.

### Practical Rules

Given the above, the discipline has to come from your application rather than the
framework:

- **Never load remote or untrusted content into a webview that has RPC.** In Electron
  this is a strong recommendation; here it is closer to a hard requirement, because you
  have no second line of defence.
- **Keep the RPC surface narrow and specific**, exactly as you would a `contextBridge`
  surface: named capabilities, no generic pass-through, no method that takes an
  arbitrary path or command.
- **Validate every RPC payload** in the main process.
  The type contract is compile-time only; it guarantees nothing at runtime.
- **Set a Content-Security-Policy yourself.** The framework offers no guidance and no
  default.
- **Use navigation rules** to pin the app to its own `views://` origin.
- **Be deliberate about `bundleCEF`.** CEF and the system webviews have different
  security update cadences: system webviews are patched by the OS vendor, while bundled
  CEF is only as current as your last release.

* * *

## 5. Packaging and Distribution

### Build Output

The distributable is a **self-extracting binary**: a Zstandard-compressed tar with a Zig
extractor. Installation targets are `%LOCALAPPDATA%` on Windows and `~/.local/share/` on
Linux; on macOS it is a `.app` bundle.
An uncompressed tar is retained on disk to support future delta patching.

**On Linux the only output is a self-extracting archive.** There is no `.deb`, `.rpm`,
`.AppImage`, Flatpak, or Snap target, which means no package-manager integration and no
distribution through the channels Linux users expect.

### Bundle Size, Honestly

The advertised figure is roughly 12 to 14MB compressed with a system webview, against
Electron’s much larger baseline.
That number is real but describes a minimal app, compressed.
Independent measurements of a React application land closer to **64.5MB on disk**, and
the same discrepancy came up repeatedly in public discussion of the v1 release.

If you are choosing Electrobun for size, measure your own app rather than trusting the
headline, and remember that a Linux build following the project’s own CEF recommendation
carries Chromium anyway.

### The Updater Verifies Nothing

Electrobun ships a bsdiff-based delta updater: patches are generated against the
immediately preceding version, with a full `.tar.zst` fallback, and Windows applies
post-exit updates through Task Scheduler.

**It performs no verification of what it installs.** This is verifiable directly:

- Searching `Updater.ts` and `extractor/main.zig` for `ed25519`, `rsa`, `publickey`,
  `verifySignature`, `minisign`, `signify`, `gpg`, and `pgp` returns **no signature
  verification of any kind**.
- The only `createHash("sha256")` in `Updater.ts` builds a Windows Task Scheduler task
  name.
- Every SHA-256 site in `extractor/main.zig` is used for naming, locking, or checking a
  Linux `.desktop` entry—never the update payload.
- The `hash` field in `update.json` is a change sentinel: it is compared against the
  local hash purely to decide whether an update exists.

The consequence is direct.
Anyone who can serve or tamper with your update endpoint—a compromised host, a
misconfigured bucket, a hostile network without strict transport guarantees—can execute
arbitrary code on every user’s machine.
For comparison, Squirrel.Mac refuses to apply an update that is not correctly signed,
and Tauri’s updater requires a signature made with a key you hold.

**If you ship Electrobun today, disable the updater and distribute through a channel
that provides its own integrity guarantees.**

One honest caveat: the Hutch CLI is closed-source, so build-time behavior cannot be
fully audited. But the code that runs on a user’s machine at update time is the code
above, and the verification is absent there.

### Code Signing

| Platform | State |
| --- | --- |
| **macOS** | Configurable via `mac.codesign` and `mac.entitlements`, but the implementation lives inside the closed-source Hutch CLI and cannot be audited. Open issue [#515](https://github.com/blackboardsh/electrobun/issues/515) reports the signing setup exposing a personal Apple ID credential. |
| **Windows** | **No code signing at all.** No Authenticode, no SignTool integration. Binaries ship unsigned, which means SmartScreen warnings and no trust chain. |
| **Linux** | No GPG signing and no repository integration. |

The Windows position is the sharpest practical problem after the updater: an unsigned
Windows binary is an immediate friction point for any non-technical audience.

### Runtime Dependencies

Windows assumes the Evergreen WebView2 runtime is already installed and **bundles no
bootstrapper**. On a machine without it, the app does not run.
Linux requires GTK3, WebKitGTK 4.1, Ayatana AppIndicator, and librsvg.

* * *

## 6. What Shipping Apps Actually Do

The ecosystem is real but small.
Roughly 200 repositories appear in the dependents graph, but most are single-star
experiments; the honest count of maintained, non-trivial open-source applications is
about a dozen.

| Project | Stars | Why it is worth reading |
| --- | --- | --- |
| [co(lab)](https://github.com/blackboardsh/colab) | 203 | Blackboard’s own product: browser plus Monaco plus PTY terminal. The maintainer dogfooding the framework is the strongest existence proof available. In developer preview. |
| [llm-space](https://github.com/deer-flow/llm-space) | 1.6k | Largest community app. Monorepo structure, React. |
| [dev-3.0](https://github.com/h0x91b/dev-3.0) | 243 | Parallel AI coding agent control panel; React 19, terminal embedding. |
| [guerillaglass](https://github.com/okikeSolutions/guerillaglass) | 10 | **The best sidecar reference.** Swift sidecars on macOS plus Rust sidecars cross-platform. |
| [spectrum](https://github.com/fmsouza/spectrum) | 6 | **Signed and notarized macOS releases**—the clearest worked example of shipping. |
| [MaplatEditor](https://github.com/code4history/MaplatEditor) | 17 | An in-progress migration from Electron; useful for seeing what does and does not port. |

Patterns that recur across these projects:

- **React plus Tailwind plus Vite**, with Vite output mapped in through `build.copy`.
  The official templates offer Vue, Svelte, Solid, and Angular, but the community
  converged on React.
- **`bundleCEF: false`** on macOS and Windows, relying on system webviews.
- **`mainProcess: "cottontail"`**, not Bun.
- **Developer and AI tooling dominates.** Almost every non-trivial app is a developer
  tool, which reflects the early-adopter audience rather than a limitation of the
  framework.
- **macOS-first.** Several projects are macOS-only, and cross-platform support in
  practice trails the matrix on paper.

No widely recognised consumer product has been publicly identified as built on
Electrobun.

* * *

## 7. Maturity and Risk

This section exists because for Electrobun, unlike Electron or Tauri, project risk is a
first-order engineering consideration rather than a footnote.

**Signals of genuine capability.** Roughly 12,700 stars and about 2,300 commits.
The native layer is substantial real engineering: a 4,100-line Zig core, three
platform-specific native wrappers, over 100 FFI bindings, working CEF integration with
per-platform linking strategies.
The typed RPC design is cleaner than Electron’s IPC. Version 1.0 shipped 2026-01-28 and
the line has continued to 1.18.1.

**Signals of risk.**

- **Bus factor of one.** Every sampled period shows a single author writing the
  overwhelming majority of commits.
  The contribution policy explicitly warns that pull requests requiring excessive review
  effort “will be ruthlessly closed without explanation,” and no response timelines are
  offered.
- **No external funding identified.** The backing company is the maintainer’s own.
- **86 open issues against roughly a dozen visibly closed**, including security issues
  (#515, #518), platform crashes (#490), and an architectural FFI problem (#520).
- **No CHANGELOG and no migration guides.** Release notes are auto-generated commit
  ranges, so evaluating an upgrade means reading diffs.
- **Version numbers carry no contract.** The project went 0.13.0 to 1.0.0 in two days
  and skips numbers freely.
  Majors mark feature milestones, not API stability.
- **Documentation trails the source**, including on the config schema.
- **The maintainer describes the project as “10% of the vision”** in `CONTRIBUTING.md`.
- **A runtime migration is in flight.** The 2.0 line is decoupling from Bun in response
  to Bun’s Zig-to-Rust core rewrite, which the maintainer has cited publicly.
  Whatever the merits, a framework changing its main-process runtime mid-flight is a
  moving target.

None of this says the project is bad.
It says the risk profile is that of an early-stage single-maintainer project, and it
should be evaluated on those terms rather than on its star count.

* * *

## Best Practices

- [ ] Pin an exact version.
  Semver gives you no protection here.
- [ ] Read the diff before upgrading; there is no CHANGELOG.
- [ ] Verify config-schema questions against the templates in the repository, not the
  published docs.
- [ ] Keep the RPC surface narrow and named; validate every payload in the main process.
- [ ] Never load remote or untrusted content into an RPC-enabled webview.
- [ ] Set a CSP explicitly; the framework provides none.
- [ ] Use navigation rules to pin the app to `views://`.
- [ ] **Disable the updater** unless you have independently verified that signature
  verification has landed.
- [ ] Measure your real bundle size rather than citing the headline figure.
- [ ] On Windows, expect unsigned binaries and plan for SmartScreen friction.
- [ ] Confirm the Evergreen WebView2 runtime is present on target Windows machines.
- [ ] Test on every platform you ship; the support matrix is narrower than it looks.

* * *

## Open Research Questions

1. **Will the updater gain signature verification, and when?** This single question
   governs whether Electrobun can be recommended for public distribution.
   Recheck `Updater.ts` on every upgrade.

2. **What does the closed-source Hutch CLI do at signing time?** macOS entitlements,
   hardened runtime flags, and nested-binary signing are all unverifiable from source
   today.

3. **Does Cottontail change the performance and compatibility story versus Bun?** It is
   now the default runtime, but there is no published comparison of JavaScriptCore-based
   Cottontail against Bun for real workloads.

4. **How stable is the 2.0 config schema?** The templates on `main` and the published
   documentation disagree, and 2.0 has no stable release.

5. **Does the Bun decoupling reduce or increase risk?** Removing the dependency on a
   runtime undergoing a core rewrite is defensible, but it means the default runtime is
   now a bespoke one maintained by the same single person.

* * *

## Recommendations

### When Electrobun Is a Reasonable Choice

- Internal tools and prototypes where you control distribution and can update out of
  band.
- Apps for a technical, trusted audience, shipped without the auto-updater.
- macOS-first developer tooling, which is where the framework and its community are
  strongest.
- Cases where bundle size genuinely dominates and you have measured that Electrobun
  actually delivers it for your app.
- Exploratory work where you want the typed RPC ergonomics and can absorb churn.

### When to Choose Something Else

- **Anything security-sensitive**, because of the update path, the absent context
  isolation, and the sandbox/RPC exclusivity.
- **Consumer software distributed at scale**, where unsigned Windows binaries and an
  unverified updater are not acceptable.
- **Long-lived products with small teams**, where a bus factor of one in a core
  dependency is a real risk.
- **Linux-first products**, where you lose the size advantage to CEF and get no
  package-manager integration.
- **Anything needing broad platform coverage**, given macOS arm64-only, Windows
  x64-only, and Ubuntu 24.04+.

Choose **Electron** when you need maturity, ecosystem, signing and update
infrastructure, and a security model with real defaults; see
`tbd guidelines electron-app-development-patterns`. Choose **Tauri** when you want a
small bundle with a multi-maintainer project and an update path that verifies what it
installs.

### If You Adopt It

Pin an exact version, disable the updater, ship signed on macOS and accept unsigned on
Windows, keep the RPC surface minimal, never load remote content, and budget time for
platform-specific bugs that a larger project would have found already.

* * *

## References

### Official

- [Electrobun documentation](https://framework.blackboard.sh/electrobun/)
- [Architecture overview](https://framework.blackboard.sh/electrobun/guides/architecture/overview/)
- [Build configuration](https://framework.blackboard.sh/electrobun/apis/cli/build-configuration/)
- [Source repository](https://github.com/blackboardsh/electrobun)
- [v1 announcement](https://blackboard.sh/blog/electrobun-v1/)

### Issues Cited

- [#515: code signing setup exposes a personal Apple ID credential](https://github.com/blackboardsh/electrobun/issues/515)
- [#518: RPC WebSocket transport security](https://github.com/blackboardsh/electrobun/issues/518)
- [#520: Bun FFI eager symbol binding breaks non-macOS loading](https://github.com/blackboardsh/electrobun/issues/520)
- [#484: Windows white bands during resize](https://github.com/blackboardsh/electrobun/issues/484)
- [#490: Windows Dev Drive path corruption crash](https://github.com/blackboardsh/electrobun/issues/490)
- [#485: macOS x86_64 launch crashes](https://github.com/blackboardsh/electrobun/issues/485)

### Projects Surveyed

- [co(lab)](https://github.com/blackboardsh/colab),
  [llm-space](https://github.com/deer-flow/llm-space),
  [dev-3.0](https://github.com/h0x91b/dev-3.0),
  [guerillaglass](https://github.com/okikeSolutions/guerillaglass),
  [spectrum](https://github.com/fmsouza/spectrum),
  [MaplatEditor](https://github.com/code4history/MaplatEditor)

## Related Guidelines

- For Electron, see `tbd guidelines electron-app-development-patterns`
- For Tauri, see `tbd guidelines tauri-app-development-patterns`
- For dependency policy, see `tbd guidelines supply-chain-hardening`
- For TypeScript conventions, see `tbd guidelines typescript-rules`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
