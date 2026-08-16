---
title: Tauri App Development Patterns
description: Building desktop apps with Tauri 2—the Rust core and system webview model, capabilities and permissions, typed commands and IPC, attaching Rust or non-Rust backends, packaging, signing, and the signed updater
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: desktop
---
# Tauri App Development Patterns

**Last Updated**: 2026-08-16

**Related**:

- [Tauri documentation](https://v2.tauri.app/)
- [Tauri source](https://github.com/tauri-apps/tauri)
- [awesome-tauri](https://github.com/tauri-apps/awesome-tauri)
- [Companion: Electron App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electron-app-development-patterns.md)
- [Companion: Electrobun App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electrobun-app-development-patterns.md)

* * *

## Updating This Document

Tauri releases steadily and its 2.x line is stable, so the facts here age more slowly
than in the Electrobun guideline.
The parts most worth rechecking are the Linux webview situation and the Tauri 3.0
roadmap, both of which are actively changing.

### Last Researched Versions

Observed 2026-08-16 by querying crates.io and the npm registry directly.
Every pin below clears the 14-day cool-off in `tbd guidelines supply-chain-hardening` by
at least 46 days.

| Thing | Version | Check For Updates |
| --- | --- | --- |
| **tauri** (Rust crate) | 2.11.5 | [crates.io/crates/tauri](https://crates.io/crates/tauri)—published 2026-07-01. Still the 2.x line; **no v3 yet**. |
| **tauri-build** | 2.6.3 | Versions on its own 2.6.x line, not in lockstep with the core crate. |
| **tauri-cli / @tauri-apps/cli** | 2.11.4 | Published 2026-06-28. |
| **@tauri-apps/api** | 2.11.1 | Published 2026-06-17. |
| **tauri-plugin-updater / @tauri-apps/plugin-updater** | 2.10.1 | Rust crate and JS package share a version. |
| **tauri-plugin-shell / @tauri-apps/plugin-shell** | 2.3.5 | Needed for sidecars. |
| **Minimum version to pin** | **2.11.1** | 2.11.1 shipped security fixes: ACL enforcement for remote origins, and localhost suffix handling. Do not pin below it. |
| **Linux webview** | webkit2gtk **4.1** | `4.0` was removed in Ubuntu 24 and Debian 13. Engine capability tracks the distro, not your build. |
| **Windows webview** | WebView2 (Evergreen) | Preinstalled on Windows 11; bootstrapped on older versions. |

A version-alignment note, because the obvious guess is wrong: **the ecosystem is
near-lockstep but not uniform.** A plugin’s Rust crate and JS package share a version
(`tauri-plugin-updater` 2.10.1 matches `@tauri-apps/plugin-updater` 2.10.1), but the
core crates version independently—`tauri` at 2.11.5, the CLI at 2.11.4, `tauri-build` at
2.6.3. Match plugin pairs; do not try to force the core crates to one number.

### Reminders When Updating

1. **Recheck the Linux webview story first.** It is the weakest part of Tauri and the
   part changing fastest.
   Tauri 3.0’s headline item is the GTK4 and WebKitGTK 6.0 migration, which addresses
   much of [What Breaks on Linux](#6-what-actually-breaks-across-webviews).

2. **Recheck the security advisories** and the minimum safe version.
   The 2.11.1 fixes above are the current floor.

3. **Recheck `webviewInstallMode` sizes.** The bootstrapper options change, and
   `embedBootstrapper` currently costs roughly 190MB.

4. **Re-measure bundle sizes** rather than repeating claims.
   The numbers here come from real release assets and vary enormously with what you put
   in the Rust half.

5. **Recheck the deprecation list.** The signer environment variables were renamed
   recently and the tray API is deprecated.

* * *

## Executive Summary

Tauri builds desktop apps from a Rust core plus the operating system’s own webview.
It ships no browser engine, which is where its small bundles come from, and it replaces
Electron’s “secure it yourself” posture with a compile-time permission system that
denies everything by default.

Four things matter most when deciding:

- **The updater verifies what it installs.** The downloaded payload is checked with
  minisign against a public key compiled into your app, and the update aborts if
  verification fails. This is a categorical difference from an updater that trusts its
  host, and it is the single strongest reason to prefer Tauri over less mature
  alternatives.

- **The security model is genuinely two-sided.** `core:default` grants around 106 window
  and menu permissions and *zero* filesystem, shell, or network access, so the deny-all
  baseline is real. But there is no equivalent of Electron’s OS-level renderer sandbox,
  CSP is off by default, and **the webview’s patch cycle belongs to the user’s operating
  system, not to you**.

- **Linux is the weak platform.** WebRTC is unavailable in distro WebKitGTK, media
  served through Tauri’s own asset protocol does not play, and drag-and-drop is broken
  across several open issues.
  If Linux is a first-class target, read
  [What Breaks](#6-what-actually-breaks-across-webviews) before committing.

- **You pay in build time, not in bundle size.** Rust builds impose a real 3-5x CI
  penalty against a JavaScript-only toolchain, and you cannot cross-compile.

**Recommendation in one line:** the default choice when you want a small, signed,
auto-updating desktop app and can accept Rust in the build and system webviews in the
product—with Linux support verified early rather than assumed.

**Research questions this document answers**:

1. What runs where, and what is the actual security boundary?
2. How do capabilities and permissions work, and how tightly do real apps scope them?
3. How do you attach a backend—in Rust, or in Python, Node, Bun, or Go?
4. What does it take to package, sign, and ship verified updates?

* * *

## 1. Architecture and the Process Model

### The Layers

| Layer | What it is | Role |
| --- | --- | --- |
| **Rust core** | Your `src-tauri` crate | Privileged process. Owns the filesystem, OS APIs, and command handlers. |
| **TAO** | Windowing crate (0.36.0) | Windows, menus, tray, events. |
| **WRY** | Webview abstraction (0.56.0) | Wraps each platform’s native webview. |
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

The raw-binary path is worth knowing about before you need it: a 64KB binary round trip
measures roughly **600µs through `ipc::Response` against about 6.7ms through standard
JSON serialization**. If you move images, audio, or file contents across the boundary,
this is a tenfold difference, not a micro-optimization.

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
and **deny always beats allow**.

### What You Get by Default

`core:default` grants roughly **106 window permissions, 42 menu, 24 tray, and 24 app
permissions—and no filesystem, shell, HTTP, or plugin access whatsoever.** That is the
fact to internalize: the default is a fully usable UI with no reach into the machine.
Every capability beyond drawing a window is something you deliberately added.

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

A second gotcha, easy to lose an hour to: **the Rust and JavaScript APIs take different
arguments.** `Command::sidecar()` in Rust takes the **filename only**, while
`Command.sidecar()` in JavaScript takes the **full `externalBin` path**.

Spawning a sidecar requires permissions, each with a scope marking it as a sidecar:

```json
{
  "identifier": "shell:allow-spawn",
  "allow": [{ "name": "binaries/my-sidecar", "sidecar": true }]
}
```

You will typically also need `shell:allow-kill` and, if you write to the process,
`shell:allow-stdin-write`.

### Non-Rust Backends

| Language | Approach | Cost |
| --- | --- | --- |
| **Go** | Compile a static binary. No extra tooling. | Smallest and simplest. |
| **Bun** | `bun build --compile` produces a single executable. | **~29MB added to a .dmg**, against ~5MB for pure Rust. |
| **Node** | The official docs use `@yao-pkg/pkg`. No real Node SEA examples were found in the wild. | Comparable to Bun. |
| **Python** | PyInstaller sidecar, or PyTauri with python-build-standalone. | Largest; see below. |

For **Python**, the PyInstaller route is the well-trodden one and has a working
reference implementation, but two problems recur: one-file mode (`-F`) unpacks on every
launch and is slow, and shutdown is unreliable because the PyInstaller bootloader’s PID
differs from the Python process’s PID, so killing the PID you spawned may leave the
interpreter alive.
PyTauri with python-build-standalone is better integrated but drags in
PyO3 and platform-specific rpath and linker configuration.
The tradeoffs mirror those in `tbd guidelines electron-app-development-patterns`, which
covers Python packaging in more depth; the analysis is framework-independent.

### Process Lifecycle

Sidecars spawned through the shell plugin **are** tracked and killed when the app exits.
Orphans still occur in three edge cases worth guarding against: `prevent_exit()`
combined with `AppHandle::exit()` on Windows, the macOS `MenuItem::Quit` bypassing
`RunEvent` handlers, and grandchild processes that escape the process group.

The reliable pattern is to build explicitly and handle exit:

```rust
tauri::Builder::default()
    .build(tauri::generate_context!())?
    .run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            // kill children held in managed state
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

* * *

## 4. Security Baseline

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

- **There is no equivalent of Electron’s renderer sandbox.** Electron’s sandbox
  restricts renderer syscalls at the OS level.
  Tauri has no such layer.
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
Apps that wrap external web content essentially cannot set a strict policy.

The advice stands regardless: **set a CSP, and prefer script hashes to
`unsafe-inline`.** Tauri injects nonces and hashes at compile time for bundled code, so
a strict policy is more achievable here than the survey numbers suggest.
Configure it under `app.security.csp`, with `devCsp` for development.

* * *

## 5. Packaging, Signing, and Updates

### Bundle Targets

Seven targets: `app`, `dmg`, `nsis`, `msi`, `deb`, `rpm`, `appimage`. Flatpak and Snap
are external tooling—Flatpak community-maintained with a known D-Bus naming issue, Snap
officially documented.

### Bundle Size, Measured

Real release assets, not marketing figures:

| App | Artifact | Size |
| --- | --- | --- |
| Pake 3.15.6 (thin wrapper) | MSI | **3.5MB** |
| Pake 3.15.6 | deb | 4.5MB |
| Pake 3.15.6 | DMG | 9.4MB |
| Pake 3.15.6 | **AppImage** | **75.5MB** |
| Spacedrive 0.4.3 (heavy Rust) | DMG | ~80-86MB |
| Clash Verge Rev 2.5.0 (~50MB sidecar) | Windows x64 | 47MB |

Three honest conclusions.
The small-bundle claim is **true for `.msi` and `.deb` with a thin frontend**. It is
**false for AppImage**, which is always 70MB or more because it bundles WebKitGTK. And
it **collapses entirely once you add a sidecar or a substantial Rust backend**—at which
point your binary, not the framework, is the size.

The best like-for-like data point available: the Hoppscotch team reported going from
**165MB on Electron to 8MB on Tauri** for a pure web frontend.

### The Updater, and Why It Is the Headline Feature

Tauri’s updater verifies the payload before applying it.
From `plugins/updater/src/updater.rs`:

```rust
fn verify_signature(data: &[u8], release_signature: &str, pub_key: &str) -> Result<()> {
    let pub_key_decoded = base64_to_string(pub_key)?;
    let public_key = PublicKey::decode(&pub_key_decoded)?;
    let signature_base64_decoded = base64_to_string(release_signature)?;
    let signature = Signature::decode(&signature_base64_decoded)?;

    // Validate signature or bail out
    public_key.verify(data, &signature, true)?;
    Ok(())
}
```

The verification uses **minisign**, runs against the **downloaded bytes**, checks them
with a **public key compiled into your application**, and **aborts the update on
failure**.

Why this matters more than it sounds: the private key never touches the update server,
so **compromising your update host is not sufficient to ship code to your users**.
Integrity comes from the key, not from trusting the host.
Generate the keypair with `tauri signer generate`, keep the private key in CI secrets as
**`TAURI_SIGNING_PRIVATE_KEY`** (renamed from `TAURI_PRIVATE_KEY`; the old name still
works), and put the public key in your config.

This is near-universal practice, not just documentation: **ten of the surveyed apps ship
the official updater, and every one of them ships a pubkey.**

### Code Signing

**macOS.** Sign with a Developer ID certificate and notarize, supplying either Apple ID
credentials or App Store Connect API key credentials through the standard environment
variables.

One point worth stating because it is widely assumed otherwise: **Tauri does not need
JIT entitlements.** Electron requires `com.apple.security.cs.allow-jit` and
`allow-unsigned-executable-memory` because it signs its own Chromium helper processes,
in which V8 JIT-compiles.
Tauri’s web content runs in Apple’s own out-of-process `com.apple.WebKit.WebContent`,
which carries Apple’s entitlements.
Tauri’s signing documentation does not mention entitlements at all, and Spacedrive,
GitButler, and Modrinth ship no `Entitlements.plist` and notarize successfully.
Add entitlements for features you actually use—**Cap** ships them for camera,
microphone, USB, and library validation because it is a screen recorder loading its own
media sidecars, not because the webview demands it.

**Windows.** Authenticode has required a hardware security module since June 2023, so a
local `.pfx` is no longer viable.
Use `signCommand` with Azure Key Vault or Azure Trusted Signing.

Then choose how WebView2 reaches the user via `webviewInstallMode`:

| Mode | Tradeoff |
| --- | --- |
| `downloadBootstrapper` (default) | Smallest installer; needs network at install time. |
| `embedBootstrapper` | No network needed; **adds roughly 190MB**. |
| `offlineInstaller` | Fully offline; largest. |
| `fixedVersion` | Pins an engine version; you own its security updates. |
| `skip` | Assumes it is present; the app will not launch if it is not. |

**Linux.** No signing story comparable to the other platforms; distribution goes through
deb, rpm, and AppImage.

### CI

You **cannot cross-compile**—build on each target OS. A realistic matrix is five
entries: macOS arm64, macOS x64, Ubuntu x64, Ubuntu arm64, and Windows.
Note that surveyed apps pin **`ubuntu-22.04` rather than a newer image**, because of
WebKit dependencies.
macOS universal binaries are an option but double the file size.

**Budget for Rust build time honestly.** A clean build runs 3-8 minutes locally and 5-15
in CI. With `swatinem/rust-cache@v2` that drops to 2-5 minutes.
macOS notarization adds another 2-5 minutes and cannot be cached.
A parallel five-runner release lands around 15 minutes wall-clock.
Against a JavaScript-only pipeline this is a real **3-5x penalty**, and it is the cost
that most surprises teams arriving from Electron.
Locally, switching to the LLD linker is the single biggest win, taking one measured
incremental build from 14.8s to 3.7s.

* * *

## 6. What Actually Breaks Across Webviews

Shipping no engine means inheriting whatever engine the user has.
This section exists because “system webviews vary” is too vague to plan around.

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
- **Wayland rendering glitches**: maximizing produces duplicated “shadow” DOM over real
  content, reproducible on a vanilla scaffold.
- **Performance degrades** until devtools is opened, and CSS animations blur the app.
- Child webviews require X11.

Engine capability tracks the distribution: Ubuntu 22.04 ships WebKitGTK 2.36 (roughly
Safari 16), Ubuntu 20.04 ships 2.28-2.32. Your users’ CSS and JavaScript support is set
by their OS, not your build.

**Tauri 3.0’s headline item is the GTK4 and WebKitGTK 6.0 migration**, which addresses
much of this. It is a milestone in progress, not a shipped fix.

### Windows and macOS

- **Windows**: on machines without WebView2, the installer triggers a UAC prompt to
  install “Windows Edge Update,” which looks alarming to users; declining leaves an app
  that cannot launch. Apps also fail to start under Windows Administrator Protection.
- **macOS**: enabling devtools uses private WebKit APIs and **makes the app ineligible
  for the App Store**. WKWebView restricts media autoplay, and `convertFileSrc` fails on
  very large files.
- **Fonts render differently on every platform** (DirectWrite, CoreText, FreeType).
  Bundle your own fonts if visual consistency matters.

* * *

## 7. What Shipping Apps Actually Do

Fourteen serious open-source apps, read from their configuration rather than their
READMEs.

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

Patterns appearing in three or more apps, which is the bar for putting something in a
guideline:

- **The official updater with a minisign pubkey** (10 apps—the strongest consensus in
  the dataset).
- **Plugins**: `deep-link` (7), `window-state` (7), `single-instance` (6).
- **`fs:scope` confined to `$APPDATA/**`** as the minimum viable filesystem scope.
- **Cargo features** `devtools` and `protocol-asset` (6 apps each).
- **`macOSPrivateApi: true`** for vibrancy and transparency (4 apps).
- **Custom title bars** via `titleBarStyle: "Overlay"` or `hiddenTitle` (4 apps).
- **Vite** as the bundler, near-universally.

**No frontend framework dominates**: React and Next.js account for five apps, Vue three,
Svelte and Solid one each.
Framework choice is team preference, not a Tauri constraint.

**Mobile remains the exception**—only two of fourteen ship it, despite Tauri 2
supporting iOS and Android since 2024.

**The v2 migration is effectively complete.** Twelve of fourteen are on v2, and both v1
holdouts show reduced maintenance.

* * *

## Best Practices

- [ ] Pin at least **2.11.1** for the ACL and localhost security fixes.
- [ ] Match plugin crate and JS package versions; do not force core crates to one
  number.
- [ ] Keep `withGlobalTauri` off and import `@tauri-apps/api` instead.
- [ ] Scope capabilities to specific windows where you can, and to `$APPDATA` at minimum
  for the filesystem.
- [ ] **Rewrite capabilities by hand when migrating from v1**; never ship
  `migrated.json`.
- [ ] Set a CSP with script hashes, and `devCsp` separately for development.
- [ ] Enable `security.freezePrototype` unless a dependency breaks under it.
- [ ] Use the Isolation pattern if your frontend has a large dependency tree.
- [ ] Ship the official updater with a minisign key; keep the private key in CI secrets
  only.
- [ ] Use `ipc::Response` or `Channel<T>` for binary and streaming payloads.
- [ ] Suffix sidecar binaries with the correct target triple, and remember the Rust and
  JS APIs take different path arguments.
- [ ] Handle `RunEvent::Exit` to kill sidecars; do not assume automatic cleanup covers
  every path.
- [ ] Pin `ubuntu-22.04` in CI for WebKit compatibility.
- [ ] Cache Rust builds with `swatinem/rust-cache`; expect notarization to stay
  uncached.
- [ ] Test on real Linux hardware early if Linux matters.

* * *

## Open Research Questions

1. **When does Tauri 3.0’s GTK4 and WebKitGTK 6.0 migration land, and does it resolve
   the Linux media and drag-and-drop problems?** This is the single largest open
   question for anyone targeting Linux.

2. **What is the practical exposure from the unpatched-webview problem?** Users on old
   operating systems run old engines, and no data was found quantifying how often that
   matters in the field.

3. **Is the Isolation pattern’s overhead acceptable for high-frequency IPC?** The
   documentation says most apps will not notice; no benchmark was found.

4. **Why do so few apps set a strict CSP?** The survey shows the gap clearly but not
   whether the cause is difficulty, tooling friction, or inattention.

5. **Does `fixedVersion` WebView2 make sense for enterprise deployment**, given it moves
   engine security updates onto you?

* * *

## Recommendations

### When Tauri Is the Right Choice

- You want a small, signed, auto-updating desktop app and can accept Rust in the build.
- **Update integrity matters.** The signed updater is the strongest reason to choose
  Tauri over less mature small-bundle frameworks.
- Your team is comfortable with a permission model that must be configured deliberately.
- You are Windows-first or macOS-first, with Linux as a secondary target you will test.
- You want mobile from the same codebase, accepting that backend logic must be plugins
  or Rust rather than sidecars.

### When to Choose Something Else

- **Your app depends on WebRTC, media playback through local protocols, or drag-and-drop
  on Linux.** Verify before committing.
- **You need a guaranteed rendering engine across platforms.** Electron ships one; Tauri
  inherits whatever is installed.
- **Your CI budget cannot absorb a 3-5x build-time increase.**
- **You need an OS-level renderer sandbox**, which Electron provides and Tauri does not.
- **Your team will write no Rust and your backend cannot be a sidecar**—for example
  because you need mobile support.

Choose **Electron** for maximum maturity, a controlled engine, the richest ecosystem,
and a real renderer sandbox; see `tbd guidelines electron-app-development-patterns`.
Choose **Electrobun** only for internal or trusted-audience distribution; see
`tbd guidelines electrobun-app-development-patterns`, and note its updater performs no
verification.

### If You Adopt It

Pin 2.11.1 or later, scope capabilities deliberately rather than accepting the migration
output, ship the signed updater from day one, budget for Rust build times in CI, and put
a real Linux machine in your test matrix before you promise Linux support.

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
- [Webview versions](https://v2.tauri.app/reference/webview-versions/)
- [awesome-tauri](https://github.com/tauri-apps/awesome-tauri)

### Issues Cited

- [WebRTC unavailable on Linux (wry#85)](https://github.com/tauri-apps/wry/issues/85)
- [Media via custom protocol fails on Linux (#3725)](https://github.com/tauri-apps/tauri/issues/3725)
- [Drag-and-drop on Linux (#9725)](https://github.com/tauri-apps/tauri/issues/9725)
- [Wayland shadow DOM duplication (#13157)](https://github.com/tauri-apps/tauri/issues/13157)
- [WebView2 install UX (#4389)](https://github.com/tauri-apps/tauri/issues/4389)
- [Windows Administrator Protection (#13926)](https://github.com/tauri-apps/tauri/issues/13926)

## Related Guidelines

- For Electron, see `tbd guidelines electron-app-development-patterns`
- For Electrobun, see `tbd guidelines electrobun-app-development-patterns`
- For dependency policy, see `tbd guidelines supply-chain-hardening`
- For TypeScript conventions, see `tbd guidelines typescript-rules`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
