---
title: Tauri App Development Patterns
description: Building desktop apps with Tauri 2—capabilities and IPC, Rust and non-Rust backends, sidecar lifecycle, wrapping a loopback web server, WKWebView gaps on macOS, signing and notarization, the signed updater, and the Cargo cool-off
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: desktop
---
# Tauri App Development Patterns

**Last Updated:** 2026-11-08

## Executive Summary

Tauri builds desktop apps from a Rust core plus the operating system’s own webview.
It ships no browser engine, which is where its small bundles come from, and it replaces
Electron’s “secure it yourself” posture with a compile-time permission system that
denies everything by default.

Five things matter most when deciding:

- **The updater verifies what it installs, and can bind the version.** The downloaded
  payload is checked with minisign against a public key compiled into your app, and the
  update aborts if verification fails.
  Since CLI 2.12 the signature also covers the release’s version, and
  `requireSignedVersion` rejects a manifest that pairs one version with another
  release’s artifact. This is a categorical difference from an updater that trusts its
  host, and it is the strongest single reason to prefer Tauri over less mature
  alternatives.

- **The security model is genuinely two-sided.** `core:default` grants the default sets
  of the nine core UI modules and *zero* filesystem, shell, or network access, so the
  deny-all baseline is real.
  Renderer isolation and patch timing depend on the platform webview.
  Tauri capabilities restrict the Rust commands a page can invoke.
  Configure CSP separately.

- **A thin native window over an existing local web server is small.** Point a window at
  `http://127.0.0.1:<port>`, skip the frontend build, and grant no capabilities: the
  page then has no IPC reach at all (see
  [§4](#4-wrapping-an-existing-loopback-web-app)).

- **The system webview becomes your engine.** On macOS, WKWebView leaves `target=_blank`
  links, downloads, Reload, Back and Forward, and Find doing nothing until the app wires
  them, and any performance work measured in Chromium needs re-measuring in WebKit.
  Linux is weaker still: WebRTC is unavailable in distro WebKitGTK, media served through
  Tauri’s own asset protocol does not play, and drag-and-drop is broken across several
  open issues. Read [What Breaks](#8-what-actually-breaks-across-webviews) before
  committing.

- **You pay in build time, not in bundle size.** Rust builds add minutes per CI job
  against a JavaScript-only toolchain, you cannot cross-compile macOS bundles, and Cargo
  adds a third dependency graph to keep inside your cool-off.

**Recommendation in one line:** the default choice when you want a small, signed,
auto-updating desktop app and can accept Rust in the build and system webviews in the
product—with WebKit QA budgeted on macOS and Linux support verified early rather than
assumed.

**Related:**

- [Tauri documentation](https://v2.tauri.app/)
- [Tauri source](https://github.com/tauri-apps/tauri)
- [Tauri plugins source](https://github.com/tauri-apps/plugins-workspace)
- [awesome-tauri](https://github.com/tauri-apps/awesome-tauri)
- [Companion: Electron App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electron-app-development-patterns.md)
- [Companion: Electrobun App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electrobun-app-development-patterns.md)
- [Companion: macOS WebView Shell Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md)
  (the hand-written AppKit and WKWebView alternative for macOS-only apps)
- [Companion: Desktop Python Runtime Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/desktop-python-runtime-patterns.md)
  (shipping a Python backend with uv)
- [Companion: Supply-Chain Hardening](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)
- [Companion: TypeScript Rules](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/typescript-rules.md)

* * *

## Updating This Document

Tauri’s 2.x core is stable, but its plugins publish almost weekly and 3.0 is in alpha,
so version facts here age within weeks.
The parts most worth rechecking are the plugin pins against the cool-off, the security
floor, the open macOS issues, the Linux webview situation, and the Tauri 3.0 status.

### Last Researched Versions

Observed 2026-11-08 by querying the crates.io API, the npm registry, and GitHub releases
directly. The 14-day cool-off in `tbd guidelines supply-chain-hardening` put the cut-off
at 2026-10-25: a release is eligible if its UTC publish date is on or before that date,
**Pin** is the newest eligible release, and a release marked *too new* becomes eligible
on the date given.

| Thing | Pin | Newest release | Notes |
| --- | --- | --- | --- |
| **tauri** (Rust crate) | **2.12.5** | 2.12.5, 2026-10-21 | MSRV 1.90. The stable line is 2.x; 3.0 is alpha only (see [Tauri 3.0](#10-tauri-30)). |
| **tauri-build** | 2.7.4 | 2.7.4, 2026-10-21 | Versions on its own 2.7.x line. |
| **tauri-cli / @tauri-apps/cli** | 2.12.4 | 2.12.4, 2026-10-21 | 2.12.0+ writes the app version into updater signatures. The npm package has no JavaScript dependencies, only per-platform optional binaries. |
| **@tauri-apps/api** | 2.12.4 | 2.12.4, 2026-10-14 | Not needed when the page makes no IPC calls. |
| **tauri-plugin-updater / @tauri-apps/plugin-updater** | **2.14.0** (2026-10-14) | 2.14.1, 2026-10-28: *too new* until 2026-11-11 | 2.14.1 only moves to `zip` 9 (Windows extraction) and `base64` 0.23. `requireSignedVersion` needs 2.12.0+. |
| **tauri-plugin-shell / @tauri-apps/plugin-shell** | **2.5.0** (2026-10-10) | 2.6.0, 2026-10-28: *too new* until 2026-11-11 | 2.5.0 adds process groups; 2.6.0 adds `Command::kill_on_drop`. Never below 2.2.1 (GHSA-c9pr-q8gx-3mgp). |
| **tauri-plugin-single-instance** | **2.5.4** (2026-10-14) | 2.5.5, 2026-10-28: *too new* until 2026-11-11 | Rust only; there is no JavaScript package. |
| **tauri-plugin-deep-link / @tauri-apps/plugin-deep-link** | **2.6.2** (2026-10-14) | 2.6.3, 2026-10-28: *too new* until 2026-11-11 |  |
| **tauri-plugin-window-state / @tauri-apps/plugin-window-state** | 2.5.0 | 2.5.0, 2026-09-26 |  |
| **wry / tao** | transitive | 0.57.1 / 0.37.2, 2026-10-23 | Pulled in by `tauri`; the WKWebView behavior in [§8](#8-what-actually-breaks-across-webviews) was read from these versions. |
| **tauri-apps/tauri-action** | action-v1.0.0, by commit SHA | action-v1.0.0, 2026-06-29 | v1.0.0 renamed inputs; see [CI](#ci). |
| **Swatinem/rust-cache** | v2.9.3, by commit SHA | v2.9.3, 2026-10-20 |  |
| **Minimum version to pin** | **2.11.6** |  | 2.11.6 fixes GHSA-w28w-mhc8-qvjv (high). Do not pin below it. |
| **Linux webview** | webkit2gtk **4.1** |  | `4.0` was removed in Ubuntu 24 and Debian 13. Engine capability tracks the distro, not your build. |
| **Windows webview** | WebView2 (Evergreen) |  | Preinstalled on Windows 11; bootstrapped on older versions. Tauri 2.12.0 dropped Windows 7. |
| **macOS webview** | WKWebView |  | The system WebKit, which updates with Safari. Safari 27 (2026-09-14) is available for macOS Sequoia (15) and Tahoe (26). |

A version-alignment note, because the obvious guess is wrong: **the ecosystem is
near-lockstep but not uniform.** A plugin’s Rust crate and JS package share a version
(`tauri-plugin-updater` 2.14.0 matches `@tauri-apps/plugin-updater` 2.14.0), but the
core crates version independently—`tauri` at 2.12.5, the CLI at 2.12.4, `tauri-build` at
2.7.4, `@tauri-apps/api` at 2.12.4. Match plugin pairs; do not try to force the core
crates to one number.

### Reminders When Updating

1. **Re-run the cool-off check, including the transitive graph.** On 2026-10-28 four of
   the five plugins tracked here released at once, and a fresh lockfile pulls young
   transitive crates even when every direct pin is old enough (see
   [§7](#7-the-rust-supply-chain)).

2. **Recheck the security advisories** with
   `gh api repos/tauri-apps/tauri/security-advisories` and the same for
   `tauri-apps/plugins-workspace`. 2.11.6 is the current floor.

3. **Recheck the open macOS issues**, each of which changes advice here when it closes:
   `ExitRequested` on quit ([#9198](https://github.com/tauri-apps/tauri/issues/9198)),
   HTML5 drag-and-drop ([#16373](https://github.com/tauri-apps/tauri/pull/16373)),
   sidecar notarization ([#11992](https://github.com/tauri-apps/tauri/issues/11992)),
   and the Dock menu ([#9916](https://github.com/tauri-apps/tauri/issues/9916)).

4. **Recheck the Linux webview story.** The GTK4 and WebKitGTK 6.0 migration
   ([#14684](https://github.com/tauri-apps/tauri/pull/14684)) addresses much of
   [What Breaks on Linux](#8-what-actually-breaks-across-webviews) and was still an open
   pull request on 2026-11-08.

5. **Recheck Tauri 3.0.** It was at 3.0.0-alpha.6 with no announced release date.

6. **Recheck Cargo’s publish-age gate.** It is respected from Rust 1.100, scheduled for
   2026-11-12; once that toolchain is the norm, the manual workaround in
   [§7](#7-the-rust-supply-chain) can go.

7. **Recheck `webviewInstallMode` sizes** against the
   [Windows installer docs](https://v2.tauri.app/distribute/windows-installer/).

8. **Re-measure bundle sizes and CI times** from real release assets and Actions runs
   rather than repeating claims.
   The numbers here vary enormously with what you put in the Rust half.

9. **Recheck the deprecation list.** The signer environment variables were renamed
   (`tauri signer sign` still reads `TAURI_PRIVATE_KEY`) and the tray API is deprecated.

* * *

## 1. Architecture and the Process Model

### The Layers

| Layer | What it is | Role |
| --- | --- | --- |
| **Rust core** | Your `src-tauri` crate | Privileged process. Owns the filesystem, OS APIs, and command handlers. |
| **TAO** | Windowing crate (0.37.2) | Windows, menus, tray, events. |
| **WRY** | Webview abstraction (0.57.1) | Wraps each platform’s native webview. |
| **Webview** | WebView2, WKWebView, WebKitGTK, Android System WebView | Your UI. No filesystem, no OS access. |

The webview has no ambient privilege.
Everything it can do passes through the IPC layer, and every IPC call is gated by
permissions declared at compile time.

**There is no preload script.** This is the sharpest structural difference from
Electron, where the preload is the audited crossing point.
In Tauri the frontend imports `@tauri-apps/api`, and the security boundary is the
permission system rather than a script you write.
The optional `withGlobalTauri` injects `window.__TAURI__` instead; it is **off by
default**, and leaving it off is correct—it exposes the API surface to any third-party
script on the page and defeats tree-shaking.

### The IPC Model

Tauri 2 moved from `postMessage` to a **custom protocol**: an HTTP-shaped request that
never touches the network.
Older WebKitGTK (below 2.36) falls back to `postMessage`.

Four mechanisms, in the order you will reach for them:

| Mechanism | Use it for |
| --- | --- |
| `#[tauri::command]` + `invoke()` | Ordinary request/response. JSON-serialized. |
| `emit` / `listen` events | Broadcast notifications, main-to-frontend push. |
| `Channel<T>` | Streaming a sequence of values, e.g. download progress. |
| `ipc::Response` / `ipc::Request` | Raw binary, bypassing JSON. |

The raw-binary path is worth knowing about before you need it: in one third-party
benchmark, a 64KB binary round trip measured roughly **600µs through `ipc::Response`
against about 6.7ms through standard JSON serialization**. If you move images, audio, or
file contents across the boundary, this is a tenfold difference, not a
micro-optimization.

### Project Layout

Scaffold with `create-tauri-app`, which produces the shape every surveyed app follows:
an ordinary frontend project with a Rust crate beside it.

```
my-app/
├── src/                        # frontend—any framework; Vite is the near-universal bundler
├── package.json
└── src-tauri/
    ├── Cargo.toml              # tauri = "=2.12.5" (never below 2.11.6), plugins as crates
    ├── Cargo.lock              # committed; build with --locked
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json        # permission grants (see §2)
    ├── binaries/               # sidecars, target-triple suffixed (see §3)
    ├── icons/
    └── src/
        ├── main.rs             # thin entry; calls into lib.rs
        └── lib.rs              # commands, state, plugin registration
```

The frontend never imports from `src-tauri`; the crate never imports from `src/`. The
only contract between them is the command names, the event names, and the capability
files.

### Configuration and the Dev Loop

A minimal complete `tauri.conf.json`, with the four keys that wire in your frontend
toolchain:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "my-app",
  "version": "0.1.0",
  "identifier": "com.example.my-app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{ "title": "my-app", "width": 1200, "height": 800 }],
    "security": {
      "csp": "default-src 'self'; connect-src ipc: http://ipc.localhost"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.icns", "icons/icon.ico", "icons/icon.png"]
  }
}
```

Two details in that file repay attention.
The `identifier` is the reverse-DNS bundle identifier and is painful to change after
shipping, because it keys installation paths, update identity, and macOS signing.
And the CSP’s `connect-src` must include `ipc: http://ipc.localhost`—that is the custom
protocol IPC from the previous section, and a CSP that omits it silently breaks
`invoke()` on Windows and Linux.

The loop itself: `tauri dev` runs `beforeDevCommand` (your Vite dev server, with normal
HMR), compiles the Rust crate, and launches the app pointing at `devUrl`. Frontend edits
hot-reload instantly; **Rust edits trigger a recompile and relaunch, which takes
seconds, not milliseconds**—structure your app so iteration happens on the frontend side
and commands stay stable.
`tauri build` runs `beforeBuildCommand`, embeds `frontendDist`, and produces the bundle
targets.

* * *

## 2. Capabilities and Permissions

This is the largest change in Tauri 2 and the part most worth understanding properly,
because it is both the framework’s main security asset and its main source of confusion.

### The Three Layers

1. **Permissions:** per-command on/off switches, named `<plugin>:<identifier>`.
2. **Scopes:** parameter validation that narrows what a permitted command may touch.
3. **Capabilities:** bind a set of permissions and scopes to specific windows.

A real `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-title",
    {
      "identifier": "fs:allow-read-file",
      "allow": [{ "path": "$APPDATA/**" }],
      "deny": [{ "path": "$APPDATA/secrets/**" }]
    }
  ]
}
```

Naming follows `<name>:default`, `<name>:allow-<command>`, and `<name>:deny-<command>`.
Scopes accept glob patterns and variables such as `$HOME`, `$APPDATA`, and `$DESKTOP`,
and **deny always beats allow**. Since 2.12.0 a deny applies only to the execution
context (local or remote) of the capability that declares it.

### What You Get by Default

`core:default` bundles the default permission sets of the nine core modules—window,
menu, tray, app, event, image, path, resources, and webview—**and no filesystem, shell,
HTTP, or plugin access whatsoever.** That is the fact to internalize: the default is a
fully usable UI with no reach into the machine.
Every capability beyond drawing a window is something you deliberately added.

A page loaded from a remote origin, which includes a loopback server at
`http://127.0.0.1:<port>`, gets less than that: nothing at all unless a capability names
its URL in `remote.urls` (see [§4](#4-wrapping-an-existing-loopback-web-app)).

### What Real Apps Actually Do

Surveying fourteen serious open-source Tauri apps shows the system is used well by some
and loosely by others, and the pattern is instructive.

**Tightly scoped, worth imitating:**

- **Modrinth** splits capabilities across three files, scopes HTTP by URL and the
  filesystem by path.
- **Spacedrive** is the only app in the survey that scopes to **specific window names**
  rather than `windows: ["*"]`.
- **Yaak** and **Hoppscotch** confine the filesystem to `$APPDATA` and `$APPCONFIG`.

**Broad, and worth understanding why:**

- **Clash Verge Rev** carries an `fs:scope` of `"**"` plus shell execute, spawn, and
  kill.
- **Cap** grants `fs:write-all`, `fs:read-all`, and HTTP to `http://*` and `https://*`.

The single biggest source of over-broad permissions is **the v1 migration**, which dumps
the old allowlist into a `migrated.json` capability.
If you are migrating from Tauri 1, rewrite your capabilities by hand.
Shipping the migration output means shipping v1’s coarse permissions into a system
designed for fine ones.

* * *

## 3. Attaching a Backend

### Rust Commands: The Default Path

```rust
#[tauri::command]
async fn open_project(id: String, state: tauri::State<'_, AppState>) -> Result<Project, Error> {
    state.db.load(&id).await
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![open_project])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

The most common friction point is not the borrow checker—it is that **your error type
must implement serde’s `Serialize`** to cross the boundary.
Plan for a single app-wide error enum with a `Serialize` implementation early.

### How Much Rust Do You Actually Need?

Honestly: for a frontend-driven app using official plugins, close to none.
The scaffold’s `main.rs` often stays untouched, because the filesystem, dialog, HTTP,
store, and shell plugins already expose what a typical app needs.
Rust starts to matter when you write custom commands, and the friction is concentrated
in serde derives, serializable error types, and `State<'_, T>` inside async functions
rather than in lifetimes or ownership.
A shell that wraps an existing server needs a little Rust and no commands at all
([§4](#4-wrapping-an-existing-loopback-web-app)).

If your team genuinely will not write Rust, sidecars are the sanctioned escape
hatch—paid for in bundle size and process lifecycle complexity.

### Sidecars

Declare external binaries in `tauri.conf.json`:

```json
{
  "bundle": {
    "externalBin": ["binaries/my-sidecar"]
  }
}
```

**The target-triple naming convention is the most common failure point in all of
Tauri.** A binary declared as `binaries/my-sidecar` must exist on disk with the Rust
target triple appended:

```
src-tauri/binaries/my-sidecar-x86_64-apple-darwin
src-tauri/binaries/my-sidecar-aarch64-apple-darwin
src-tauri/binaries/my-sidecar-x86_64-unknown-linux-gnu
src-tauri/binaries/my-sidecar-x86_64-pc-windows-msvc.exe
```

Get the current triple with `rustc --print host-tuple` (Rust 1.84 and later).
Your build script must produce correctly suffixed copies for every target you ship.
The bundler copies each one next to the main executable with the suffix stripped (on
macOS, `Contents/MacOS/my-sidecar`), so Rust can find it with
`std::env::current_exe()?.with_file_name("my-sidecar")`. On macOS the bundler also signs
it; see [What the macOS Bundler Signs](#what-the-macos-bundler-signs).

A second gotcha, easy to lose an hour to: **the Rust and JavaScript APIs take different
arguments.** `Command::sidecar()` in Rust takes the **filename only**, while
`Command.sidecar()` in JavaScript takes the **full `externalBin` path**.

Spawning a sidecar from JavaScript requires permissions, each with a scope marking it as
a sidecar:

```json
{
  "identifier": "shell:allow-spawn",
  "allow": [{ "name": "binaries/my-sidecar", "sidecar": true }]
}
```

You will typically also need `shell:allow-kill` and, if you write to the process,
`shell:allow-stdin-write`. Spawning from Rust needs no capability, which is the better
default when the page has no reason to control the process.

### Non-Rust Backends

| Language | Approach | Cost |
| --- | --- | --- |
| **Go** | Compile a static binary. No extra tooling. | Smallest and simplest. |
| **Bun** | `bun build --compile` produces a single executable. | **~29MB added to a .dmg**, against ~5MB for pure Rust. |
| **Node** | The official docs use `@yao-pkg/pkg`. No real Node SEA examples were found in the wild. | Comparable to Bun. |
| **Python** | **uv** as a signed `externalBin` that installs a pinned Python and the locked dependencies on first run; or a PyInstaller sidecar; or a bundled python-build-standalone tree. | uv adds about 14MB compressed (the 0.13.5 aarch64 tarball is 14.4MB) and needs the network on first launch; a bundled interpreter adds tens of MB and must be signed by your own script. |

For **Python**, the recommended shape is uv as a signed `externalBin`. Ship
`pyproject.toml` and `uv.lock` as read-only resources, and on first launch run uv with
its cache, Python installs, and project environment pointed into the app-data directory.
Nothing interpreter-sized enters the bundle, so uv is the only extra code the bundler
signs, and an app update that carries a new lock re-syncs the environment under the same
updater signature. `tbd guidelines desktop-python-runtime-patterns` covers the layouts,
isolation variables, Gatekeeper and library-validation behavior, and the offline-first
variants. The Tauri-specific parts are the signing rules in
[What the macOS Bundler Signs](#what-the-macos-bundler-signs) and the process-group
handling below.

The PyInstaller route remains well trodden, with two recurring problems: one-file mode
(`-F`) unpacks on every launch and is slow, and the bootloader’s PID differs from the
interpreter’s, so killing the PID you spawned can leave Python running unless you kill
the whole process group.
PyTauri with python-build-standalone is better integrated but drags in PyO3 and
platform-specific rpath and linker configuration.

### Process Lifecycle

**The shell plugin kills only the children spawned from JavaScript.** Its
`RunEvent::Exit` handler kills every process in its child store, and only the JavaScript
`spawn` command adds to that store.
A child spawned from Rust, whether through `app.shell().sidecar(..).spawn()` or
`std::process::Command`, can outlive the app unless you stop it yourself (read from
`plugins/shell/src/lib.rs` and `commands.rs` at 2.6.0, 2026-11-08).

Give the sidecar its own process group on Unix with `CommandExt::process_group(0)`. On
Windows, put it in a
[Job Object](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
before it can spawn descendants.
The shell plugin wraps both from 2.5.0 with `Command::set_process_group(true)` in Rust
or `processGroup: true` in JavaScript.
`CommandChild::kill()` then sends `SIGKILL` to the group or terminates the job.
A Unix descendant that calls `setsid` can escape the group.
Shell 2.6.0 also offers `kill_on_drop(true)` for Rust-spawned children.
That handles termination on drop.
The supervisor still owns graceful shutdown and reaping.

Keep the child and its process group or job in managed state.
Drain piped stdout and stderr on a worker or send them to a log file so a full pipe
cannot block the child.
Keep the child’s stdin pipe open and have it treat EOF like a graceful shutdown request.
The kernel closes the pipe on crash or force quit, when no exit handler runs.
[The shell–server contract](#follow-the-shellserver-contract) uses that same pipe for
the launch secret.

Implement one synchronous, idempotent `shutdown_backend` routine for your platform.
Serialize calls so the updater and the app’s exit handler cannot race to stop the same
child. The routine follows this sequence:

1. Close the managed stdin pipe.
   On Unix, send `SIGTERM` to the process group if the backend uses signals for graceful
   shutdown. On Windows, use EOF or the backend’s shutdown protocol for the graceful
   request.
2. Wait up to a deadline for the tree to stop.
   Escalate with `killpg(SIGKILL)` on Unix or `TerminateJobObject` on Windows if it has
   not stopped. On Unix, keep the leader unreaped until the final group signal so its ID
   cannot be recycled. The leader’s exit alone does not show that its descendants exited.
   If you have no reliable tree-exit check, give the group the full grace period and
   send the final signal before reaping, treating an absent group (`ESRCH`) as stopped.
3. Reap the direct child with
   [`Child::try_wait`](https://doc.rust-lang.org/std/process/struct.Child.html#method.try_wait)
   and a second deadline, including after escalation.
   Log signal or wait failures and keep any unreaped child in the supervisor’s state so
   it can retry if the app stays running.

Call this routine from `RunEvent::Exit` and from the
[Windows updater hook](#the-updater-and-why-it-is-the-headline-feature).
On macOS, Cmd+Q, the predefined Quit menu item, Dock › Quit, logout, and restart reach
tao’s `applicationWillTerminate:`, which emits `RunEvent::Exit`. Those paths skip
`RunEvent::ExitRequested`, and async work dispatched from `Exit` may never run.
[tauri#9198](https://github.com/tauri-apps/tauri/issues/9198).

This is the Tauri wiring for the app-defined routine.
The Unix process group and Windows job implementations belong in the backend supervisor.

```rust
app.run(|handle, event| {
    if let tauri::RunEvent::Exit = event {
        shutdown_backend(handle);
    }
});
```

### Sidecars Versus Plugins

|  | Plugin | Sidecar |
| --- | --- | --- |
| Process | In-process | Separate process |
| IPC cost | Low | Serialization plus process boundary |
| Language | Rust | Any |
| Crash isolation | No | Yes |
| **Mobile** | **Works** | **Not supported** |

That last row decides it for mobile apps: if you target iOS or Android, backend logic
has to be a plugin or Rust code, not a sidecar.

Real apps use sidecars readily—five of the fourteen surveyed.
Clash Verge Rev ships a Go proxy engine, Spacedrive a Rust daemon, Cap a media pipeline,
GitButler git binaries.
**Yaak** is the instructive variant: it bundles a whole Node.js runtime as a
**resource** rather than an `externalBin`, which is the right move when you need an
interpreter rather than a single triple-named executable.
A python-build-standalone tree can ship the same way, spawned by path, but the bundler
does not sign anything under resources, so every Mach-O file in the tree must be signed
by your own CI step first (see
[What the macOS Bundler Signs](#what-the-macos-bundler-signs)).

* * *

## 4. Wrapping an Existing Loopback Web App

When the product already exists as a local web server with a browser UI, in any
language, the thinnest Tauri app is a native window pointed at that server.
Everything below was read from tauri 2.12.5 and wry 0.57.1 source on 2026-11-08.
[Pake](https://github.com/tw93/Pake) is the closest shipping precedent: it wraps remote
websites in Tauri windows the same way, with DMGs of 9–14MB.

### Load the Loopback URL Directly

- **Create the window in Rust.** `WebviewUrl::External` accepts any `http` or `https`
  URL. The server’s port is chosen at runtime, so set `app.windows: []` in the config
  and build the window with
  `WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))` after validating
  the URL. For a splash screen, create the window on a bundled page first, then navigate
  to the validated URL. The official
  [`tauri-plugin-localhost` README](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/localhost)
  uses the same `WebviewUrl::External` pattern; the plugin itself serves bundled assets
  and is not needed here.

- **Skip the frontend build.** `build.frontendDist` is optional, and without it nothing
  is embedded: no Node, no Vite, no `@tauri-apps/api`. A two-file static directory for a
  splash and error page is still worth embedding (see
  [Startup Without a Blank Window](#startup-without-a-blank-window)).

### Grant No Capabilities

- **The loopback page is a remote origin.** Tauri treats a URL as local only if it is
  Tauri’s own protocol, relative to `devUrl` or `frontendDist`, or a custom scheme you
  registered (`Webview::is_local_url`). The ACL branch in `Webview::on_message` rejects
  every command from a non-local origin unless a capability grants it through
  `remote.urls`, so **with zero capability files the page can invoke nothing.**

- **The IPC object still exists.** Tauri injects `window.__TAURI_INTERNALS__` into every
  page, so `invoke()` is present but rejects.
  Keep `withGlobalTauri` off.
  The one command exempt from the ACL check, `plugin:__TAURI_CHANNEL__|fetch`, is the
  subject of GHSA-w28w-mhc8-qvjv; 2.11.6+ binds its data to the webview that owns it.

- **Do not make the server’s origin local for convenience.** Setting `devUrl` or
  `frontendDist` to the server’s URL makes that origin local to Tauri.
  Run `tauri dev` through the same External-URL code path as release builds.

- **The server sets the CSP.** `app.security.csp` governs assets Tauri serves.
  Send a `Content-Security-Policy` header from the loopback server that confines
  subresources, frames, and network requests to its own origin and restricts form
  submissions to that origin.
  Include the bound port in explicit source URLs.
  Top-level navigation handlers alone do not stop requests to other ports from the page.
  [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/).

- **Drive privileged features from Rust.** The updater, menus, and native dialogs need
  no capability when Rust calls them, so the page never gains them.

### Follow the Shell–Server Contract

Any local process can reach a loopback port, and DNS rebinding lets web pages try, so
the server needs a per-launch secret whatever shell wraps it.
Use the framework-independent
[shell–server contract](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#the-shellserver-contract)
in `tbd guidelines macos-webview-shell-patterns`, which owns the details.
In brief:

- The server binds `127.0.0.1` on port 0 and, once listening, prints one stdout line:
  `{"event":"ready","protocol":1,"url":"http://127.0.0.1:<port>/","port":<port>,"pid":<pid>,"version":"<server version>"}`.
- The shell writes a per-launch secret as the first stdin line, never in argv (which
  `ps` shows) or the environment (which children inherit), and keeps stdin open.
  EOF on stdin, like `SIGTERM`, starts a graceful shutdown with a bounded deadline.
- Programmatic clients send `Authorization: Bearer <secret>`. A web view needs a cookie,
  because `EventSource` cannot send custom headers: a shell that controls its cookie
  store may set the session cookie directly, and otherwise a single-use exchange code,
  distinct from the secret, at a one-time URL sets an `HttpOnly` cookie and redirects.
- Use `session_<port>` as the cookie name and have the server check `Host` and `Origin`.
  Cookies ignore ports, so the name distinguishes instances when selecting the cookie
  but does not keep other services on `127.0.0.1` from receiving it if the webview makes
  requests to them. Keep the navigation policy and the server CSP scoped to the validated
  origin. [RFC 6265 §8.5](https://www.rfc-editor.org/rfc/rfc6265#section-8.5).

Check the announcement before setting the cookie or loading any server URL. Compare the
URL string to the exact URL you construct from the announced port, then parse the
constructed URL for Tauri.
This rejects other hosts or schemes, a different port, user info, extra path components,
queries, and fragments.

```rust
fn ready_endpoint(message: &serde_json::Value) -> Result<(tauri::Url, u16), &'static str> {
    if message["event"].as_str() != Some("ready") || message["protocol"].as_u64() != Some(1) {
        return Err("unsupported ready message");
    }
    let port = message["port"]
        .as_u64()
        .and_then(|port| u16::try_from(port).ok())
        .filter(|&port| port != 0)
        .ok_or("invalid ready port")?;
    let expected = format!("http://127.0.0.1:{port}/");
    if message["url"].as_str() != Some(expected.as_str()) {
        return Err("unexpected ready URL");
    }
    let url = expected.parse().map_err(|_| "invalid loopback URL")?;
    Ok((url, port))
}
```

### Navigation, New Windows, and Downloads

Allow the bundled startup pages and the validated server origin in `on_navigation`. Use
`on_new_window` to deny popups in the app.
Send approved external links to the system browser using an explicit scheme allowlist
such as `https`, `http`, and `mailto`. Use `on_download` to approve intended downloads
and choose where they go.
Tauri otherwise allows navigation away from the app page, and on macOS the webview needs
handlers for new windows and downloads.
See [§8](#8-what-actually-breaks-across-webviews).

### Startup Without a Blank Window

1. Create the window with `visible(false)` and attach `on_page_load` before building it.
   If you start with a bundled splash page, call `show()` when that page finishes
   loading. A hidden window avoids the white flash on macOS, where `background_color`
   does not set the webview layer’s background.
2. Spawn the backend with managed stdin and piped stdout.
   A worker writes the secret, reads the ready line, and keeps draining stdout into a
   log. Enforce a startup deadline outside the blocking reads so the event loop and
   timeout can both run.
   Treat spawn or pipe errors, an invalid ready line, EOF before readiness, and a
   timeout as startup failures.
3. After validation, set the navigation allowlist to the expected server origin.
   Call `WebviewWindow::set_cookie` for host `127.0.0.1` and path `/`, with the
   `session_<port>` name, the launch secret, `HttpOnly`, and `SameSite=Strict`. On
   macOS, verify that `cookies()` reports `HttpOnly`, since wry sets the flag through an
   undocumented WebKit property key.
   On Windows, call the cookie APIs off the main thread.
   [wry#583](https://github.com/tauri-apps/wry/issues/583).
4. After successful cookie installation, call `navigate()` while startup is still
   active. In `on_page_load`, wait for `PageLoadEvent::Finished` at the expected app URL,
   then call `show()` if the window is still hidden.
   Keep the deadline active through that callback.
   Treat cookie, navigation, and window errors as startup failures.
   On failure, stop accepting worker completions, show a bundled error page or native
   dialog, and stop the backend through the same shutdown routine.

If cookie injection cannot preserve the flags, the first server page can use the
contract’s single-use exchange URL on the validated origin, then redirect to the
expected app page.
An `initialization_script` that sets a JavaScript global cannot supply
authorization headers to `EventSource`.

For Finder launches on macOS, pass an explicit `PATH` if the server runs developer
tools. GUI apps get launchd’s minimal `PATH`, without Homebrew or `~/.local/bin`.
[fix-path-env-rs](https://github.com/tauri-apps/fix-path-env-rs).

### Opened Files, URLs, and Single Instance on macOS

- **LaunchServices keeps one instance and delivers opens to it.** Files dropped on the
  Dock icon, Open With, and registered URL schemes arrive as
  `RunEvent::Opened { urls }`; a Dock click on the running app arrives as
  `RunEvent::Reopen`. Translate each into a request to the server.
- **File and folder associations:** `bundle.fileAssociations` writes
  `CFBundleDocumentTypes`, and a `src-tauri/Info.plist` is merged into the generated one
  for anything the config cannot express, such as a `public.folder` document type.
- **URL schemes:** on macOS the deep-link plugin amounts to writing `CFBundleURLTypes`
  at build time plus handling `Opened`, which a few lines of your own do equally well.
  Treat every incoming URL as untrusted: any web page in the user’s browser can fire
  your scheme.
- **Single instance:** the plugin’s macOS implementation is a Unix socket at
  `/tmp/<identifier>_si.sock`, which matters only when a second copy starts outside
  LaunchServices (`open -n`, or running `Contents/MacOS/<bin>` directly).
  It is optional on macOS and needed on Windows and Linux.
- **Dock menu:** not exposed by Tauri 2
  ([#9916](https://github.com/tauri-apps/tauri/issues/9916), open since 2024-05); it
  needs objc2 code against the `NSApplication` delegate that tao owns.

* * *

## 5. Security Baseline

### Where Tauri Is Stronger Than Electron

- **Deny-all by default.** Permissions are additive and enforced at compile time.
- **Memory safety** in the privileged process.
- **No bundled engine** to carry known vulnerabilities.
- **The Isolation pattern**, an optional sandboxed iframe that intercepts every IPC
  message before it reaches Rust, encrypting it with AES-GCM under a key regenerated
  each startup. Its real purpose is defending against a **compromised frontend
  dependency**: a malicious npm package cannot make raw IPC calls without passing your
  hook.
- Tauri 2.0 was **externally audited** by Radically Open Security, funded by NLNet/NGI.

### Where Tauri Is Weaker, Stated Plainly

- **Renderer isolation varies by webview.** Electron ships Chromium and its sandbox.
  Tauri relies on the system webview’s process isolation.
  For example, Microsoft documents
  [sandboxed WebView2 renderer processes](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/measures)
  on Windows. Assess that boundary on each target separately from Tauri’s IPC
  capabilities and Isolation pattern.
- **CSP is not enabled by default.** It works well once configured, with compile-time
  nonce and hash injection, but you must opt in.
- **`security.freezePrototype` defaults to `false`**, so prototype pollution defenses
  are off unless you enable them.
- **You do not control the webview’s patch cycle.** This is the flip side of shipping no
  engine: a user on an old OS runs an old, potentially vulnerable webview, and you
  cannot ship a fix. Electron’s bundled Chromium is a larger attack surface that *you*
  can patch.
- **`remote.urls`** in a capability grants remote origins access to commands.
  It is more granular than v1’s `dangerousRemoteDomainIpcAccess`, but still
  dangerous—and **on Linux and Android, iframes from remote origins cannot be
  distinguished from main-window requests**.

### Advisories That Set the Floor

From the GitHub security advisories of `tauri-apps/tauri` and
`tauri-apps/plugins-workspace`, observed 2026-11-08:

| Advisory | Severity, published | Affected | Fixed in | What it was |
| --- | --- | --- | --- | --- |
| [GHSA-w28w-mhc8-qvjv](https://github.com/tauri-apps/tauri/security/advisories/GHSA-w28w-mhc8-qvjv) | High, 2026-09-26 | `tauri` 2.0.0–2.11.5 | **2.11.6** (2026-09-19), carried into 2.12.0 | The internal channel-fetch command skipped the ACL check and keyed queued large IPC responses by a global sequential `u32`, so one webview could read and drain another’s payloads. No workaround. |
| [GHSA-7gmj-67g7-phm9](https://github.com/tauri-apps/tauri/security/advisories/GHSA-7gmj-67g7-phm9) | Medium, 2026-05-06 | `tauri` 2.0–2.11.0 | 2.11.1 | Origin confusion let remote pages invoke local-only IPC commands. |
| [GHSA-c9pr-q8gx-3mgp](https://github.com/tauri-apps/plugins-workspace/security/advisories/GHSA-c9pr-q8gx-3mgp) | High, 2025-04-02 | `tauri-plugin-shell` ≤ 2.2.0 | 2.2.1 | Improper scope validation in the `open` endpoint. |
| [GHSA-9g54-6x48-9vpw](https://github.com/tauri-apps/plugins-workspace/security/advisories/GHSA-9g54-6x48-9vpw) | Low, 2026-08-31 | `tauri-plugin-fs` < 2.5.2 | 2.5.2 | Default permissions were broader than intended. |

If you use the HTTP plugin, also enable its `scopeRedirects` option (2.7.0+). Without
it, a server on an allowed origin can redirect a request to any other origin, including
`localhost` services and cloud metadata endpoints, and the plugin follows.

### CSP: What the Docs Say and What Apps Do

The documentation recommends a real CSP. The ecosystem largely does not follow it, and a
guideline that ignored this would read as theoretical.
Of the fourteen apps surveyed:

| Approach | Count |
| --- | --- |
| CSP disabled outright (`null`) | 5 |
| Permissive (wildcards or `unsafe-eval`) | 3 |
| Moderate (per-domain, `unsafe-inline`) | 4 |
| **Strict (SHA-256 script hashes)** | **1** |

Only Wealthfolio does what the documentation actually recommends.
Apps that wrap external web content essentially cannot set a strict policy through
Tauri, because `app.security.csp` does not reach a remote page; the serving origin must
send its own.

The advice stands regardless: **set a CSP, and prefer script hashes to
`unsafe-inline`.** Tauri injects nonces and hashes at compile time for bundled code, so
a strict policy is more achievable here than the survey numbers suggest.
Configure it under `app.security.csp`, with `devCsp` for development.

* * *

## 6. Packaging, Signing, and Updates

### Bundle Targets

Seven targets: `app`, `dmg`, `nsis`, `msi`, `deb`, `rpm`, `appimage`. Flatpak and Snap
are external tooling—Flatpak community-maintained with a known D-Bus naming issue, Snap
officially documented.

### Bundle Size, Measured

Real release assets, not marketing figures:

| App | Artifact | Size |
| --- | --- | --- |
| Pake V3.18.0 thin wrappers (2026-11-04) | MSI | **3.6–4.0MB** |
| Pake V3.18.0 | deb | 4.6–5.6MB |
| Pake V3.18.0 | DMG, universal (arm64 and x86_64) | 8.7–14.1MB |
| Pake V3.18.0 | **AppImage** | **80.2–80.9MB** |
| Spacedrive 0.4.3 (heavy Rust), August 2026 survey | DMG | ~80-86MB |
| Clash Verge Rev 2.5.0 (~50MB sidecar), August 2026 survey | Windows x64 | 47MB |

Three honest conclusions.
The small-bundle claim is **true for `.msi` and `.deb` with a thin frontend**, and for a
DMG, which is roughly halved again by shipping arm64 only.
It is **false for AppImage**, which is about 80MB because it bundles WebKitGTK. And it
**collapses entirely once you add a sidecar or a substantial Rust backend**—at which
point your binary, not the framework, is the size.

The best like-for-like data point available: the Hoppscotch team reported going from
**165MB on Electron to 8MB on Tauri** for a pure web frontend.

### The Updater, and Why It Is the Headline Feature

Tauri’s updater verifies the payload before applying it.
From `plugins/updater/src/updater.rs` (2.14.x):

```rust
fn verify_signature(
    data: &[u8],
    release_signature: &str,
    pub_key: &str,
    announced_version: &str,
    require_signed_version: bool,
) -> Result<()> {
    let pub_key_decoded = base64_to_string(pub_key)?;
    let public_key = PublicKey::decode(&pub_key_decoded)?;
    let signature_base64_decoded = base64_to_string(release_signature)?;
    let signature = Signature::decode(&signature_base64_decoded)?;

    // Validate signature or bail out
    public_key.verify(data, &signature, true)?;

    // Only now is the trusted comment usable: the global signature covers it.
    verify_signed_version(signature.trusted_comment(), announced_version, require_signed_version)
}
```

The verification uses **minisign**, runs against the **downloaded bytes**, checks them
with a **public key compiled into your application** (`plugins.updater.pubkey`, embedded
by `generate_context!`), and **aborts the update on failure**. Since 2.14.0,
`Update::install` verifies the bytes again before installing, so a cached or restored
package is rechecked too; `Update::verify` exposes the same check.

Why this matters more than it sounds: the private key never touches the update server,
so **compromising your update host is not sufficient to ship code to your users**.
Integrity comes from the key, not from trusting the host.
Generate the keypair with `tauri signer generate`, keep the private key in CI secrets as
**`TAURI_SIGNING_PRIVATE_KEY`** (or point `TAURI_SIGNING_PRIVATE_KEY_PATH` at a file;
the older `TAURI_PRIVATE_KEY` is still read), and put the public key in your config.

**The signature binds the version; enforce it.** The update manifest is fetched over TLS
but is not itself signed, and the signature alone covers only the artifact.
Since CLI 2.12.0, `tauri build` writes `version:<x>` into the minisign trusted comment,
which the signature covers (`tauri signer sign --app-version` does the same by hand).
The updater compares that signed version with the one the manifest announces and rejects
a mismatch. A signature with no version, made by an older CLI or by hand without
`--app-version`, still passes unless **`requireSignedVersion: true`** (updater 2.12.0+).
Without the flag, anyone who can serve your manifest can pair a new version number with
an older release whose signature carries no version and force a downgrade to that
genuine but outdated build.
Enable it from the first release; `tauri plugin add updater` now does.
For an existing app, re-sign and republish every release your users can still update
from, then enable it.

**Downgrades are an app decision, not a page decision.** Updater 2.12.0 removed
`allowDowngrades` from the JavaScript `check()` options, where any page script could
relax “must be newer” to “must be different,” and moved it to plugin configuration.
It defaults to `false` and is ignored when you set
`Builder::default_version_comparator`.

**The macOS install is atomic.** Since 2.13.2 the updater extracts the new bundle on the
same volume, swaps it with `renamex_np(RENAME_SWAP)`, falls back to rename-and-restore,
and reports `Error::PreviousAppNotRestored` (keeping the old copy) if even that fails.
It asks for administrator rights through AppleScript when the app’s directory is not
writable.
Tauri relaunches through LaunchServices (`open -n`, since tauri 2.12.2), so the
new instance does not inherit the old one’s stdio and process group.
Use `AppHandle::request_restart()` to run exit callbacks reliably.
A main-thread call to `restart()` skips them.
[Tauri AppHandle API](https://docs.rs/tauri/2.12.5/tauri/struct.AppHandle.html#method.request_restart).

**The minisign key authorizes code.** The app, not a browser, downloads the update, so
the new bundle normally carries no quarantine attribute; what Gatekeeper checks for such
code is covered in
[Quarantine and Gatekeeper](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#quarantine-and-gatekeeper).
Protect the minisign private key as you protect the Developer ID key.

**App Translocation blocks self-update.** A quarantined app launched where the user
downloaded it, or straight from the mounted DMG, runs from a randomized read-only path,
and the updater cannot replace it.
Tell users to move the app to `/Applications`, or detect a translocated path and say so.

The wiring is three pieces.
First, tell the bundler to produce signed update artifacts, and give the updater plugin
your public key, endpoints, and the version requirement:

```json
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "pubkey": "…base64 minisign public key from tauri signer generate…",
      "endpoints": [
        "https://releases.example.com/{{target}}/{{arch}}/{{current_version}}"
      ],
      "requireSignedVersion": true
    }
  }
}
```

The `{{target}}`, `{{arch}}`, and `{{current_version}}` variables are substituted at
request time, so one endpoint template serves every platform.
Endpoints must use `https` unless you set `dangerousInsecureTransportProtocol`, and
2.14.0 warns when a download URL does not.

Second, host a manifest at that endpoint—either a static JSON file or a dynamic server
response:

```json
{
  "version": "1.2.0",
  "notes": "Release notes shown to the user",
  "pub_date": "2026-08-01T00:00:00Z",
  "platforms": {
    "darwin-aarch64": { "signature": "…", "url": "https://…/my-app.app.tar.gz" },
    "windows-x86_64": { "signature": "…", "url": "https://…/my-app-setup.exe" }
  }
}
```

The `signature` values are the contents of the `.sig` files the build emits beside each
updater artifact; the verification above runs against exactly these.

Third, check and install when your app wants to update.
From JavaScript, call `check()` and `downloadAndInstall()` from
`@tauri-apps/plugin-updater` (this needs the `updater:default` permission).
When the page should not control updates, drive it from Rust and grant no updater
permission. On Windows, updater 2.14.0 runs the installer and calls
`std::process::exit(0)`, bypassing `RunEvent::Exit`. Configure
`UpdaterBuilder::on_before_exit` to run the same `shutdown_backend` routine used on
normal exit and preserve the updater’s default Tauri cleanup call.
The hook runs before the installer launches, so report installer launch failures even if
the backend has already stopped.
[UpdaterBuilder API](https://docs.rs/tauri-plugin-updater/latest/tauri_plugin_updater/struct.UpdaterBuilder.html#method.on_before_exit),
[updater 2.14.0 source](https://github.com/tauri-apps/plugins-workspace/blob/updater-v2.14.0/plugins/updater/src/updater.rs#L944-L979).

```rust
use tauri_plugin_updater::UpdaterExt;

async fn update(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    let updater = app.updater_builder();
    #[cfg(windows)]
    let updater = {
        let handle = app.clone();
        updater.on_before_exit(move || {
            shutdown_backend(&handle);
            handle.cleanup_before_exit();
        })
    };

    if let Some(update) = updater.build()?.check().await? {
        update.download_and_install(|_chunk, _total| {}, || {}).await?;
        #[cfg(not(windows))]
        app.request_restart();
    }
    Ok(())
}
```

This is near-universal practice, not just documentation: **ten of the surveyed apps ship
the official updater, and every one of them ships a pubkey.**

### Code Signing

**macOS.** Sign with a Developer ID certificate and notarize.
In CI, `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD` import the certificate, and
either an App Store Connect API key (`APPLE_API_KEY`, `APPLE_API_ISSUER`,
`APPLE_API_KEY_PATH`) or Apple ID credentials (`APPLE_ID`, `APPLE_PASSWORD`,
`APPLE_TEAM_ID`) authenticate notarization.

One point worth stating because it is widely assumed otherwise: **Tauri does not need
JIT entitlements.** Electron requires `com.apple.security.cs.allow-jit` because it signs
its own Chromium processes, in which V8 JIT-compiles; electron-builder 27’s default
template and `@electron/osx-sign`’s default app entitlements grant `allow-jit` and no
other code-signing exception.
Tauri’s web content runs in Apple’s own out-of-process `com.apple.WebKit.WebContent`,
which carries Apple’s entitlements.
Tauri’s signing documentation does not mention entitlements at all, and Spacedrive,
GitButler, and Modrinth ship no `Entitlements.plist` and notarize successfully.
Add entitlements for features you actually use—**Cap** ships them for camera,
microphone, USB, and library validation because it is a screen recorder loading its own
media sidecars, not because the webview demands it.

#### What the macOS Bundler Signs

Read from `tauri-bundler` 2.10.4 (`bundle/macos/app.rs`, `sign.rs`) and
`tauri-macos-sign` 2.4.3, the versions CLI 2.12.4 uses:

| Content | Signed by `tauri build`? |
| --- | --- |
| Main executable | Yes, with hardened runtime when enabled |
| Each `bundle.externalBin` | Yes, as an executable |
| `bundle.macOS.frameworks` (`.framework`, `.dylib`, and nested code inside them) | Yes |
| Anything under `bundle.resources` | **No** |
| Anything under `bundle.macOS.files` | **No** |
| The outer `.app` | Yes, last (inside-out order) |
| The `.dmg` | Signed, **not notarized** |

Each call is
`codesign --force -s <identity> [--options runtime] [--entitlements <file>]` with no
`--deep`, and **the same entitlements file is passed for every target**, sidecars
included. A request for per-sidecar entitlements
([#16211](https://github.com/tauri-apps/tauri/issues/16211), with PR #16212 adding
`sidecarEntitlements`) was closed as not planned on 2026-10-05.

Consequences and workarounds:

- **Sign Mach-O files under resources or `macOS.files` yourself, before `tauri build`.**
  The bundler copies them with whatever signature they have, and notarization rejects
  unsigned or ad-hoc code anywhere in the bundle.
  Sign each one inside-out with
  `codesign --force --options runtime --timestamp --sign "$IDENTITY"`, adding that
  binary’s own `--entitlements` where needed; the outer signature then seals them.
  Prefer `bundle.macOS.files` for trees with symlinks (a Python install links
  `bin/python3` to the versioned binary): it recreates symlinks, while
  `bundle.resources` follows them and copies each target as a separate file.

- **Give a sidecar different entitlements by not making it an `externalBin`.** The
  bundler re-signs every `externalBin` with `--force` and the app’s entitlements.
  Ship a pre-signed binary through `bundle.macOS.files` and spawn it by path, or build
  with `--no-sign` and sign and notarize the whole bundle yourself, inside-out.
  An interpreter that loads third-party native extensions under the hardened runtime
  needs `com.apple.security.cs.disable-library-validation` on that executable only; see
  `tbd guidelines desktop-python-runtime-patterns`.

- **Notarize the DMG yourself.** The bundler notarizes and staples only the `.app`.
  Submit the DMG with `xcrun notarytool submit --wait` and staple it with
  `xcrun stapler staple`, as Pake’s release workflow does in a separate step.

- **Test sidecar notarization in the first spike.**
  [#11992](https://github.com/tauri-apps/tauri/issues/11992) (open since 2024-12)
  reports “nested code is modified or invalid” failures with `externalBin`, root cause
  unresolved.

- `tauri build --no-binary-patching` (CLI 2.12+) leaves an already-signed main
  executable untouched.

- The bundler does not set `LSFileQuarantineEnabled`; keep it unset.
  With it, every file the app or its children download, including runtimes a sidecar
  fetches, is quarantined (see
  [Quarantine and Gatekeeper](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#quarantine-and-gatekeeper)).

**Windows.** Authenticode has required a hardware security module since June 2023, so a
local `.pfx` is no longer viable.
Use `signCommand` with Azure Key Vault or Azure Trusted Signing.

Then choose how WebView2 reaches the user via `webviewInstallMode` (sizes from the
[Windows installer docs](https://v2.tauri.app/distribute/windows-installer/)):

| Mode | Installer growth | Tradeoff |
| --- | --- | --- |
| `downloadBootstrapper` (default) | 0MB | Smallest installer; needs network at install time. |
| `embedBootstrapper` | ~1.8MB | Embeds the bootstrapper, which still downloads the runtime. |
| `offlineInstaller` | ~127MB | Fully offline install. |
| `fixedVersion` | ~180MB | Pins an engine version; you own its security updates. |
| `skip` | 0MB | Assumes it is present; the app will not launch if it is not. |

**Linux.** No signing story comparable to the other platforms; distribution goes through
deb, rpm, and AppImage.

### CI

You **cannot cross-compile macOS bundles**—build on each target OS. (A request to bundle
macOS from Linux, [#16340](https://github.com/tauri-apps/tauri/issues/16340), was closed
by its author on 2026-10-26 with its pull request unmerged.)
A realistic full matrix is five entries: macOS arm64, macOS x64, Ubuntu x64, Ubuntu
arm64, and Windows; a macOS-only, arm64-only app needs one.
Note that surveyed apps pin **`ubuntu-22.04` rather than a newer image**, because of
WebKit dependencies.
macOS universal binaries are an option but double the file size.

Pin actions by full commit SHA. `tauri-action` v1.0.0 (2026-06-29) made breaking
changes: `assetNamePattern` became `releaseAssetNamePattern`, `includeUpdaterJson`
became `uploadUpdaterJson`, `includeRelease`, `includeDebug`, and
`updaterJsonKeepUniversal` were removed (use `args: --debug` for debug builds), the
`.app.tar.gz` and `.sig` names now include the version, the `latest.json` download URLs
changed form, and Tauri v1 and v2 prereleases are no longer supported.

```yaml
- uses: Swatinem/rust-cache@d1527c8f67ef9af357290475d4af4b0fab8f12e0 # v2.9.3
  with:
    workspaces: src-tauri
- uses: tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f # action-v1.0.0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
    APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
    APPLE_API_KEY_PATH: ${{ runner.temp }}/AuthKey.p8 # written by an earlier step
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  with:
    tagName: v__VERSION__
    releaseName: v__VERSION__
    uploadUpdaterJson: true
    args: -- --locked
```

A plain script calling `tauri build -- --locked` and uploading the `.dmg`,
`.app.tar.gz`, `.sig`, and `latest.json` works as well.

**Budget for Rust build time honestly.** Measured macOS jobs on GitHub-hosted
`macos-latest` runners:

| Run | What it builds | Job | Bundle step |
| --- | --- | --- | --- |
| Pake `Build Single Popular App`, run 38505787689, 2026-10-14 | Thin wrapper, universal binary, notarized | **4m09s** | 2m42s build; DMG notarization 26s |
| Yaak `Release App Artifacts`, run 41178983389, 2026-10-31 | Heavy Rust app with a Node runtime resource, `rust-cache` warm | **21m49s** aarch64; 10m20s x86_64 | 14m46s; 6m06s |

So a thin shell costs a few minutes per macOS job and a large Rust app tens of minutes;
notarization cannot be cached, and its time depends on Apple’s queue.
Against a JavaScript-only pipeline this is a real multiple, and it is the cost that most
surprises teams arriving from Electron.
Locally, switching to the LLD linker is the single biggest win, taking one measured
incremental build from 14.8s to 3.7s.

* * *

## 7. The Rust Supply Chain

A Tauri app adds Cargo as a dependency ecosystem beside npm and whatever the backend
uses, and its graph is large.
Measured on 2026-11-08 with `cargo tree --target aarch64-apple-darwin -e normal,build`:
`tauri` 2.12.5 alone resolves 220 crate versions; adding the updater, single-instance,
deep-link, and window-state plugins brings it to 278, about 58 of them from the updater
(reqwest, hyper, rustls, ring, tar, minisign-verify, and others).

**Pinning only direct crates does not satisfy a cool-off.** The same day, a fresh
`cargo generate-lockfile` for those five crates resolved **19 of 278** crate versions
published within the previous 14 days (for example `cc` 1.11.1, `flate2` 1.1.11, `uuid`
1.29.1, and `smallvec` 1.16.5, all published 2026-11-06), although every direct crate
cleared the window. The young versions arrive through semver ranges in the dependencies’
own manifests.

Rules:

- **Commit `Cargo.lock` and build with `--locked` everywhere**, including
  `tauri build -- --locked`, so nothing re-resolves without review.

- **Use Cargo’s native publish-age gate once your toolchain respects it.**
  `registry.global-min-publish-age` (and per-registry
  `registries.<name>.min-publish-age`) makes the resolver skip versions newer than the
  window. `resolver.incompatible-publish-age` defaults to `"deny"`, which ignores such
  versions unless they are already in the lock file.
  The feature was stabilized in
  [rust-lang/cargo#17335](https://github.com/rust-lang/cargo/pull/17335) (merged
  2026-08-28), and the
  [Cargo configuration reference](https://doc.rust-lang.org/beta/cargo/reference/config.html)
  marks both keys “Respected as of 1.100+.” On 2026-11-08 stable was Rust 1.99.1 and
  1.100.0 was in beta, scheduled for release on 2026-11-12 on the six-week cadence.
  Pin the toolchain in `rust-toolchain.toml` so every machine enforces the same gate.

  ```toml
  # .cargo/config.toml
  [registry]
  global-min-publish-age = "14 days"

  [resolver]
  incompatible-publish-age = "deny" # the default, stated for readers
  ```

- **The gate acts only when resolving.** It does not audit a lock you already have, and
  the check-an-existing-lock half is still open
  ([rust-lang/cargo#17246](https://github.com/rust-lang/cargo/issues/17246)). When you
  adopt it, audit the current lock once against publish dates (the crates.io sparse
  index records each version’s `pubtime`).

- **Until then, choose versions by hand.** Hold the lock, and when you must update, pick
  a version at least 14 days old (`cargo info <crate>@<version>` shows its publish date)
  and apply it with `cargo update -p <crate> --precise <version>`.

- **Take security fixes inside the window through the documented exception** in
  `tbd guidelines supply-chain-hardening`, as you would have for tauri 2.11.6 when
  GHSA-w28w-mhc8-qvjv was published.

- **Audit in CI** with `cargo audit` or `cargo deny check advisories`. Tauri itself
  publishes `cargo vet` audits in its repository’s `supply-chain/` directory and runs an
  audit workflow.

* * *

## 8. What Actually Breaks Across Webviews

Shipping no engine means inheriting whatever engine the user has.
This section exists because “system webviews vary” is too vague to plan around.

### macOS: What WKWebView Does Not Do Until You Wire It

Read from wry 0.57.1 (`src/wkwebview/`) and tauri 2.12.5 on 2026-11-08. Most of these
fail silently, which is why they are easy to ship.

| Behavior | Default on macOS | Wire it with |
| --- | --- | --- |
| **`target=_blank` and `window.open`** | Without `on_new_window`, wry’s `createWebViewWithConfiguration` returns no view: **the click does nothing.** | `on_new_window`: hand external URLs to the default browser and return `NewWindowResponse::Deny`, or create a window for popups you want. |
| **Links to other origins** | Allowed: they replace your page in the app window. | `on_navigation`: allow same-origin, send the rest to the browser through a scheme allowlist. |
| **Downloads** | Without `on_download`, navigations WebKit marks as downloads (including `<a download>`) are **cancelled**, and responses WebKit cannot display are neither shown nor saved. | `on_download` returning `true`: wry saves to `~/Downloads` under the suggested name, adding ` (n)` on collision. Set `destination` in `DownloadEvent::Requested` to choose; reveal the file on `Finished`. |
| **Reload, Back and Forward, Zoom** | The default macOS menu (used when you set none) has App, File, Edit, View, Window, and Help, but View holds only Enter Full Screen. **No Reload, Back, Forward, or zoom.** Tauri 2 has no `go_back` and does not expose wry’s back/forward swipe option. | A custom menu: `webview.reload()`, `eval("history.back()")` and `eval("history.forward()")`, and `set_zoom` from Rust for Cmd+=, Cmd+-, and Cmd+0. The `zoom_hotkeys_enabled` polyfill needs `core:webview:allow-set-webview-zoom`, which a remote origin does not have. |
| **Copy, paste, undo** | Work only because the default menu has Edit items with those key equivalents. | When you replace the menu, keep the predefined Edit items. |
| **Find in page** | No find bar, and no find API on macOS in Tauri or wry: **Cmd+F does nothing.** | Bind Cmd+F to the app’s own search, or call WKWebView’s find API through `with_webview` and objc2. |
| **`alert`, `confirm`, `prompt`** | wry implements none of WebKit’s JavaScript panel delegate methods, so WebKit behaves as if each was dismissed. The dialog plugin’s replacements go through IPC, which a remote origin cannot use. | In-page dialogs. |
| **Drag and drop** | Either-or. With the default handler, wry consumes drags without passing them to WebKit, so **HTML5 drops, including in-page element drag-and-drop, do not fire**; Rust instead receives `DragDropEvent::Drop { paths }` with **real filesystem paths**, which a browser page never gets. | Keep the handler for “drop a folder to open it.” For HTML5 drag-and-drop, call `disable_drag_drop_handler()` on windows built in Rust (the `dragDropEnabled` config key does not apply to them, [#13761](https://github.com/tauri-apps/tauri/issues/13761)); files then arrive as `File` objects without paths. Both at once waits on draft PR [#16373](https://github.com/tauri-apps/tauri/pull/16373). |
| **Devtools in release builds** | Need the `devtools` Cargo feature, which uses the public `isInspectable` (macOS 13.3+) plus the private `developerExtrasEnabled` key and `_inspector`. **This makes the app ineligible for the App Store**; Developer ID distribution is unaffected. | Put devtools behind a menu item. Safari’s Develop menu can also attach to an inspectable webview. |
| **`<input type=file>`** | Works (wry implements the open panel). | Nothing. |
| **Hidden windows** | WebKit throttles timers in hidden or minimized views. | `background_throttling` (macOS 14+) if background work such as an event stream must keep up. |

**WebKit becomes the app’s engine.** The engine is whatever WebKit the user’s Safari
ships: Safari 27 (2026-09-14) is available for macOS Sequoia and Tahoe, so macOS 15 and
later share a current engine while older systems stay behind.
The bundler’s default `minimumSystemVersion` is 10.13; raise it to the oldest macOS you
test, since it sets your CSS and JavaScript floor (13.3 for public `isInspectable`, 14.0
for `background_throttling` and `data_store_identifier`). **Performance work measured in
Chromium does not transfer.** Any size limit, render budget, or virtualization threshold
you set from Chrome measurements needs re-measuring in WebKit, and APIs you use without
feature detection need checking there.
Electron avoids this cost by shipping Chromium; Tauri 3’s CEF runtime avoids it only by
becoming Electron-sized ([§10](#10-tauri-30)).

### Linux Is the Weak Platform

Every item below is an open or documented issue, not speculation:

- **WebRTC is unavailable** in WebKitGTK as shipped by most distributions.
  It works on Windows and macOS. If your app does video calling, Linux is not a target
  today.
- **Audio and video served through custom protocols do not play.** Files delivered via
  `convertFileSrc` or the asset protocol fail with `NotSupportedError`. This is
  Linux-specific and affects the ordinary way Tauri apps serve local media.
- **Drag-and-drop is broken** across several issues: the drop event never fires, and
  file drops can navigate the webview to the file instead.
- **Wayland rendering glitches:** maximizing produces duplicated “shadow” DOM over real
  content, reproducible on a vanilla scaffold.
- **Performance degrades** until devtools is opened, and CSS animations blur the app.
- Child webviews require X11.

Engine capability tracks the distribution: Ubuntu 22.04 ships WebKitGTK 2.36 (roughly
Safari 16), Ubuntu 20.04 ships 2.28-2.32. Your users’ CSS and JavaScript support is set
by their OS, not your build.

**The GTK4 and WebKitGTK 6.0 migration**
([#14684](https://github.com/tauri-apps/tauri/pull/14684)) addresses much of this.
It was an open pull request on 2026-11-08, last updated 2026-05-29, not a shipped fix.

### Windows and Cross-Platform

- **Windows:** on machines without WebView2, the installer triggers a UAC prompt to
  install “Windows Edge Update,” which looks alarming to users; declining leaves an app
  that cannot launch. Apps also fail to start under Windows Administrator Protection.
- **macOS media:** WKWebView restricts media autoplay, and `convertFileSrc` fails on
  very large files.
- **Fonts render differently on every platform** (DirectWrite, CoreText, FreeType).
  Bundle your own fonts if visual consistency matters.

* * *

## 9. What Shipping Apps Actually Do

Fourteen serious open-source apps surveyed in August 2026, read from their configuration
rather than their READMEs, plus two November additions.

| App | What it demonstrates |
| --- | --- |
| [Modrinth](https://github.com/modrinth/code) | **Best capability architecture**: three capability files, URL-scoped HTTP, path-scoped fs. |
| [Spacedrive](https://github.com/spacedriveapp/spacedrive) | Window-name-scoped capabilities; a Rust `sd-daemon` sidecar. |
| [GitButler](https://github.com/gitbutlerapp/gitbutler) | Custom CI pipeline; `createUpdaterArtifacts: "v1Compatible"` for existing installs. |
| [Cap](https://github.com/CapSoftware/Cap) | Media sidecar pipeline; `tauri-specta` for type-safe IPC bindings. |
| [Hoppscotch](https://github.com/hoppscotch/hoppscotch) | Reported 165MB → 8MB moving off Electron. |
| [Yaak](https://github.com/mountain-loop/yaak) | Bundles a **Node.js runtime as a resource** for its plugin system. |
| [Wealthfolio](https://github.com/afadil/wealthfolio) | **The only app with a strict CSP** (SHA-256 script hashes); ships mobile. |
| [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) | Go proxy sidecar; multiple updater endpoints with mirrors. Also the broadest permissions. |
| [Pake](https://github.com/tw93/Pake) | Thin wrappers around existing web apps; separate DMG notarization step in CI. |
| [Livebook](https://github.com/livebook-dev/livebook) | Replaced a native Swift macOS shell and a C# Windows shell with one Tauri app ([#3112](https://github.com/livebook-dev/livebook/pull/3112), merged 2026-01-07); the legacy shells were deleted on 2026-04-10. |

Patterns appearing in three or more apps, which is the bar for putting something in a
guideline:

- **The official updater with a minisign pubkey** (10 apps—the strongest consensus in
  the dataset).
- **Plugins:** `deep-link` (7), `window-state` (7), `single-instance` (6).
- **`fs:scope` confined to `$APPDATA/**`** as the minimum viable filesystem scope.
- **Cargo features** `devtools` and `protocol-asset` (6 apps each).
- **`macOSPrivateApi: true`** for vibrancy and transparency (4 apps).
  Since 2.12.1 it is no longer required for transparency or fullscreen, so drop it
  unless you use another private API.
- **Custom title bars** via `titleBarStyle: "Overlay"` or `hiddenTitle` (4 apps).
- **Vite** as the bundler, near-universally.

**No frontend framework dominates:** React and Next.js account for five apps, Vue three,
Svelte and Solid one each.
Framework choice is team preference, not a Tauri constraint.

**Mobile remains the exception**—only two of fourteen ship it, despite Tauri 2
supporting iOS and Android since 2024.

**The v2 migration is effectively complete.** Twelve of fourteen are on v2, and both v1
holdouts show reduced maintenance.

* * *

## 10. Tauri 3.0

Status on 2026-11-08, from crates.io, the `v3` branch, and the
[3.0 milestone](https://github.com/tauri-apps/tauri/milestone/5):

- **Alpha only.** `tauri` 3.0.0-alpha.0 shipped 2026-09-13 and alpha.6 on 2026-11-06,
  seven alphas in eight weeks.
  The [Tauri blog](https://tauri.app/blog/) has no 3.0 post or date; its newest post
  announces 2.12 (2026-09-26). The 3.0 milestone had 11 open and 5 closed items, and a
  2.13 milestone (30 open) shows 2.x is still developed.
- **Do not pin alphas** in a product.
  They are far inside any cool-off and change weekly.
- **Pluggable runtimes are the headline change.** The app depends on a runtime crate and
  selects it with `tauri::Builder::default().runtime(tauri_runtime_wry::Wry::default())`
  or `tauri_runtime_cef::Cef::default()`. `tauri-runtime-cef` bundles Chromium through
  CEF and, on macOS, replaces WKWebView; the v3 bundler creates the CEF helper apps.
  `tauri-runtime-cef` 3.0.0-alpha.7 pins `cef` 154.5.0 (CEF 154.0.34), whose macOS arm64
  *minimal* distribution is 126.1MiB compressed; the current CEF 156.0.26 is 128.7MiB
  ([CEF builds index](https://cef-builds.spotifycdn.com/index.json)). **A CEF-runtime
  app is Electron-sized**, so it trades away Tauri’s size advantage for engine control.
- **Linux remains open.** The CEF runtime uses GTK 4, while the wry runtime stays on GTK
  3 until [#14684](https://github.com/tauri-apps/tauri/pull/14684) lands.
- **Other changes that touch an app:** MSRV 1.95; the `macos-private-api` feature and
  `macOSPrivateApi` config are removed because transparency and fullscreen no longer use
  private APIs; the `devtools` and `unstable` features move to the runtime crate; and a
  new `Plugin::cleanup_before_exit` hook runs on exit paths that bypass the event loop,
  such as `AppHandle::restart`.
- **Porting cost:** small for a thin shell that registers no commands, and proportional
  to custom plugin and runtime-API use otherwise.

* * *

## Best Practices

- [ ] Pin **tauri 2.12.5** today and never below **2.11.6** (GHSA-w28w-mhc8-qvjv).
- [ ] Check every plugin pin, and the full lockfile, against the 14-day cool-off.
- [ ] Commit `Cargo.lock`, build with `--locked`, and set
  `registry.global-min-publish-age = "14 days"` once the toolchain is Rust 1.100+.
- [ ] Match plugin crate and JS package versions; do not force core crates to one
  number.
- [ ] Keep `withGlobalTauri` off and import `@tauri-apps/api` instead.
- [ ] Scope capabilities to specific windows where you can, and to `$APPDATA` at minimum
  for the filesystem.
- [ ] For a loopback web app, grant **zero capabilities** and keep the server’s origin
  out of `devUrl` and `frontendDist`.
- [ ] Follow the shell–server contract: port 0, a JSON ready line, the per-launch secret
  as the first stdin line, stdin kept open, and a session cookie for the web view.
- [ ] **Rewrite capabilities by hand when migrating from v1**; never ship
  `migrated.json`.
- [ ] Set a CSP with script hashes, and `devCsp` separately for development.
- [ ] Enable `security.freezePrototype` unless a dependency breaks under it.
- [ ] Use the Isolation pattern if your frontend has a large dependency tree.
- [ ] Ship the official updater with `bundle.createUpdaterArtifacts: true`, a minisign
  key kept in CI secrets only, and **`requireSignedVersion: true`**.
- [ ] Drive the updater from Rust when the page has no reason to control it.
- [ ] Use `ipc::Response` or `Channel<T>` for binary and streaming payloads.
- [ ] Suffix sidecar binaries with the correct target triple, and remember the Rust and
  JS APIs take different path arguments.
- [ ] Supervise Rust-spawned children in a Unix process group or Windows Job Object.
  Run bounded shutdown and reap the child in `RunEvent::Exit` and the Windows updater’s
  pre-exit hook.
- [ ] Pre-sign every Mach-O file under `bundle.resources` or `bundle.macOS.files`, and
  notarize the DMG yourself.
- [ ] On macOS, wire `on_new_window`, `on_navigation`, `on_download`, and a menu with
  Reload, Back, Forward, zoom, Find, and the Edit items.
- [ ] Re-measure Chromium-derived performance limits in WebKit before shipping on macOS.
- [ ] Pin `ubuntu-22.04` in CI for WebKit compatibility.
- [ ] Pin actions by commit SHA, cache Rust builds with `Swatinem/rust-cache`, and
  expect notarization to stay uncached.
- [ ] Test on real Linux hardware early if Linux matters.

* * *

## Open Research Questions

1. **When does the GTK4 and WebKitGTK 6.0 migration land for the wry runtime, and does
   it resolve the Linux media and drag-and-drop problems?** This is the single largest
   open question for anyone targeting Linux.

2. **What is the practical exposure from the unpatched-webview problem?** Users on old
   operating systems run old engines, and no data was found quantifying how often that
   matters in the field.

3. **Is the Isolation pattern’s overhead acceptable for high-frequency IPC?** The
   documentation says most apps will not notice; no benchmark was found.

4. **Why do so few apps set a strict CSP?** The survey shows the gap clearly but not
   whether the cause is difficulty, tooling friction, or inattention.

5. **Does `fixedVersion` WebView2 make sense for enterprise deployment**, given it moves
   engine security updates onto you?

6. **What causes the `externalBin` notarization failures in #11992?** No root cause was
   published as of 2026-11-08.

7. **What does a thin Tauri shell cost in idle memory and clean build time on Apple
   Silicon?** No reproducible measurement was found; measure the whole process group
   (app, WebKit WebContent and Networking processes, and the backend) with `footprint`.

* * *

## Recommendations

### When Tauri Is the Right Choice

- You want a small, signed, auto-updating desktop app and can accept Rust in the build.
- **Update integrity matters.** The signed updater is the strongest reason to choose
  Tauri over less mature small-bundle frameworks.
- **You already have a local web server** and want a native window, menus, file
  associations, and verified updates around it with little code
  ([§4](#4-wrapping-an-existing-loopback-web-app)).
- Your team is comfortable with a permission model that must be configured deliberately.
- You are Windows-first or macOS-first, with Linux as a secondary target you will test.
- You want mobile from the same codebase, accepting that backend logic must be plugins
  or Rust rather than sidecars.

### When to Choose Something Else

- **Your app depends on WebRTC, media playback through local protocols, or drag-and-drop
  on Linux.** Verify before committing.
- **You need a guaranteed rendering engine across platforms**, or Chromium parity with
  performance work already measured in Chrome.
  Electron ships one; Tauri inherits whatever is installed until its CEF runtime is
  stable, and that runtime is Electron-sized.
- **Your CI budget cannot absorb Rust build times.**
- **You need a consistent Chromium renderer sandbox across your desktop targets.**
  Electron ships Chromium.
  With Tauri, verify the system webview’s isolation on every supported platform.
- **Your team will write no Rust and your backend cannot be a sidecar**—for example
  because you need mobile support.
- **You ship on macOS only and want the thinnest possible layer.** A hand-written AppKit
  and WKWebView shell in Swift has the same engine and the same gaps as Tauri on macOS,
  but no Rust toolchain or bundler, and direct access to what Tauri does not expose (a
  quit veto through `applicationShouldTerminate:`, a Dock menu, the native find bar).
  See `tbd guidelines macos-webview-shell-patterns`. The cost arrives if you go
  cross-platform later: one native shell per OS. Livebook ran Swift and C# shells from
  2023 and consolidated them into one Tauri app in 2026.

Choose **Electron** for maximum maturity, a controlled engine, the richest ecosystem,
and a real renderer sandbox; see `tbd guidelines electron-app-development-patterns`.
Choose **Electrobun** only for internal or trusted-audience distribution; see
`tbd guidelines electrobun-app-development-patterns`, and note its updater performs no
verification.

### If You Adopt It

Pin tauri 2.12.5 (never below 2.11.6) and plugins that clear the cool-off, commit and
lock `Cargo.lock`, scope capabilities deliberately rather than accepting the migration
output, ship the signed updater with `requireSignedVersion` from day one, and
[supervise every Rust-spawned child](#process-lifecycle).
Budget for Rust build times in CI and a WebKit QA pass on macOS. Put a real Linux
machine in your test matrix before you promise Linux support.
For a Python backend, ship uv as a signed `externalBin` and let it install the pinned
interpreter and locked environment into app data on first run; see
`tbd guidelines desktop-python-runtime-patterns`.

* * *

## References

### Official

- [Tauri 2 documentation](https://v2.tauri.app/)
- [Security and capabilities](https://v2.tauri.app/security/capabilities/)
- [Permissions reference](https://v2.tauri.app/security/permissions/)
- [Isolation pattern](https://v2.tauri.app/concept/inter-process-communication/isolation/)
- [Updater plugin](https://v2.tauri.app/plugin/updater/)
- [Embedding external binaries](https://v2.tauri.app/develop/sidecar/)
- [macOS signing](https://v2.tauri.app/distribute/sign/macos/)
- [Windows installer and `webviewInstallMode`](https://v2.tauri.app/distribute/windows-installer/)
- [Webview versions](https://v2.tauri.app/reference/webview-versions/)
- [Announcing Tauri 2.12](https://tauri.app/blog/tauri-2.12/) (2026-09-26)
- [tauri-action v1.0.0 release notes](https://github.com/tauri-apps/tauri-action/releases/tag/action-v1.0.0)
- [Cargo configuration reference (beta)](https://doc.rust-lang.org/beta/cargo/reference/config.html),
  for `min-publish-age`
- [awesome-tauri](https://github.com/tauri-apps/awesome-tauri)

### Source Read (2026-11-08)

- tauri `tauri-v2.12.5`: `crates/tauri/src/webview/mod.rs` (`is_local_url`, the
  `on_message` ACL branch), `crates/tauri/src/manager/webview.rs`,
  `crates/tauri/src/menu/menu.rs` (default menu), `crates/tauri/src/app.rs`,
  `crates/tauri-runtime-wry/src/lib.rs`, `crates/tauri-bundler/src/bundle/macos/`,
  `crates/tauri-macos-sign/src/keychain.rs`, and the `tauri` and `tauri-cli` changelogs
- plugins-workspace `v2`: `plugins/updater/src/{updater.rs,config.rs}`,
  `plugins/shell/src/{lib.rs,commands.rs,process/mod.rs}`, and each plugin’s changelog
- wry `wry-v0.57.1`: `src/wkwebview/`; tao `tao-v0.37.2`:
  `src/platform_impl/macos/app_delegate.rs`; tauri `v3` branch changelogs

### Advisories

- [GHSA-w28w-mhc8-qvjv](https://github.com/tauri-apps/tauri/security/advisories/GHSA-w28w-mhc8-qvjv)
- [GHSA-7gmj-67g7-phm9](https://github.com/tauri-apps/tauri/security/advisories/GHSA-7gmj-67g7-phm9)
- [GHSA-c9pr-q8gx-3mgp](https://github.com/tauri-apps/plugins-workspace/security/advisories/GHSA-c9pr-q8gx-3mgp)
- [GHSA-9g54-6x48-9vpw](https://github.com/tauri-apps/plugins-workspace/security/advisories/GHSA-9g54-6x48-9vpw)

### Issues and Pull Requests Cited

- [WebRTC unavailable on Linux (wry#85)](https://github.com/tauri-apps/wry/issues/85)
- [Media via custom protocol fails on Linux (#3725)](https://github.com/tauri-apps/tauri/issues/3725)
- [Drag-and-drop on Linux (#9725)](https://github.com/tauri-apps/tauri/issues/9725)
- [Wayland shadow DOM duplication (#13157)](https://github.com/tauri-apps/tauri/issues/13157)
- [WebView2 install UX (#4389)](https://github.com/tauri-apps/tauri/issues/4389)
- [Windows Administrator Protection (#13926)](https://github.com/tauri-apps/tauri/issues/13926)
- [`ExitRequested` not fired on macOS (#9198)](https://github.com/tauri-apps/tauri/issues/9198)
- [macOS HTML5 drag-and-drop fix, draft (#16373)](https://github.com/tauri-apps/tauri/pull/16373)
- [`dragDropEnabled` ignored for Rust-built windows (#13761)](https://github.com/tauri-apps/tauri/issues/13761)
- [Sidecars signed with the app’s entitlements, not planned (#16211)](https://github.com/tauri-apps/tauri/issues/16211)
- [Sidecar notarization failures (#11992)](https://github.com/tauri-apps/tauri/issues/11992)
- [macOS Dock menu (#9916)](https://github.com/tauri-apps/tauri/issues/9916)
- [macOS bundles from Linux, closed unimplemented (#16340)](https://github.com/tauri-apps/tauri/issues/16340)
- [GTK4 and WebKitGTK 6.0 migration (#14684)](https://github.com/tauri-apps/tauri/pull/14684)
- [Cargo min-publish-age stabilization (cargo#17335)](https://github.com/rust-lang/cargo/pull/17335)
  and [lock enforcement (cargo#17246)](https://github.com/rust-lang/cargo/issues/17246)
- [Livebook Desktop with Tauri (livebook#3112)](https://github.com/livebook-dev/livebook/pull/3112)

### Measurements

- [Pake V3.18.0 release assets](https://github.com/tw93/Pake/releases/tag/V3.18.0)
- GitHub Actions runs `tw93/Pake` 38505787689 and `mountain-loop/yaak` 41178983389
- [CEF builds index](https://cef-builds.spotifycdn.com/index.json)
- [Safari 27 security content](https://support.apple.com/en-us/149039)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
