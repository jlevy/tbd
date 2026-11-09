---
title: macOS WebView Shell Patterns
description: 'Building a thin, signed, macOS-only Swift app (AppKit and WKWebView) around a local web server or web UI in any language. Covers choosing it over Tauri, Electron, Electrobun, or pywebview, WKWebView setup, supervising or attaching to a server process, SwiftPM builds, notarization in CI, Sparkle and Homebrew updates, and the TCC, quarantine, and Local Network rules a local-server shell must meet.'
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: desktop
---
# macOS WebView Shell Patterns

**Last Updated:** 2026-11-08

## Executive Summary

A native shell is a small Swift program that owns the macOS app identity (Dock icon,
menus, windows, file and URL hand-off, signing, privacy prompts) and shows your existing
web UI in the system `WKWebView`. The UI is served by a local server the shell starts
(Python, Node, Go, Rust, anything), by a server something else already started, or by a
remote URL. The shell has no engine to ship and no framework to track.

What matters most when deciding:

- **The shell can be small.** A measured example with menus, windows, navigation policy,
  downloads, find, zoom, printing, file drops, and a supervised server is about 1,000
  lines of Swift, builds clean in 10 to 14 seconds per architecture, and produces a 1MB
  universal app bundle with no entitlements.
  A WKWebView window measured about 78MB across all its processes against about 362MB
  for headless Chrome on the same page.

- **It is macOS only and WebKit only.** Your users get the WebKit their macOS version
  ships, so Safari becomes a primary test target.
  A later Windows or Linux build means a second shell or a framework migration.
  Livebook maintained a Swift macOS shell beside a separate C# Windows shell from 2023,
  then replaced both with one Tauri app in 2026.

- **You write what frameworks give you.** Downloads, `target=_blank`, find in page,
  printing, file drops, and menus are each 10 to 80 lines of AppKit and WebKit delegate
  code, shown below. Most debugging time goes to signing, notarization, and
  LaunchServices, not Swift.

- **Process supervision is the real work.** macOS has no parent-death signal.
  A robust shell spawns its server in its own process group, passes a per-launch secret
  on stdin, and treats stdin EOF as the shutdown signal, so a crashed shell never leaves
  an orphan holding a port.

- **The platform rules are the same for every shell.** Developer ID signing, the
  hardened runtime, notarization, TCC prompts attributed to the app, no quarantine flag,
  no App Sandbox, and loopback-only binding apply whether the shell is Swift, Tauri, or
  Electron. They are collected in
  [Section 8](#8-macos-platform-rules-for-local-server-shells).

**Recommendation in one line:** for a macOS-only app around a local server, write the
shell in Swift with AppKit and `WKWebView`, build it with SwiftPM and a short script,
ship a notarized DMG and ZIP on GitHub Releases, and add Sparkle only when shell updates
become frequent.

**Related:**

- [Companion: Electron App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electron-app-development-patterns.md)
- [Companion: Tauri App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/tauri-app-development-patterns.md)
- [Companion: Electrobun App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electrobun-app-development-patterns.md)
- [Companion: Desktop Python Runtime Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/desktop-python-runtime-patterns.md)
  (provisioning a Python server for any desktop shell)
- [Supply-Chain Hardening](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)
  (the 14-day cool-off used for every pin below)
- [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview),
  [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution),
  [TN3179: Understanding local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [Sparkle documentation](https://sparkle-project.org/documentation/)

* * *

## Updating This Document

AppKit and `WKWebView` change slowly; nearly every API used here dates from macOS 10.13
to 14.0. What changes fast is the platform around them: Xcode and runner images, Apple’s
privacy rules, Homebrew’s cask policy, and Sparkle’s security advisories.
Recheck those first.

### Last Researched Versions

Observed 2026-11-08 from the GitHub Releases and Contents APIs, Apple’s documentation
metadata (`developer.apple.com/tutorials/data/documentation/<symbol>.json`), and a local
toolchain (macOS 26.5.2, Xcode 26.6, Apple M1 Pro).
The cool-off rule of `tbd guidelines supply-chain-hardening`: a release is eligible if
its UTC publish date is on or before 2026-10-25, 14 days before 2026-11-08. Anything
later is marked as inside the cool-off.

| Thing | Version | Check For Updates |
| --- | --- | --- |
| **macOS** | 27.x current; 26.7.x and 15.8.x receive security updates | macOS 27 shipped 2026-09-14 and runs only on Apple silicon. 26 is the last release for Intel Macs. 14 lost security updates in September 2026. |
| **Xcode** | 26.6 (17F113), Swift 6.3.3 | Default on the `macos-26` runner. Xcode 27.1 is the default on the `xcode-27` preview image. |
| **Swift** | 6.4.2 (GitHub release 2026-10-30), **inside the cool-off**; 6.4.1 (2026-10-15) is eligible | [swift.org](https://www.swift.org/install/macos/). Xcode 26.6 bundles 6.3.3. The examples target Swift 6 language mode. |
| **SwiftPM tools version** | 6.2 | Needed for `swiftSettings: [.defaultIsolation(MainActor.self)]`. |
| **GitHub macOS runners** | `macos-26` / `macos-latest` (arm64): macOS 26.6.2, image 20261026, Xcode 26.0.1 to 26.6 | [actions/runner-images](https://github.com/actions/runner-images). `macos-15`: macOS 15.8.2, Xcode 16.4 default plus 26.0.1 to 26.3. **macOS 14 images retired from GitHub Actions on 2026-11-02**; Azure DevOps keeps macOS 14 Intel images until 2026-11-23 ([runner-images#15226](https://github.com/actions/runner-images/issues/15226)). |
| **Sparkle** | 2.10.1 (2026-10-25), eligible | [Releases](https://github.com/sparkle-project/Sparkle/releases). Published on the cutoff date, so it is eligible; 2.10.0 (2026-09-13) is the previous release. **Never pin below 2.9.6** (see [Updates](#7-updates)). Minimum macOS 12. |
| **swift-subprocess** (optional) | 1.0.2 (2026-10-16) | [swiftlang/swift-subprocess](https://github.com/swiftlang/swift-subprocess). Requires Swift 6.2. |
| **XcodeGen** (optional) | 2.46.0 (2026-07-16) | [yonaskolb/XcodeGen](https://github.com/yonaskolb/XcodeGen). |
| **Tuist** (optional) | 4.215.1 (2026-11-08), **inside the cool-off** | Releases near daily; a pin must be a release at least 14 days old. |
| **Homebrew** | 7.0.12 (2026-11-02), **inside the cool-off**; 7.0.10 (2026-10-19) is the newest eligible release | [Homebrew/brew releases](https://github.com/Homebrew/brew/releases). Cask policy is in `docs/Acceptable-Casks.md`. |
| **notarytool** | 1.1.2 (41), in Xcode 26.6 | `xcrun notarytool --version`. |
| **actions/checkout** | v7.0.1 (2026-07-20), commit `3d3c42e5aac5ba805825da76410c181273ba90b1` | Pin by full SHA. |

### Reminders When Updating

1. **Recheck Sparkle’s advisories** at
   [its security advisories page](https://github.com/sparkle-project/Sparkle/security-advisories).
   Five were published between May and August 2026.

2. **Recheck the runner images and Xcode list.** Images rotate, and an image that
   disappears breaks every workflow pinned to it.

3. **Recheck Apple’s privacy rules** in the current macOS release notes.
   macOS 27 changed how access to other apps’ containers is handled, and TN3179 was
   revised on 2026-10-06.

4. **Recheck SwiftUI `WebView` and `WebPage`.** When they gain downloads, page zoom, and
   a new-window hook, revisit
   [the advice to avoid them](#not-yet-swiftui-webview-and-webpage).

5. **Re-measure sizes and build times** with the same commands rather than repeating
   them.

* * *

## 1. When to Choose a Native Shell

### The Alternatives

| Option | Engine | Platforms | Shell language | Updater | Fits when |
| --- | --- | --- | --- | --- | --- |
| **Swift + AppKit + WKWebView** (this document) | System WebKit | macOS | Swift | Sparkle 2, or a cask plus a notice | macOS only; you want the smallest, most native app and can own about 1k lines of Swift. |
| **Tauri 2** (2.12.5, 2026-10-21) | System WebKit on macOS | macOS, Windows, Linux, mobile | Rust | Built in, minisign-verified | You need more than one OS and accept a Rust toolchain. See `tbd guidelines tauri-app-development-patterns`. |
| **Electron** (45.0.0, 2026-10-21; 45.2.3 of 2026-11-04 is inside the cool-off) | Bundled Chromium | macOS, Windows, Linux | JavaScript or TypeScript | Squirrel or electron-updater | You need one engine everywhere or Chromium-only APIs. A minimal arm64 app installs at about 300MB. See `tbd guidelines electron-app-development-patterns`. |
| **Electrobun** (2.0.6, 2026-11-04, inside the cool-off; 2.0.4 of 2026-10-18 is eligible) | System WebKit or bundled CEF | macOS, Windows, Linux | TypeScript | Built in; checks SHA-256 but **verifies no signature** as of 2.0.6 | Internal or trusted audiences only. See `tbd guidelines electrobun-app-development-patterns`. |
| **pywebview** (6.2.1, 2026-04-15) | System WebKit, in the Python process | macOS, Windows, Linux | Python | None | A local, unsigned convenience window for a Python tool. One maintainer, no URL-scheme or document-type handling. |
| **Wails v3** (3.1.0, 2026-11-01, inside the cool-off) | System WebKit | macOS, Windows, Linux | Go | Built in | Revisit later: at commit `035f5c8` its macOS backend had no navigation policy, `createWebViewWith`, or `WKDownload` handling. |
| **Zero shell**: installed web app or Chromium `--app` | The user’s browser | Any | None | The server’s own | The server is already long-lived on one fixed origin and you need no Dock drops, URL scheme, or privacy identity. |

Versions are from the npm, crates.io, PyPI, and GitHub release APIs on 2026-11-08.

### What It Costs

- **Swift in the repository.** A Python or TypeScript team gains a third language, a
  SwiftPM manifest, and Apple toolchain upgrades.
  The Swift itself is ordinary AppKit boilerplate that agents write well; the expertise
  you need is bundle layout, `Info.plist`, LaunchServices, signing, and notarization.
- **macOS only.** Livebook shipped native macOS (Swift) and Windows shells from January
  2023 ([PR #1641](https://github.com/livebook-dev/livebook/pull/1641)), replaced them
  with Tauri ([PR #3112](https://github.com/livebook-dev/livebook/pull/3112), merged
  2026-01-07), and deleted both on 2026-04-10. If a second operating system is likely
  within a year, start with Tauri.
- **WebKit only.** WebKit ships with macOS and Safari, so you cannot pin or patch the
  engine, and behavior varies with the user’s OS. On macOS 15 and later the engine
  updates with Safari (Safari 27 is “available for macOS Sequoia and macOS Tahoe”,
  [Apple](https://support.apple.com/en-us/149039)); macOS 14 is frozen at Safari 26.x.
  Run your browser tests against WebKit (Playwright’s WebKit or Safari) before release,
  not only Chromium.
- **More code for browser features.** Each of these is something a browser or framework
  does for you and a shell must implement: downloads, new windows, find in page,
  printing, file drops, context menus, and Web Inspector access.

### Try a Zero-Shell Option First

Before writing Swift, check whether one of these is enough.
None needs signing, because nothing is downloaded and quarantined.

- **Installed web app.** Chrome and Edge install any page as an app (Install page as
  app), and Safari on macOS 14 and later can Add to Dock without a manifest
  ([WebKit, Safari 17](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)).
  Both give a window with its own Dock icon.
  Limits: the app is bound to one origin, and the origin includes the port, so a server
  that moves from `127.0.0.1:8411` to `:8412` is a different app; the window is dead
  when the server is not running; Safari web apps keep a separate cookie jar; and PWA
  file handlers receive no filesystem paths.
- **Chromium `--app=URL`.** `open -na "Google Chrome" --args --app=URL` opens a
  chromeless window in the user’s existing Chrome.
  The Dock icon is still Chrome’s.
- **A locally generated launcher.** Your CLI can write an Automator Quick Action into
  `~/Library/Services` for Finder’s “Open in …” menu, or an AppleScript applet
  (`osacompile`) whose `on open` and `on open location` handlers receive dropped folders
  and URL-scheme links.
  Generated on the user’s Mac, these carry no quarantine attribute and run without
  notarization. A downloadable script-only bundle does not work: Apple DTS recommends
  against signing scripts as main executables
  ([forum thread 113954](https://developer.apple.com/forums/thread/113954)), and
  Homebrew disabled the Platypus cask on 2026-09-01 because it failed Gatekeeper.

Choose a native shell when you need a signed, downloadable app with its own identity: a
Dock icon that owns the window, folder drops, a URL scheme, Finder Open With, privacy
prompts in your app’s name, and a server whose lifetime the app controls.

* * *

## 2. Architecture

### Topology

```
Example.app  (your Swift process: AppKit, menus, windows, supervisor)
├── WKWebView ──► com.apple.WebKit.WebContent, .Networking, .GPU
│                 (Apple's XPC services: page JavaScript and its JIT, networking, GPU)
└── server child  (posix_spawn: own process group, stdin pipe, stdout and stderr pipe)
    ├── listens on http://127.0.0.1:<OS-assigned port>
    └── its own children (git, workers): in its group unless they call setsid or setpgid
```

Page JavaScript runs in Apple’s WebContent process, not in yours, which is why the shell
needs no JIT entitlement (see [Entitlements](#entitlements-usually-none)).

Three ways to supply the UI:

- **Spawn a server the app owns** ([Section 3](#3-supervising-a-local-server)): the
  common case for a tool that already has a `serve` command.
- **Attach to a server that is already running**
  ([Section 4](#4-attaching-to-a-server-something-else-started)): when a CLI, an agent,
  or a launch agent owns the server.
- **Load a remote URL:** no child at all.
  The shell is a site-specific browser like
  [kofigumbs/multi](https://github.com/kofigumbs/multi).
  Use HTTPS, keep the navigation policy below with the remote origin as the app origin,
  and show a native error view when offline.

### Lifecycle and Menus

A shell needs no storyboard or nib.
`main.swift` creates the application object and runs it:

```swift
import AppKit

signal(SIGPIPE, SIG_IGN)  // a write to a dead child's stdin must not kill the app
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
```

The application delegate owns the supervisor and the windows.
Quitting waits for the server to stop, and closing the last window does not quit:

```swift
func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    guard let supervisor else { return .terminateNow }
    Task {
        await supervisor.stop()  // bounded: SIGTERM, grace period, SIGKILL
        NSApp.reply(toApplicationShouldTerminate: true)
    }
    return .terminateLater
}

// Keep the server warm after the last window closes; a Dock click reopens instantly.
func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    false
}

func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
    if !hasVisibleWindows { openWindow() }
    return true
}

// Finder Open With, drops on the Dock icon, and links in the app's URL scheme.
func application(_ application: NSApplication, open urls: [URL]) {
    for url in urls where url.isFileURL || url.scheme == "example" {
        openWindow(for: url)  // map the URL to a route on the server
    }
}
```

Build menus in code.
Items with a `nil` target travel the responder chain, so the focused `WKWebView` answers
Cut, Copy, Paste, and Select All itself.
**Without an Edit menu, Cmd+C, Cmd+V, and Cmd+A do nothing in a web view:**
webview/webview has that issue open
([issue #397](https://github.com/webview/webview/issues/397)).

```swift
enum MainMenu {
    static func build(appName: String) -> NSMenu {
        let main = NSMenu()
        main.addSubmenu(appName, [
            item("About \(appName)", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
            .separator(),
            item("Hide \(appName)", #selector(NSApplication.hide(_:)), "h"),
            item("Quit \(appName)", #selector(NSApplication.terminate(_:)), "q"),
        ])
        main.addSubmenu("File", [
            item("New Window", #selector(AppDelegate.newWindow(_:)), "n"),
            item("Close", #selector(NSWindow.performClose(_:)), "w"),
            .separator(),
            item("Print…", #selector(BrowserWindowController.printPage(_:)), "p"),
        ])
        main.addSubmenu("Edit", [
            item("Undo", Selector(("undo:")), "z"),
            item("Redo", Selector(("redo:")), "Z"),
            .separator(),
            item("Cut", #selector(NSText.cut(_:)), "x"),
            item("Copy", #selector(NSText.copy(_:)), "c"),
            item("Paste", #selector(NSText.paste(_:)), "v"),
            item("Select All", #selector(NSText.selectAll(_:)), "a"),
            .separator(),
            finder("Find…", .showFindInterface, "f"),
            finder("Find Next", .nextMatch, "g"),
            finder("Find Previous", .previousMatch, "G"),
            finder("Use Selection for Find", .setSearchString, "e"),
        ])
        main.addSubmenu("View", [
            item("Reload", #selector(BrowserWindowController.reloadPage(_:)), "r"),
            item("Actual Size", #selector(BrowserWindowController.zoomReset(_:)), "0"),
            item("Zoom In", #selector(BrowserWindowController.zoomIn(_:)), "="),
            item("Zoom Out", #selector(BrowserWindowController.zoomOut(_:)), "-"),
        ])
        NSApp.windowsMenu = main.addSubmenu("Window", [
            item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"),
        ])
        return main
    }

    private static func item(_ title: String, _ action: Selector, _ key: String = "") -> NSMenuItem {
        NSMenuItem(title: title, action: action, keyEquivalent: key)
    }

    /// NSTextFinder reads the action from the sender's tag.
    private static func finder(_ title: String, _ action: NSTextFinder.Action, _ key: String) -> NSMenuItem {
        let menuItem = item(title, #selector(NSResponder.performTextFinderAction(_:)), key)
        menuItem.tag = action.rawValue
        return menuItem
    }
}

private extension NSMenu {
    @discardableResult
    func addSubmenu(_ title: String, _ items: [NSMenuItem]) -> NSMenu {
        let submenu = NSMenu(title: title)
        items.forEach(submenu.addItem)
        let holder = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        holder.submenu = submenu
        addItem(holder)
        return submenu
    }
}
```

### Configuring WKWebView

One window controller per window.
The configuration below is the baseline for a local web UI:

```swift
final class BrowserWindowController: NSWindowController, NSWindowDelegate {
    var appOrigin: URL?
    let webView: DropAwareWebView
    private let container: WebContainerView
    private let textFinder = NSTextFinder()

    /// Pass `configuration` only from `createWebViewWith`, which requires it.
    init(appOrigin: URL?, configuration: WKWebViewConfiguration? = nil) {
        self.appOrigin = appOrigin
        let config = configuration ?? WKWebViewConfiguration()
        if configuration == nil {
            config.websiteDataStore = .default()  // persistent cookies and localStorage
            config.preferences.isElementFullscreenEnabled = true
        }
        webView = DropAwareWebView(frame: .zero, configuration: config)
        webView.isInspectable = true  // Safari > Develop menu; consider a setting
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = true
        webView.pageZoom = UserDefaults.standard.object(forKey: "pageZoom") as? Double ?? 1
        container = WebContainerView(webView: webView)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1200, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.contentView = container
        window.setFrameAutosaveName("BrowserWindow")
        super.init(window: window)
        window.delegate = self
        webView.navigationDelegate = self
        webView.uiDelegate = self
        textFinder.client = webView  // WKWebView adopts NSTextFinderClient (macOS 10.15.4)
        textFinder.findBarContainer = container
        textFinder.isIncrementalSearchingEnabled = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("unused") }

    func isAppOrigin(_ url: URL) -> Bool {
        guard let appOrigin else { return false }
        return url.scheme == appOrigin.scheme && url.host == appOrigin.host
            && url.port == appOrigin.port
    }
}
```

- **Persistent store.** `WKWebsiteDataStore.default()` persists cookies, localStorage,
  and IndexedDB across launches.
  `WKWebsiteDataStore(forIdentifier:)` (macOS 14) gives separate persistent stores, for
  example one per workspace.
  `.nonPersistent()` forgets everything at quit; use it only for views that must keep no
  state.
- **Web Inspector.** `isInspectable` (macOS 13.3) defaults to `false`, including in
  debug builds linked against current SDKs
  ([WebKit blog, 2023-03-20](https://webkit.org/blog/13936/enabling-the-inspection-of-web-content-in-apps/)).
  Users open the inspector from Safari’s Develop menu.
  It is Safari’s inspector, attached remotely, not an in-window DevTools panel.
- **WebContent can die.** If the WebContent process crashes or is killed under memory
  pressure, `webViewWebContentProcessDidTerminate(_:)` fires and the view goes blank.
  Reload or show an error; do not leave a white window.

A new port is a new origin, even with a persistent website data store.
Store durable drafts and preferences in the backend or native app data.
If you require browser storage to survive restarts, use a stable origin and verify
ownership before sending any credentials; test a restart with a deliberately changed
port to catch accidental dependence on origin-bound storage.

### Navigation Policy

The app origin stays in the window; every other main-frame navigation goes to the
default browser:

```swift
extension BrowserWindowController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
        decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if action.shouldPerformDownload { return decisionHandler(.download) }
        if action.targetFrame?.isMainFrame == false {
            return decisionHandler(.allow)  // subframes: leave to the page's CSP
        }
        if isAppOrigin(url) || ["about", "blob", "data"].contains(url.scheme ?? "") {
            return decisionHandler(.allow)
        }
        if url.scheme == "http" || url.scheme == "https" || url.scheme == "mailto" {
            NSWorkspace.shared.open(url)  // everything else belongs in the default browser
        }
        decisionHandler(.cancel)  // includes file:// navigations from stray drops
    }

    func webView(
        _ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
        decisionHandler: @escaping @MainActor (WKNavigationResponsePolicy) -> Void
    ) {
        decisionHandler(response.canShowMIMEType ? .allow : .download)
    }
}
```

Compare origins on scheme, host, and port.
`127.0.0.1` and `localhost` are different origins, so pick one, always use it, and
generate every URL from the server’s ready line.
Ollama’s app makes the same split, keying on `localhost` and `127.0.0.1` in
`decidePolicyForNavigationAction` and `createWebViewWithConfiguration`
([`app/cmd/app/app_darwin.m`](https://github.com/ollama/ollama/blob/d63b702609c4300a2ca07be2bdb0adb9834725e5/app/cmd/app/app_darwin.m)).

### New Windows, Downloads, and Panels

Without a `WKUIDelegate`, `target=_blank` links and `window.open` do nothing.
The view you return **must be created with the configuration WebKit passes in**
([Apple](https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:createwebviewwith:for:windowfeatures:))):

```swift
extension BrowserWindowController: WKUIDelegate, WKDownloadDelegate {
    func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = action.request.url else { return nil }
        guard isAppOrigin(url) else {
            NSWorkspace.shared.open(url)
            return nil
        }
        let child = BrowserWindowController(appOrigin: appOrigin, configuration: configuration)
        child.showWindow(nil)
        (NSApp.delegate as? AppDelegate)?.adopt(child)  // keep a strong reference
        return child.webView  // WebKit loads the request into it
    }

    func webViewDidClose(_ webView: WKWebView) {
        window?.close()  // the page called window.close()
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    /// A save panel is user intent, so no Downloads-folder privacy prompt is involved.
    func download(
        _ download: WKDownload, decideDestinationUsing response: URLResponse,
        suggestedFilename: String, completionHandler: @escaping @MainActor (URL?) -> Void
    ) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        guard let window else { return completionHandler(nil) }
        panel.beginSheetModal(for: window) { result in
            completionHandler(result == .OK ? panel.url : nil)
        }
    }

    func webView(
        _ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        guard let window else { return completionHandler(nil) }
        panel.beginSheetModal(for: window) { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }
}
```

`WKDownload` and `shouldPerformDownload` (the `download` attribute) need macOS 11.3.
Apple documents that choosing a file in an Open or Save panel grants access “right away
and any time in the future” without a prompt
([NSDownloadsFolderUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsdownloadsfolderusagedescription)),
which is why the save panel is the better default than writing straight into
`~/Downloads`. JavaScript dialogs need `WKUIDelegate` methods too: per the SDK header,
without them WebKit behaves as if the user pressed OK for `alert` and Cancel for
`confirm` and `prompt`, and without `createWebViewWith` it cancels the navigation.

### Find, Zoom, Printing, and the Inspector

**Find in page** uses `NSTextFinder` with the web view as its client.
`WKWebView` is not inside an `NSScrollView`, so the window supplies the find bar slot:

```swift
override func performTextFinderAction(_ sender: Any?) {  // in the window controller
    guard let tag = (sender as? NSMenuItem)?.tag,
          let action = NSTextFinder.Action(rawValue: tag) else { return }
    textFinder.performAction(action)
}

final class WebContainerView: NSView, NSTextFinderBarContainer {
    let webView: WKWebView

    init(webView: WKWebView) {
        self.webView = webView
        super.init(frame: .zero)
        addSubview(webView)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("unused") }

    var findBarView: NSView? {
        didSet {
            oldValue?.removeFromSuperview()
            needsLayout = true
        }
    }

    // Insert the bar here, not in findBarView's setter: when the bar was already in
    // the view tree, NSTextFinder never set isFindBarVisible (measured, macOS 26.5).
    var isFindBarVisible = false {
        didSet {
            if isFindBarVisible, let findBarView, findBarView.superview == nil {
                addSubview(findBarView)
            } else if !isFindBarVisible {
                findBarView?.removeFromSuperview()
            }
            needsLayout = true
        }
    }

    func findBarViewDidChangeHeight() { needsLayout = true }
    func contentView() -> NSView? { webView }

    override func layout() {
        super.layout()
        var webFrame = bounds
        if isFindBarVisible, let bar = findBarView {
            let height = bar.frame.height
            bar.frame = NSRect(x: 0, y: bounds.maxY - height, width: bounds.width, height: height)
            webFrame.size.height -= height
        }
        webView.frame = webFrame
    }
}
```

A probe on macOS 26.5.2 confirmed that `.showFindInterface` installs and shows a
32-point `NSTextFinderBarView` with this container.
It did not confirm match highlighting and navigation, which need an interactive check.
WebKit’s own MiniBrowser builds its find bar this way but also calls private SPI
(`_usePlatformFindUI`), which you must not ship.
`WKWebView.find(_:configuration:completionHandler:)` (macOS 11) is the programmatic
alternative if your page draws its own find UI; `findInteraction` is iOS only.
If the web UI already has an in-page search, forward Cmd+F to it instead.

**Zoom** is `webView.pageZoom` (macOS 11). Persist it per window or per site:

```swift
@objc func zoomIn(_ sender: Any?) { setZoom(webView.pageZoom * 1.1) }
@objc func zoomOut(_ sender: Any?) { setZoom(webView.pageZoom / 1.1) }
@objc func zoomReset(_ sender: Any?) { setZoom(1) }

private func setZoom(_ zoom: Double) {
    webView.pageZoom = min(3, max(0.5, zoom))
    UserDefaults.standard.set(webView.pageZoom, forKey: "pageZoom")
}
```

**Printing** is `printOperation(with:)` (macOS 11), run modally for the window.
The probe confirmed it returns an operation whose view is a `WKPrintingView`; reports of
blank pages with other ways of running it were not re-tested:

```swift
@objc func printPage(_ sender: Any?) {
    guard let window else { return }
    let operation = webView.printOperation(with: NSPrintInfo.shared)
    operation.view?.frame = webView.bounds
    operation.runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
}
```

**Context menus** are customized by overriding `willOpenMenu(_:with:)` in a `WKWebView`
subclass and editing the menu’s items.

### File Drops With Real Paths

A file dropped on a web page arrives as a `File` with no filesystem path, in WebKit and
in Chrome. A shell can do better: subclass `WKWebView`, read file URLs from the
pasteboard, and fall through to WebKit’s ordinary drag and drop when you decline.
Tauri’s wry does the same in `src/wkwebview/drag_drop.rs`.

```swift
final class DropAwareWebView: WKWebView {
    var onFileDrop: (([URL]) -> Bool)?

    private func fileURLs(_ info: any NSDraggingInfo) -> [URL] {
        info.draggingPasteboard.readObjects(
            forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL] ?? []
    }

    override func draggingUpdated(_ sender: any NSDraggingInfo) -> NSDragOperation {
        let operation = super.draggingUpdated(sender)
        if operation.isEmpty, onFileDrop != nil, !fileURLs(sender).isEmpty { return .copy }
        return operation
    }

    override func performDragOperation(_ sender: any NSDraggingInfo) -> Bool {
        let urls = fileURLs(sender)
        if !urls.isEmpty, let onFileDrop, onFileDrop(urls) { return true }
        return super.performDragOperation(sender)
    }
}
```

Deliver the paths with `callAsyncJavaScript`, whose `arguments` are passed as values, so
no path is ever spliced into script source:

```swift
webView.onFileDrop = { [weak webView] urls in
    webView?.callAsyncJavaScript(
        "window.dispatchEvent(new CustomEvent('native-file-drop', {detail: {paths}}))",
        arguments: ["paths": urls.map(\.path)], in: nil, in: .page, completionHandler: nil)
    return true
}
```

Any page script can dispatch the same event, so the server must validate these paths
like any other client input.
A drop that reaches WebKit unhandled may navigate the view to the `file://` URL, which
the navigation policy above cancels.
Dropping a file grants the app access to it without a TCC prompt (Apple’s usage
description pages).

### Loopback HTTP Versus a Custom URL Scheme

`WKURLSchemeHandler` (macOS 10.13) lets the shell answer requests for a scheme such as
`app://` itself, with no TCP port.
A probe on macOS 26.5.2, linked against the 26.5 SDK, compared it with a loopback HTTP
server, twice:

| Origin | Page loads | SSE events in about 4 s | `isSecureContext` | `localStorage` | `document.cookie` |
| --- | --- | --- | --- | --- | --- |
| `http://127.0.0.1:<port>` | yes | 19 and 20 | true | works | **works** |
| `custom://app` (streaming `WKURLSchemeHandler`) | yes | 20 and 19 | true | works | **empty** |

- **Cookies do not work on the custom scheme.** That rules it out for any UI that keeps
  preferences or a session in cookies, and for the cookie-based authentication in
  [Section 3](#authenticating-the-web-view).
- **Every request must be proxied by Swift.** The handler sees each request, including
  long-lived `EventSource` streams, and must forward it to the server.
  Keeping the no-port benefit means the server listens on a Unix socket, and
  `URLSession` cannot speak HTTP over one, so the proxy becomes hand-written HTTP over
  `NWConnection`.
- **Browsers and CLIs still need loopback.** If the same server is also opened in a
  normal browser, the TCP listener exists anyway.

Use loopback HTTP with a per-launch secret.
Use a scheme handler when the shell itself is the server: bundled static content, or a
native data source, as [kiwix-apple](https://github.com/kiwix/kiwix-apple) does in
`Model/Utilities/WebKitHandler.swift`.

### App Transport Security

Apple’s documentation says that “In iOS 17, iPadOS 17, and macOS 14, ATS no longer
allows connections to IP addresses by default” and that `NSAllowsLocalNetworking`
enables access to unqualified domains, `.local` domains, and IP addresses
([NSAllowsLocalNetworking](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking)).
In practice the probe app, with no ATS keys, loaded `http://127.0.0.1` in `WKWebView`,
and Ollama’s shipped app has no ATS keys either.
Set `NSAllowsLocalNetworking` anyway: it is the documented declaration, it costs one
key, and it covers `URLSession` health checks from the shell.
Never set `NSAllowsArbitraryLoads`.

### Not Yet: SwiftUI WebView and WebPage

macOS 26 added SwiftUI’s `WebView` and the observable `WebPage` controller
([WWDC25 session 231](https://developer.apple.com/videos/play/wwdc2025/231/)). Both
require macOS 26.0, and for a shell they lack what this section depends on:

- No download API: `WebPage.NavigationDeciding` returns a response policy, but there is
  no `WKDownload` hookup.
- No `pageZoom`.
- No `createWebViewWith` equivalent: `DialogPresenting` covers alerts, confirms,
  prompts, and file input only.
- The underlying `WKWebView` is SPI (`@_spi(CrossImportOverlay) backingWebView` in
  WebKit’s `WebPage.swift`), so there is no supported escape hatch.

Use AppKit and `WKWebView`; they also give direct control of the responder chain, menus,
`NSTextFinder`, and window restoration.
Revisit `WebPage` when macOS 26 is your floor and those gaps close.

* * *

## 3. Supervising a Local Server

### The Shell–Server Contract

This is the contract between a desktop shell and the local server it starts or attaches
to.
It is language-neutral, and it is the definition the Electron, Tauri, Electrobun, and
desktop Python guidelines link to.
Each item exists because the obvious alternative fails on macOS:

| Contract item | Why |
| --- | --- |
| **Listen.** The server binds `127.0.0.1` on an OS-assigned port (port 0) unless told otherwise. | No port collisions and no exposure to the local network. A fixed port forces the shell to verify the identity of whatever answers on it, and a stale server or another app can hold it. |
| **Announce.** After the socket listens, the server prints exactly one stdout line: `{"event":"ready","protocol":1,"url":"http://127.0.0.1:<port>/","port":<port>,"pid":<pid>,"version":"<server version>"}` | The shell needs the port, and a regex over log text breaks when wording changes. Printing after `listen` means early connections wait in the backlog instead of being refused. `protocol` lets either side refuse a contract it does not speak, `pid` reveals a wrapper process between the shell and the server, and `version` is for the UI and logs. |
| **Receive the secret on stdin.** The shell writes a per-launch secret as the first line of the child’s stdin, and keeps stdin open. | `argv` is visible to every user through `ps`. The environment is readable by the same user (`ps -E`) and inherited by Git, `gh`, and every other child the server runs. A pipe is private to the two processes. |
| **Shut down on stdin EOF or `SIGTERM`.** Either starts a graceful shutdown with a bounded deadline. At the deadline the server exits regardless, and on the way out it kills its own child process groups. Never an immediate `os._exit`. | macOS has no parent-death signal (`prctl(PR_SET_PDEATHSIG)` is Linux only), but the kernel closes the shell’s end of the pipe however the shell dies, `SIGKILL` and crashes included. The graceful path lets the server finish writes; the deadline keeps a stuck handler from leaving an orphan. A child the server started in its own session or group has left the shell’s group, so only the server can reach it. |
| **Authenticate every request.** Programmatic clients send `Authorization: Bearer <secret>`. Browsers carry a session cookie (`HttpOnly`, `SameSite=Strict`, a per-instance name), which a shell that controls its web view’s cookie store sets directly, and which the server otherwise sets when a single-use exchange code is redeemed ([details](#authenticating-the-web-view)). Check `Host` and `Origin` too. | Any local process, and any web page through DNS rebinding, can otherwise reach the server. `EventSource` cannot send headers, so browsers need the cookie. |
| **Serve a cheap health route** (`GET /healthz`, bearer-authenticated). | Readiness and attach checks. |

Keep two credentials distinct.
The **per-launch secret** is reusable for the life of one server process and never
appears in a URL. A **single-use exchange code** is minted on request, expires in
seconds, and is the only credential allowed in a URL.

A Python server meets the contract like this.
Node, Go, and Rust follow the same steps: read one stdin line, watch stdin for EOF on a
thread, bind port 0, print the JSON line, and route EOF and `SIGTERM` into one
deadline-bounded shutdown.

```python
import json
import os
import signal
import socket
import sys
import threading
import time

VERSION = "1.4.0"
SHUTDOWN_DEADLINE_S = 5.0
stop_requested = threading.Event()
cleanup_complete = threading.Event()
# Register only groups this server owns. Stop spawning on shutdown, reap children,
# and remove finished groups promptly so an old PGID cannot be signaled later.
child_pgids: set[int] = set()


def kill_child_groups(sig: int) -> None:
    for pgid in list(child_pgids):
        try:
            os.killpg(pgid, sig)
        except ProcessLookupError:
            pass


def request_graceful_stop() -> None:
    stop_requested.set()  # for uvicorn: server.should_exit = True


def serve(sock: socket.socket, bearer: str) -> None:
    stop_requested.wait()  # replace: serve HTTP on `sock` until a stop is requested


def enforce_deadline() -> None:
    stop_requested.wait()
    if not cleanup_complete.wait(SHUTDOWN_DEADLINE_S):
        kill_child_groups(signal.SIGKILL)
        os._exit(1)  # last resort if HTTP shutdown or cleanup hangs


def stop_child_groups() -> None:
    kill_child_groups(signal.SIGTERM)
    # A production supervisor can return early after reaping and confirming each
    # group has exited. This skeleton gives registered groups a short grace period.
    if child_pgids:
        time.sleep(0.5)
    kill_child_groups(signal.SIGKILL)
    # Reap Popen children owned by the production supervisor here.


def watch_stdin() -> None:
    # os.read, not sys.stdin: a daemon thread blocked inside the buffered reader holds
    # its lock, and interpreter shutdown then aborts with a fatal error.
    while os.read(0, 65536):
        pass
    request_graceful_stop()  # EOF: the shell closed the pipe, or died


# Handle SIGTERM without acquiring a Python lock from the signal handler.
signal_read, signal_write = os.pipe()
os.set_blocking(signal_write, False)
signal.set_wakeup_fd(signal_write)
signal.signal(signal.SIGTERM, lambda signum, frame: None)

def watch_sigterm() -> None:
    os.read(signal_read, 1)
    request_graceful_stop()

threading.Thread(target=enforce_deadline, daemon=True).start()
threading.Thread(target=watch_sigterm, daemon=True).start()
bearer = sys.stdin.readline(128).strip()  # first stdin line; never argv or environment
if len(bearer) != 43:  # 32 random bytes encoded as unpadded base64url
    raise SystemExit("missing or invalid launch credential")
threading.Thread(target=watch_stdin, daemon=True).start()

sock = socket.create_server(("127.0.0.1", 0))  # binds and listens
port = sock.getsockname()[1]
ready = {
    "event": "ready",
    "protocol": 1,
    "url": f"http://127.0.0.1:{port}/",
    "port": port,
    "pid": os.getpid(),
    "version": VERSION,
}
print(json.dumps(ready), flush=True)
try:
    serve(sock, bearer)
finally:
    request_graceful_stop()
    stop_child_groups()
    cleanup_complete.set()
```

The watcher uses `os.read` because a daemon blocked in Python’s buffered stdin reader
can hold its lock during interpreter shutdown.
The orderly path also escalates against detached groups: a daemon watchdog alone cannot
do that after the interpreter exits.
Use a process supervisor that owns, waits for, and reaps its children in production.

How the server binary itself gets onto the user’s Mac (bundled, installed with uv or
npm, or downloaded at first run) is covered for Python in
`tbd guidelines desktop-python-runtime-patterns`.

### Spawning With posix_spawn

Foundation’s `Process` has no process-group control.
Call `posix_spawn` directly; the flags are documented in the local
`posix_spawnattr_setflags(3)` man page:

- `POSIX_SPAWN_SETPGROUP` with pgroup 0 puts the child in a new group whose id is its
  pid, so `kill(-pid, SIGTERM)` reaches its descendants.
- `POSIX_SPAWN_CLOEXEC_DEFAULT` (an Apple extension) closes every descriptor not named
  by a file action. Without it, the child inherits the write end of its own stdin pipe
  and never sees EOF.
- `POSIX_SPAWN_SETSIGDEF` resets `SIGPIPE`, which the shell ignores, to its default in
  the child, and `POSIX_SPAWN_SETSIGMASK` clears any blocked signals.

```swift
import Darwin
import Foundation

public nonisolated final class PosixServerProcess: ServerProcess, @unchecked Sendable {
    public let pid: pid_t
    public let lines: AsyncStream<String>
    private let lifeline: FileHandle  // write end of the child's stdin; open until we exit
    private let output: FileHandle  // must outlive init, or its fd closes on dealloc
    private let exit = ExitLatch()  // resolves once with the wait status
    private let exitSource: DispatchSourceProcess

    public init(_ spec: LaunchSpec) throws {
        var stdinPipe: [Int32] = [-1, -1]
        var stdoutPipe: [Int32] = [-1, -1]
        guard pipe(&stdinPipe) == 0 else { throw SpawnError.pipe(errno) }
        guard pipe(&stdoutPipe) == 0 else {
            let error = errno
            close(stdinPipe[0])
            close(stdinPipe[1])
            throw SpawnError.pipe(error)
        }
        // The parent's ends must not leak into any other child this app starts.
        _ = fcntl(stdinPipe[1], F_SETFD, FD_CLOEXEC)
        _ = fcntl(stdoutPipe[0], F_SETFD, FD_CLOEXEC)

        var attr: posix_spawnattr_t?
        posix_spawnattr_init(&attr)
        defer { posix_spawnattr_destroy(&attr) }
        let flags = POSIX_SPAWN_SETPGROUP | POSIX_SPAWN_CLOEXEC_DEFAULT
            | POSIX_SPAWN_SETSIGDEF | POSIX_SPAWN_SETSIGMASK
        posix_spawnattr_setflags(&attr, Int16(flags))
        posix_spawnattr_setpgroup(&attr, 0)
        var defaults = sigset_t()
        sigemptyset(&defaults)
        sigaddset(&defaults, SIGPIPE)
        posix_spawnattr_setsigdefault(&attr, &defaults)
        var empty = sigset_t()
        sigemptyset(&empty)
        posix_spawnattr_setsigmask(&attr, &empty)

        var actions: posix_spawn_file_actions_t?
        posix_spawn_file_actions_init(&actions)
        defer { posix_spawn_file_actions_destroy(&actions) }
        posix_spawn_file_actions_adddup2(&actions, stdinPipe[0], 0)
        posix_spawn_file_actions_adddup2(&actions, stdoutPipe[1], 1)
        posix_spawn_file_actions_adddup2(&actions, stdoutPipe[1], 2)

        let argv = ([spec.executable] + spec.arguments).map { strdup($0) } + [nil]
        let envp = spec.environment.map { strdup("\($0.key)=\($0.value)") } + [nil]
        defer { (argv + envp).forEach { free($0) } }

        var spawned: pid_t = 0
        let rc = posix_spawn(&spawned, spec.executable, &actions, &attr, argv, envp)
        close(stdinPipe[0])
        close(stdoutPipe[1])
        guard rc == 0 else {
            close(stdinPipe[1])
            close(stdoutPipe[0])
            throw SpawnError.spawn(rc)
        }
        let child = spawned  // immutable, so @Sendable closures can capture it
        pid = child
        lifeline = FileHandle(fileDescriptor: stdinPipe[1], closeOnDealloc: true)
        try? lifeline.write(contentsOf: Data((spec.secret + "\n").utf8))  // the first stdin line

        // Reserve one slot for the first valid readiness line. Logs use a separate sink.
        let (lineStream, lineSink) = AsyncStream<String>.makeStream(
            bufferingPolicy: .bufferingOldest(1))
        lines = lineStream
        let log = try? FileHandle(forWritingTo: spec.logURL)
        _ = try? log?.seekToEnd()
        let splitter = LineSplitter()
        let reader = FileHandle(fileDescriptor: stdoutPipe[0], closeOnDealloc: true)
        output = reader
        reader.readabilityHandler = { handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else {  // EOF: the child and its descendants closed it
                handle.readabilityHandler = nil
                lineSink.finish()
                return
            }
            try? log?.write(contentsOf: chunk)
            splitter.append(chunk) { line in
                guard ReadyLine.parse(line) != nil else { return }
                lineSink.yield(line)
                lineSink.finish()
            }
        }

        // kqueue EVFILT_PROC with NOTE_EXIT; reap with waitpid so no zombie remains.
        let latch = exit
        let source = DispatchSource.makeProcessSource(
            identifier: child, eventMask: .exit, queue: .global())
        let reap: @Sendable () -> Void = {
            var status: Int32 = 0
            if waitpid(child, &status, WNOHANG) == child {
                latch.resolve(status)
                source.cancel()
            }
        }
        source.setEventHandler(handler: reap)
        source.resume()
        exitSource = source
        DispatchQueue.global().async(execute: reap)  // it may have exited before arming
    }

    public func waitForExit() async -> Int32? { await exit.wait() }
    public func signalGroup(_ signal: Int32) { kill(-pid, signal) }
}
```

`ExitLatch` is a small lock-protected value with a list of waiting continuations; it is
in the [test section](#a-testable-lifecycle-state-machine) because its cancellation
behavior matters.
[swift-subprocess](https://github.com/swiftlang/swift-subprocess) 1.0.x
offers `processGroupID`, `createSession`, and a SIGTERM-then-SIGKILL `teardownSequence`
on Darwin if you prefer a dependency to these 100 lines.

### Readiness

1. Read the child’s output line by line until the JSON ready line appears, with a
   deadline (30 seconds is generous for an interpreted server; measure yours).
   Accept it only if `protocol` is one you speak and the URL exactly matches the
   expected loopback address and announced port.
2. Poll the health route every 50 milliseconds until it returns 2xx, with the same
   deadline. Use an ephemeral `URLSession` with `connectionProxyDictionary = [:]`, so a
   system proxy never intercepts loopback.
   The ready line proves the socket listens, not that the application behind it has
   finished starting.
3. Meanwhile show a native “Starting…” view or a bundled HTML page, never a blank
   window. On failure, show the last lines of output and a **Reveal Logs** button.

```swift
/// {"event":"ready","protocol":1,"url":"http://127.0.0.1:52144/","port":52144,"pid":4242,"version":"1.4.0"}
public nonisolated struct ReadyLine: Decodable, Equatable, Sendable {
    public let event: String
    public let protocolVersion: Int
    public let url: URL
    public let port: Int
    public let pid: Int32
    public let version: String

    enum CodingKeys: String, CodingKey {
        case event, url, port, pid, version
        case protocolVersion = "protocol"
    }

    public static func parse(_ line: String) -> ReadyLine? {
        guard line.hasPrefix("{"),
              let ready = try? JSONDecoder().decode(ReadyLine.self, from: Data(line.utf8)),
              ready.event == "ready", ready.protocolVersion == 1,
              (1...65535).contains(ready.port),
              ready.url.absoluteString == "http://127.0.0.1:\(ready.port)/"
        else { return nil }
        return ready
    }
}
```

### Authenticating the Web View

`EventSource` cannot send custom headers, and headers set on `load(URLRequest)` apply to
the main navigation only, not to subresources or streams.
So browsers authenticate with a session cookie, which reaches the server one of two
ways.

**The shell sets the cookie directly.** A native shell owns its web view’s cookie store,
so it can install the cookie before the first load and no credential ever appears in a
URL:

```swift
enum SessionAuth {
    /// 32 random bytes per launch, written to the child's stdin.
    static func makeSecret() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        precondition(SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Cookies ignore ports, so the cookie name carries the instance's port.
    static func installSessionCookie(in webView: WKWebView, server: URL, secret: String) async {
        guard let host = server.host, let port = server.port,
              let cookie = HTTPCookie(properties: [
                  .domain: host, .path: "/", .name: "session_\(port)", .value: secret,
                  HTTPCookiePropertyKey("HttpOnly"): "TRUE",
                  .sameSitePolicy: HTTPCookieStringPolicy.sameSiteStrict,
              ])  // no expiry: a session cookie, with a new secret every launch
        else { return }
        await webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie)
    }
}

// Before each window's first load:
await SessionAuth.installSessionCookie(in: controller.webView, server: serverURL, secret: secret)
controller.load(serverURL)
```

A probe on macOS 26.5.2 confirmed this path: the cookie set through `WKHTTPCookieStore`
before the first load arrived on both the page request and the `EventSource` request,
the store reported it `HttpOnly` with `SameSite=Strict`, and `document.cookie` in the
page was empty.
The server accepts the secret as the value of `session_<port>` as well as
in a bearer header.

**The server redeems a single-use exchange code.** Anything that cannot write the cookie
store (an “Open in Browser” menu item, a CLI that opens the default browser) asks the
server for a code with the bearer secret, then opens a URL carrying only that code:

```swift
func exchangeURL(server: URL, secret: String, next: String = "/") async throws -> URL {
    var request = URLRequest(url: server.appending(path: "auth/code"))
    request.httpMethod = "POST"
    request.setValue("Bearer \(secret)", forHTTPHeaderField: "Authorization")
    let configuration = URLSessionConfiguration.ephemeral
    configuration.connectionProxyDictionary = [:]
    let (data, _) = try await URLSession(configuration: configuration).data(for: request)
    struct Code: Decodable { let code: String }
    let code = try JSONDecoder().decode(Code.self, from: data).code
    var parts = URLComponents(
        url: server.appending(path: "auth/redeem"), resolvingAgainstBaseURL: false)!
    parts.queryItems = [URLQueryItem(name: "code", value: code),
                        URLQueryItem(name: "next", value: next)]
    return parts.url!
}
```

On `GET /auth/redeem`, the server checks the code in constant time, deletes it so it
cannot be used twice, rejects it if it is more than a few seconds old, sets the session
cookie with a freshly minted value, and answers `303` to a validated same-origin path.
Reject network-path references such as `//other-host/path` and backslash variants, or
use a fixed redirect target.
Redeem the code atomically, use `Cache-Control: no-store` and
`Referrer-Policy: no-referrer`, and redact codes from logs.
The redirect lands on a clean URL; never assume the original URL was absent from browser
history. The route names are examples; the shape is what matters.

Caveats:

- **Cookies are not isolated by port.** RFC 6265 §8.5: “If a cookie is readable by a
  service running on one port, the cookie is also readable by a service running on
  another port of the same server.”
  A per-instance name avoids collisions; it does not prevent another loopback listener
  from receiving the cookie.
  Use an isolated web view cookie store and restrict both navigation and subresources to
  the exact app origin.
  For example, use an exact-origin Content Security Policy for resource directives and
  omit external or arbitrary loopback origins.
  A system browser has no app-owned cookie store; for a threat model with untrusted
  local listeners, use origin-scoped authentication for that mode or omit it.
- **Do not inject the cookie with a user script.** Ollama’s app sets
  `document.cookie = "token=..."` from an injected script, and its own comment says the
  approach “isn’t working yet since it needs to be set on the first page load, ideally
  in an interstitial page like `/token`”
  ([`app/cmd/app/webview.go`](https://github.com/ollama/ollama/blob/d63b702609c4300a2ca07be2bdb0adb9834725e5/app/cmd/app/webview.go)).
  A script-set cookie cannot be `HttpOnly` either.

The bearer protects requests from clients that cannot obtain it.
Keep browser session credentials separate from the bearer where possible, and do not
rely on cookie attributes to protect a browser session from another service on the same
host.
Test a hostile second loopback port as well as a page hosted on an external origin.
This design does not defend against code already running with the same user’s access to
the app.

### Shutdown and Orphans

Layer three mechanisms:

1. **Orderly quit.** `applicationShouldTerminate` returns `.terminateLater`, sends
   `SIGTERM` to the process group, waits for the server to exit, then escalates to
   `SIGKILL` if its own deadline expires.
   The shell deadline must exceed the server’s full shutdown budget, including
   detached-child cleanup, with scheduling margin.
   For the five-second watchdog above, allow at least seven seconds in the shell.
   Test a slow HTTP drain with a detached child that ignores `SIGTERM`. Killing the
   server before it cleans up can leave that child outside the shell’s reach.
   Sending `SIGTERM` from `applicationWillTerminate` instead does not work: that method
   returns before any grace period runs, so a hung child survives quit.
2. **Crash or force quit.** The stdin EOF rule makes the child exit on its own.
3. **Descendants outside the group.** The server owns them, as the contract says.
   Embedded databases and helper daemons often detach into their own session; signaling
   only the direct child leaves them running, so the server must track and stop them,
   and install its signal handling before importing code that starts them.

Keep `NSSupportsSuddenTermination` and `NSSupportsAutomaticTermination` false (the
default): either lets the system kill the app without calling
`applicationShouldTerminate`, leaving only the EOF rule to clean up.

### Restart With Backoff

If the child exits without being asked:

- Restart after 0.5 seconds, doubling to a 30-second cap.
- Reset the backoff after 60 seconds of healthy running.
- After five quick failures, stop and show the error with recent output, **Restart
  Server**, and **Reveal Logs**.

[syncthing-macos](https://github.com/syncthing/syncthing-macos) uses a flat 10-second
delay (`RestartInterval = 10.0`) and keeps the last 200 log lines
(`MaxKeepLogLines = 200`) in `syncthing/DaemonProcess.swift`. When the server comes back
on a new port, install the new session cookie in every window and reload it; the old
origin is gone.

### Logs

- Append the child’s stdout and stderr to `~/Library/Logs/<App>/server.log`, created
  with mode `0600`, and rotate at a fixed size.
- Keep the last 200 lines in memory for the error view.
- Log the shell’s own events with `os.Logger` under the bundle identifier as subsystem;
  `log stream --predicate 'subsystem == "com.example.app"'` shows them.
- “Reveal Logs” is `NSWorkspace.shared.activateFileViewerSelecting([logURL])`.

### The Child’s Environment

- **A Finder launch gets a minimal `PATH`.** Four GUI apps on macOS 26.5.2, inspected
  with `ps -wwwE` on 2026-11-08, all had `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, without
  `/opt/homebrew/bin` or `~/.local/bin`. Apple’s TN2065 says the same of AppleScript’s
  `do shell script` and recommends full paths.
- **A terminal launch inherits the terminal’s variables.** Running the binary directly
  from a shell passes along `VIRTUAL_ENV`, `PYTHONPATH`, `NODE_OPTIONS`, and the rest.
- **`/usr/bin/git` and `/usr/bin/python3` are shims.** On the research Mac both are
  identical 118,928-byte binaries linked only against `libxcselect` and `libSystem`;
  they run the active developer tools, or offer to install the Command Line Tools when
  none are present. If your server shells out to Git, detect a missing toolchain and say
  so in the UI.

So do not search for tools at launch, and do not put user directories such as
`~/.local/bin` on the child’s `PATH`, where whatever happens to be installed there
shadows the tools you tested.
Resolve absolute paths once, at setup (first run, or a Settings action), store them, and
pass them to the server explicitly; give the child a fixed, minimal `PATH`; and for a
Python server set `PYTHONNOUSERSITE=1`, so packages in the user’s
`~/.local/lib/python*/site-packages` cannot shadow the server’s own.
This is the same rule as in `tbd guidelines desktop-python-runtime-patterns` and
`tbd guidelines electron-app-development-patterns`.

```swift
/// Absolute paths, resolved once at setup and stored. Nothing is searched at launch.
struct ToolPaths: Codable {
    var server: String
    var git: String?

    static func stored() -> ToolPaths? {
        guard let data = UserDefaults.standard.data(forKey: "toolPaths") else { return nil }
        return try? JSONDecoder().decode(ToolPaths.self, from: data)
    }

    /// Run from setup only, never on every launch.
    static func resolve(serverCandidates: [String], gitCandidates: [String]) -> ToolPaths? {
        let fm = FileManager.default
        guard let server = serverCandidates.first(where: fm.isExecutableFile(atPath:)) else { return nil }
        let paths = ToolPaths(server: server, git: gitCandidates.first(where: fm.isExecutableFile(atPath:)))
        UserDefaults.standard.set(try? JSONEncoder().encode(paths), forKey: "toolPaths")
        return paths
    }
}

/// A fixed, minimal PATH: the server and every tool it runs arrive by absolute path.
func serverEnvironment(python: Bool) -> [String: String] {
    let inherited = ProcessInfo.processInfo.environment
    var env = inherited.filter { ["HOME", "USER", "LOGNAME", "TMPDIR", "LANG"].contains($0.key) }
    env["PATH"] = "/usr/bin:/bin:/usr/sbin:/sbin"
    if python {
        env["PYTHONNOUSERSITE"] = "1"  // ignore ~/.local/lib/python*/site-packages
    }
    return env
}

// At launch: the stored server path, with the stored Git path passed as an argument.
var arguments = ["serve", "--host", "127.0.0.1", "--port", "0"]
if let git = tools.git { arguments += ["--git", git] }
let spec = LaunchSpec(executable: tools.server, arguments: arguments,
                      environment: serverEnvironment(python: true),
                      secret: secret, logURL: logURL())
```

### A Testable Lifecycle State Machine

Put supervision in an AppKit-free library target and inject the process and readiness
probe, so the lifecycle can be unit-tested without spawning anything.
[jlevy/paraverse](https://github.com/jlevy/paraverse) does this: at commit `bb9a567`,
the server class in
[`KnowledgeBaseBrowser.swift`](https://github.com/jlevy/paraverse/blob/bb9a567679da7cb95724a71be1c10eac1ade11e8/native/Sources/CommonGround/KnowledgeBaseBrowser.swift)
takes injectable `probe`, `makeProcess`, `startupTimeout`, and `shutdownGrace`, and
[`KnowledgeBaseBrowserTests.swift`](https://github.com/jlevy/paraverse/blob/bb9a567679da7cb95724a71be1c10eac1ade11e8/native/Tests/CommonGroundTests/KnowledgeBaseBrowserTests.swift)
covers reusing a matching server, refusing a conflicting one, stopping only the owned
child, closing during startup, warm reopen, restarting a lost warm server, and a child
that ignores `SIGTERM`.

```swift
public nonisolated protocol ServerProcess: AnyObject, Sendable {
    var pid: pid_t { get }
    /// The first valid ready line, buffered separately from diagnostic output.
    var lines: AsyncStream<String> { get }
    /// The wait status once the child has exited, or nil if the waiting task was
    /// cancelled first.
    func waitForExit() async -> Int32?
    func signalGroup(_ signal: Int32)
}

public enum ServerState: Equatable, Sendable {
    case stopped
    case starting(attempt: Int)
    case ready(URL)
    case restarting(attempt: Int, after: Duration)
    case failed(reason: String, recentOutput: [String])
}

public final class ServerSupervisor {  // main-actor isolated by default isolation
    public typealias ProcessFactory = (LaunchSpec) throws -> any ServerProcess
    public typealias ReadinessProbe = @Sendable (URL) async -> Bool

    public init(
        spec: LaunchSpec,
        policy: SupervisorPolicy = SupervisorPolicy(),
        makeProcess: @escaping ProcessFactory = { try PosixServerProcess($0) },
        probe: @escaping ReadinessProbe = ServerSupervisor.httpProbe
    )

    public func start() async
    public func stop() async  // SIGTERM to the group, bounded wait, then SIGKILL
}
```

A generation counter that every launch and stop increments lets late callbacks from an
old child recognize that they are stale.
A test with a fake child that ignores `SIGTERM`, using Swift Testing:

```swift
@Test func stopEscalatesToKillWhenTermIsIgnored() async {
    let child = FakeProcess(ignoresTerm: true)
    let supervisor = ServerSupervisor(
        spec: spec, policy: fastPolicy(), makeProcess: { _ in child }, probe: { _ in true })
    child.say(#"{"event":"ready","protocol":1,"url":"http://127.0.0.1:5000/","port":5000,"pid":4242,"version":"1.4.0"}"#)
    await supervisor.start()
    await supervisor.stop()
    #expect(child.signals == [SIGTERM, SIGKILL])
    #expect(supervisor.state == .stopped)
}
```

Test the real `posix_spawn` path too, with `/bin/sh` as the child: that it runs in its
own group (`getpgid(child.pid) == child.pid`), receives the secret on stdin, and exits
when the lifeline closes.

Three defects surfaced while writing the example for this guideline, each of which hung
a test:

- **A timeout race needs a cancellable wait.** `withTaskGroup` does not return until
  every child task has finished, so racing `Task.sleep` against a continuation that
  ignores cancellation never times out, and `SIGKILL` is never sent.
  `ExitLatch.wait()` uses `withTaskCancellationHandler` to resume with `nil`:

  ```swift
  func wait() async -> Int32? {
      let id = UUID()
      return await withTaskCancellationHandler {
          await withCheckedContinuation { (waiter: CheckedContinuation<Int32?, Never>) in
              let immediate: Int32?? = state.withLock { s in
                  if let status = s.status { return .some(status) }
                  if Task.isCancelled { return .some(nil) }
                  s.waiters[id] = waiter
                  return .none
              }
              if let immediate { waiter.resume(returning: immediate) }
          }
      } onCancel: {
          state.withLock { $0.waiters.removeValue(forKey: id) }?.resume(returning: nil)
      }
  }
  ```

- **Keep the `FileHandle` you read from.** A handle created with `closeOnDealloc: true`
  and stored only in a local variable is released when `init` returns, its descriptor
  closes, and the readability handler never fires again.

- **Capture `let`, not `var`, in `@Sendable` closures.** The pid written by
  `posix_spawn` must be copied into a constant before the exit handler captures it.

### Keeping a Warm Server

Starting an interpreted server can take seconds; reopening a window on a running one
costs only a page load.
So keep the server running when the last window closes, reopen on a Dock click, and stop
it on quit or after an idle period you choose.
If a window closes while the server is still starting, cancel the startup rather than
leaving a half-started child.

* * *

## 4. Attaching to a Server Something Else Started

### When It Fits

Sometimes the server is not the app’s child: a CLI started it in a terminal, an agent
runs it in the background, or a launch agent keeps it alive.
Then the app should be one optional viewer of a server it does not own.
This is a pattern with real trade-offs, not a default.

### The Server Record

When it is ready, the server publishes a record (the ready line’s fields plus an
instance ID and the per-launch secret), and removes it on clean exit:

```json
{
  "protocol": 1,
  "url": "http://127.0.0.1:52144/",
  "port": 52144,
  "pid": 48211,
  "version": "1.4.0",
  "instanceID": "6f1c…",
  "secret": "q5x…"
}
```

- Write it to `~/Library/Application Support/<App>/servers/<instanceID>.json`, in a
  directory with mode `0700`.
- Write atomically: create a temporary file in the same directory with
  `O_CREAT | O_EXCL | O_NOFOLLOW` and mode `0600`, write, `fsync`, then `rename`.
- Read defensively, refusing anything that is not a small regular file owned by the
  current user with no group or other permissions:

```swift
public nonisolated enum ServerRecordReader {
    public static func read(_ url: URL) throws(ServerRecordError) -> ServerRecord {
        let fd = open(url.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { throw errno == ENOENT ? .missing : .unreadable }
        defer { close(fd) }
        var info = stat()
        guard fstat(fd, &info) == 0 else { throw .unreadable }
        guard info.st_mode & S_IFMT == S_IFREG else { throw .notRegularFile }
        guard info.st_uid == getuid() else { throw .wrongOwner }
        guard info.st_mode & 0o077 == 0 else { throw .tooPermissive }
        guard info.st_size <= 16_384 else { throw .tooLarge }
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: false)
        guard let data = try? handle.readToEnd(),
              let record = try? JSONDecoder().decode(ServerRecord.self, from: data),
              record.url.host == "127.0.0.1" || record.url.host == "::1"
        else { throw .unreadable }
        return record
    }
}
```

### Attach Protocol

1. List the records; skip any whose pid is gone (`kill(pid, 0)` fails with `ESRCH`). A
   pid can be reused, so this is only a cheap filter.
2. Call `GET /healthz` with `Authorization: Bearer <secret>` and require the response to
   echo the record’s `instanceID` and a protocol version the app supports.
   This is the identity check; a stale record or a reused port fails it.
3. Install the session cookie from the record’s secret and load the URL, exactly as for
   a spawned server.
4. Never signal the server.
   If it dies, offer to start one the app owns.

The reverse direction is symmetric: the app’s own server can publish a record too, so a
CLI started later attaches to it instead of starting a second server.

### Single Instance and URL Hand-Off

LaunchServices activates the running copy of an app instead of starting a second one
(unless launched with `open -n`). So a CLI can run `open "example://open?path=…"`, and
the running app receives it in `application(_:open:)`. The app then attaches to the
server named in the record or spawns its own.
Register the scheme with `CFBundleURLTypes`, and validate every URL it receives: any web
page or app can open it.

### Trade-Offs

|  | Spawn (app owns the server) | Attach (app is a viewer) |
| --- | --- | --- |
| **Lifecycle** | The app starts, restarts, and stops it. | The owner does; the app must handle the server vanishing. |
| **Privacy identity** | TCC prompts name the app, with its usage strings. | Prompts and grants belong to whatever launched the server, such as Terminal or an editor. One third-party report from the macOS 14 era describes a launch-agent script failing with “operation not permitted” and no prompt at all ([nunn-blog, 2023-11-28](https://nunn-blog.pages.dev/2023/11/28/tcc-launchd-woes)). The app cannot fix an `EPERM` by prompting. |
| **Orphans** | Prevented by the process group and stdin EOF. | Not the app’s concern. |
| **Version skew** | App and server ship together. | A separately installed CLI may be older or newer; check the protocol version. |
| **Secret exposure** | Only in two processes’ memory. | In a file any unsandboxed process running as the user can read. |
| **Code** | The supervisor. | The record writer, reader, identity probe, and fallback to spawning. |

Prefer spawning. Add attaching when users genuinely run the server outside the app and
want one window on it.

* * *

## 5. Building Without the Xcode GUI

### SwiftPM Plus a Bundle Script

An executable SwiftPM package plus a short script is enough for a shell.
Split supervision into a library target so it can be tested without AppKit:

```swift
// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "ExampleShell",
    platforms: [.macOS(.v15)],
    targets: [
        .target(  // supervision and server records: no AppKit, unit-tested
            name: "ShellCore",
            swiftSettings: [.defaultIsolation(MainActor.self)]
        ),
        .executableTarget(  // menus, windows, WKWebView
            name: "ExampleShell",
            dependencies: ["ShellCore"],
            swiftSettings: [.defaultIsolation(MainActor.self)]
        ),
        .testTarget(
            name: "ShellCoreTests",
            dependencies: ["ShellCore"],
            swiftSettings: [.defaultIsolation(MainActor.self)]
        ),
    ]
)
```

The script builds each architecture, lays out the bundle, and signs inside out.
This one was run end to end, ad hoc signed, for this guideline:

```bash
#!/usr/bin/env bash
# Assemble, sign, and verify Example.app from a SwiftPM build. No Xcode project.
# Usage: VERSION=1.2.0 BUILD=42 SIGN_ID="Developer ID Application: Name (TEAMID)" packaging/build-app.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${VERSION:?set VERSION, for example 1.2.0}"
: "${BUILD:?set BUILD, a monotonically increasing integer}"
SIGN_ID="${SIGN_ID:--}"            # "-" is ad hoc: fine locally, rejected by notarization
ARCHES="${ARCHES:-arm64}"          # "arm64 x86_64" for a universal binary
APP="dist/Example.app"

# 1. Build each architecture separately, then merge with lipo.
slices=()
for arch in $ARCHES; do
  swift build -c release --arch "$arch" --scratch-path ".build-$arch"
  slices+=("$(swift build -c release --arch "$arch" --scratch-path ".build-$arch" --show-bin-path)/ExampleShell")
done

# 2. Lay out the bundle.
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
lipo -create "${slices[@]}" -output "$APP/Contents/MacOS/ExampleShell"
cp packaging/Info.plist "$APP/Contents/Info.plist"
plutil -replace CFBundleShortVersionString -string "$VERSION" "$APP/Contents/Info.plist"
plutil -replace CFBundleVersion -string "$BUILD" "$APP/Contents/Info.plist"
if [[ -d packaging/AppIcon.iconset ]]; then   # icon_16x16.png ... icon_512x512@2x.png
  iconutil -c icns packaging/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"
fi
# Put Mach-O helpers in Contents/Helpers and interpreted scripts in Contents/Resources.
# See Apple's "Placing content in a bundle" for other nested code types.
# Copy any additional payloads before signing. This example has no nested code.
# When adding a native helper, sign its explicit path before the outer app. Sign
# nested bundles from the inside out. Resources, including scripts, are sealed by
# the outer signature; do not sign a script separately or use --deep for signing.

# 3. Sign the app after any nested code.
codesign --force --sign "$SIGN_ID" --options runtime --timestamp "$APP"

# 4. Verify. --deep is for verification only.
codesign --verify --deep --strict --verbose=2 "$APP"
codesign -dv "$APP" 2>&1 | grep -E "Identifier|flags|TeamIdentifier"
```

Bundled frameworks (Sparkle) and nested bundles (`.xpc`, `.app`) are signed as bundles,
deepest first, before the app.
The example has no nested code.
Sign additional Mach-O helpers and nested bundles explicitly before signing the outer
app. Livebook’s former shell used the same SwiftPM-plus-script shape, and
[kofigumbs/multi](https://github.com/kofigumbs/multi) does build, sign, DMG,
notarization, and `brew bump-cask-pr` from one `Makefile`.

### Info.plist

The keys a local-server shell needs (`plutil -lint` passes on the full file):

```xml
<key>CFBundleIdentifier</key>          <string>com.example.ExampleShell</string>
<key>CFBundleName</key>                <string>Example</string>
<key>CFBundleExecutable</key>          <string>ExampleShell</string>
<key>CFBundlePackageType</key>         <string>APPL</string>
<key>CFBundleShortVersionString</key>  <string>0.0.0</string>  <!-- stamped by the script -->
<key>CFBundleVersion</key>             <string>0</string>
<key>CFBundleIconFile</key>            <string>AppIcon</string>
<key>LSMinimumSystemVersion</key>      <string>15.0</string>
<key>NSPrincipalClass</key>            <string>NSApplication</string>
<key>NSHighResolutionCapable</key>     <true/>

<!-- Loopback HTTP: the documented declaration of intent. -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>   <true/>
</dict>

<!-- example://open?path=... reaches application(_:open:) in the running app. -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>         <string>com.example.ExampleShell</string>
    <key>CFBundleURLSchemes</key>      <array><string>example</string></array>
  </dict>
</array>

<!-- Folders dropped on the Dock icon or opened with Open With. -->
<key>CFBundleDocumentTypes</key>
<array>
  <dict>
    <key>CFBundleTypeName</key>        <string>Folder</string>
    <key>CFBundleTypeRole</key>        <string>Viewer</string>
    <key>LSHandlerRank</key>           <string>Alternate</string>
    <key>LSItemContentTypes</key>      <array><string>public.folder</string></array>
  </dict>
</array>

<!-- Shown in TCC prompts the server child triggers in the app's name. -->
<key>NSDocumentsFolderUsageDescription</key>
<string>Example shows the folders you open from Documents.</string>
<key>NSDesktopFolderUsageDescription</key>
<string>Example shows the folders you open from the Desktop.</string>
<key>NSDownloadsFolderUsageDescription</key>
<string>Example shows the folders you open from Downloads.</string>
<key>NSRemovableVolumesUsageDescription</key>
<string>Example shows folders on removable drives that you open.</string>
<key>NSNetworkVolumesUsageDescription</key>
<string>Example shows folders on network drives that you open.</string>
```

Never add `LSFileQuarantineEnabled` (see [Quarantine](#quarantine-and-gatekeeper)). The
bundle identifier is part of the designated requirement that TCC grants key off, names
the `UserDefaults` domain, and identifies the app to LaunchServices and Homebrew’s
`zap`; choose it once.

### Universal or arm64

`swift build --arch arm64 --arch x86_64` routes through Xcode’s build system, and forum
reports say some `-Xswiftc` and `-Xlinker` flags are ignored in that mode
([Swift Forums](https://forums.swift.org/t/swift-build-flags-with-two-arch/72199)).
Building each slice and merging with `lipo` works from an Apple silicon runner with no
Intel machine. Measured: 484,080 bytes arm64 plus 467,840 bytes x86_64 made a
1,007,312-byte universal executable.
Whether to ship x86_64 at all is covered in
[Section 8](#minimum-macos-and-architecture).

### Icons

- `iconutil -c icns AppIcon.iconset` turns a folder of PNGs (`icon_16x16.png` through
  `icon_512x512@2x.png`) into an `.icns` with only the Command Line Tools.
- `actool` compiles asset catalogs and needs full Xcode.
  Whether it also compiles macOS 26 Icon Composer `.icon` files outside Xcode was not
  tested here.
- Generate the iconset in the build (resize one master PNG with `sips -z`, or draw it
  from a `swift` script), so the source of truth is a file in the repository.

### Generated Xcode Projects

Choose XcodeGen (2.46.0) or Tuist when you need `xcodebuild archive` and export,
Xcode-managed signing, asset catalogs, or several targets such as app extensions.
[kiwix-apple](https://github.com/kiwix/kiwix-apple) generates its project from
`project.yml` (macOS 14.6, `SWIFT_VERSION: 6`, `ENABLE_HARDENED_RUNTIME: YES`). Tuist
releases almost daily, so pin a version at least 14 days old.
For a shell of about 1,000 lines with one target, the script is less to maintain.

### GitHub-Hosted Runners

From [actions/runner-images](https://github.com/actions/runner-images), observed
2026-11-08:

| Label | Arch | macOS | Xcode |
| --- | --- | --- | --- |
| `macos-26`, `macos-latest` | arm64 | 26.6.2 (image 20261026) | **26.6 default**; 26.0.1, 26.1.1, 26.2, 26.3, 26.4.1, 26.5 |
| `macos-15` | arm64 | 15.8.2 (image 20261028) | 16.4 default; 16.0 to 16.3; 26.0.1 to 26.3 |
| `macos-26-intel`, `macos-15-intel` | x64 | 26, 15 | Larger, slower runners |
| `xcode-27` (preview) | arm64 | 27.0.1 | 27.1 default; 27.0; 27.2 RC |

“All macOS 14 images retired from GitHub Actions on November 2, 2026”; Azure DevOps
keeps macOS 14 Intel images until 2026-11-23
([runner-images#15226](https://github.com/actions/runner-images/issues/15226)). Select
Xcode explicitly (`sudo xcode-select -s /Applications/Xcode_26.6.app`) so an image
update cannot change your compiler silently.
Xcode 27 drops deployment targets below macOS 12; Sparkle 2.10.0 raised its own minimum
to 12.0 for that reason.

### Build Times, Measured

On an Apple M1 Pro (10 cores) with Xcode 26.6, 2026-11-08, the example in this guideline
(1,011 lines of Swift: 557 of AppKit app code and 454 of supervision and records, plus
170 lines of tests) built clean in 10.0 to 13.4 seconds per architecture and
incrementally in about 3 seconds.
The universal bundle is 992KB; the stripped arm64 executable is 281KB.

Notarization, not compilation, dominates release time: Apple says most submissions
finish within 5 minutes and 98 percent within 15
([Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)).

* * *

## 6. Signing, Notarization, and Distribution

### Requirements

From
[Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
and
[Creating distribution-signed code for the Mac](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac):

- Sign every executable with a **Developer ID Application** certificate; Apple
  Development and ad hoc signatures are rejected.
  The Apple Developer Program is 99 USD a year, and only the Account Holder can create a
  Developer ID certificate.
- Enable the **hardened runtime** (`-o runtime`) “for your app and command line
  targets.”
- Include a **secure timestamp** (`--timestamp`).
- Do not include `com.apple.security.get-task-allow`.
- Sign from the inside out, and “Don’t pass the `--deep` option to `codesign` when you
  sign code.”

Since macOS 15, users can no longer Control-click to open software that is not signed
and notarized; they must go to System Settings > Privacy & Security
([Apple developer news, 2024-08-06](https://developer.apple.com/news/?id=saqachfa)). For
anything you distribute, notarization is effectively required.

### Entitlements: Usually None

A shell that shows `WKWebView` and spawns a separate server process needs no
entitlements file. The probe ran with the hardened runtime and no entitlements
(`flags=0x10002(adhoc,runtime)`), and `WKWebView` with JavaScript worked, because the
JIT runs in Apple’s WebContent process.

- **`com.apple.security.cs.allow-jit`:** Electron needs it because V8 runs in its own
  processes. A `WKWebView` shell does not.
- **`com.apple.security.cs.disable-library-validation`:** Library validation “prevents a
  program from loading frameworks, plug-ins, or libraries unless they’re either signed
  by Apple or signed with the same Team ID as the main executable,” and Gatekeeper “runs
  extra security checks on programs that have it disabled”
  ([Apple](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation)).
  It is per process; see [Section 8](#library-validation-is-per-process).
- **Resource entitlements** (`com.apple.security.device.camera`, `.audio-input`) are
  needed only if the page uses them, and are checked on the responsible app.

### Signing Order

Follow Apple’s
[bundle placement rules](https://developer.apple.com/documentation/bundleresources/placing-content-in-a-bundle):
put interpreted scripts in Resources and seal them with the containing bundle.

Inside out, each item once:

1. Loose helper executables (`Contents/MacOS/<helper>`, `Contents/Helpers/*`), with
   `-o runtime --timestamp`, and `-i <identifier>` for code that is not a bundle.
2. Nested bundles, deepest first.
   For Sparkle, a shipping app (Arc, Sparkle 2.9.4, inspected read-only on 2026-11-08)
   re-signs `Autoupdate`, `Updater.app`, `XPCServices/Installer.xpc`,
   `XPCServices/Downloader.xpc`, and then `Sparkle.framework`, all with its own Team ID
   and `flags=0x10000(runtime)`.
3. The app itself.

Verify with `codesign --verify --deep --strict --verbose=2`, then
`spctl --assess --type execute -vv` after notarization.

### A Release Job

An outline for a tag-triggered GitHub Actions job (not run for this guideline; the
commands follow
[GitHub’s certificate guide](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
and the local `notarytool submit --help`):

```yaml
name: release-macos
on:
  push:
    tags: ["v*"]
permissions:
  contents: write                      # gh release upload
jobs:
  release:
    runs-on: macos-26                  # arm64, Xcode 26.6 default
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - run: sudo xcode-select -s /Applications/Xcode_26.6.app
      - name: Import the Developer ID certificate into a temporary keychain
        env:
          P12_BASE64: ${{ secrets.DEVELOPER_ID_P12_BASE64 }}
          P12_PASSWORD: ${{ secrets.DEVELOPER_ID_P12_PASSWORD }}
        run: |
          KEYCHAIN="$RUNNER_TEMP/signing.keychain-db"
          KEYCHAIN_PASSWORD="$(openssl rand -base64 24)"
          echo "$P12_BASE64" | base64 --decode > "$RUNNER_TEMP/cert.p12"
          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
          security set-keychain-settings -lut 21600 "$KEYCHAIN"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
          security import "$RUNNER_TEMP/cert.p12" -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN"
          security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
          security list-keychain -d user -s "$KEYCHAIN"
          rm "$RUNNER_TEMP/cert.p12"
      - name: Build and sign
        env:
          SIGN_ID: ${{ secrets.DEVELOPER_ID_IDENTITY }}  # "Developer ID Application: Name (TEAMID)"
        run: VERSION="${GITHUB_REF_NAME#v}" BUILD="$GITHUB_RUN_NUMBER" packaging/build-app.sh
      - name: Notarize, staple, and package
        env:
          SIGN_ID: ${{ secrets.DEVELOPER_ID_IDENTITY }}
          ASC_KEY_P8: ${{ secrets.ASC_API_KEY_P8 }}
          ASC_KEY_ID: ${{ secrets.ASC_API_KEY_ID }}
          ASC_ISSUER_ID: ${{ secrets.ASC_API_ISSUER_ID }}  # Team keys only
        run: |
          V="${GITHUB_REF_NAME#v}"
          KEY="$RUNNER_TEMP/AuthKey.p8"; printf '%s' "$ASC_KEY_P8" > "$KEY"
          notarize() {
            xcrun notarytool submit "$1" --key "$KEY" --key-id "$ASC_KEY_ID" \
              --issuer "$ASC_ISSUER_ID" --wait --timeout 30m
          }
          # The app: notarize a ZIP of it, staple the app, then re-zip the stapled app.
          ditto -c -k --keepParent dist/Example.app dist/submit.zip
          notarize dist/submit.zip
          xcrun stapler staple dist/Example.app
          ditto -c -k --keepParent dist/Example.app "dist/Example-$V.zip"
          # The DMG: drag-to-Applications layout, signed, notarized, stapled.
          mkdir -p dist/dmg && cp -R dist/Example.app dist/dmg/ && ln -s /Applications dist/dmg/
          hdiutil create -volname Example -srcfolder dist/dmg -ov -format UDZO "dist/Example-$V.dmg"
          codesign --sign "$SIGN_ID" --timestamp "dist/Example-$V.dmg"
          notarize "dist/Example-$V.dmg"
          xcrun stapler staple "dist/Example-$V.dmg"
          spctl --assess --type execute -vv dist/Example.app
          rm "$KEY"
      - name: Upload release assets
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release upload "$GITHUB_REF_NAME" dist/Example-*.zip dist/Example-*.dmg --clobber
```

- **Use an App Store Connect API key** (`--key`, `--key-id`, and `--issuer`, which
  `notarytool` says is “Required for Team API Keys”) rather than an Apple ID and
  app-specific password.
- Run `xcrun notarytool log <submission-id>` on failures, and read it even on success
  for warnings.
- On a self-hosted runner, delete the temporary keychain in a final `if: always()` step.

### Stapling and Containers

- The notary service accepts UDIF disk images, signed flat packages, and ZIP archives.
- “While you can notarize a ZIP archive, you can’t staple to it directly”: staple the
  app inside, then create a new ZIP. Apps, DMGs, and flat packages can be stapled.
- Without a stapled ticket, Gatekeeper must reach Apple online at first launch.
- Ship both on GitHub Releases: a **DMG** for people (drag to Applications) and a **ZIP
  of the stapled app** for Sparkle and Homebrew.
  JupyterLab Desktop ships the same pair.
- A `.pkg` needs a separate Developer ID Installer certificate and admin rights; use it
  only for multi-component installs.

### Homebrew

- **Gatekeeper is mandatory.** Homebrew 5.0.0 (2025-11-12): “Casks without codesigning
  are deprecated. We will disable all Homebrew/homebrew-cask casks that fail Gatekeeper
  checks in September 2026”
  ([Homebrew blog](https://brew.sh/2025/11/12/homebrew-5.0.0/)); the same release
  deprecated `--no-quarantine`. Casks were disabled on 2026-09-01; Platypus’s
  ([issue #299](https://github.com/sveinbjornt/Platypus/issues/299)) is one.
- **Homebrew quarantines every cask download** so that Gatekeeper performs its checks
  (`docs/Homebrew-Security-and-Supply-Chain.md`), so even a cask in a personal tap needs
  a notarized app.
- **Current policy** (`docs/Acceptable-Casks.md`): a cask “must work on the latest major
  version of macOS,” and executable artifacts must pass Homebrew’s Gatekeeper checks.
  New `requires_rosetta` casks have been rejected since macOS 27 became current.
- **Notability for `homebrew/cask`** (`docs/Package-Acceptance-Policy.md`): at least 30
  forks, 30 watchers, or 75 stars; at least 90, 90, or 225 for a self-submission by the
  repository owner; and a repository at least 30 days old.
  Until then, publish in your own tap (`brew install --cask owner/tap/example`).
- **`auto_updates true`** asserts that the app updates itself; use it “if
  `Check for Updates…` or similar is present in an app menu, but not if it only opens a
  webpage” (Cask Cookbook).
  Keep `CFBundleShortVersionString` equal to the cask `version`.

```ruby
cask "example" do
  version "1.2.0"
  sha256 "…"

  url "https://github.com/OWNER/REPO/releases/download/v#{version}/Example-#{version}.zip"
  name "Example"
  desc "Native window for the Example local server"
  homepage "https://github.com/OWNER/REPO"

  depends_on arch: :arm64
  depends_on macos: :sequoia

  app "Example.app"

  zap trash: [
    "~/Library/Application Support/Example",
    "~/Library/Logs/Example",
    "~/Library/Preferences/com.example.ExampleShell.plist",
  ]
end
```

If your project also has a CLI formula, name the cask `example-app`, following
Homebrew’s `-app` convention, and do not expose the CLI through the cask’s `binary`
stanza; Homebrew 7.0.0 gives formula links precedence when both provide a command.

* * *

## 7. Updates

### Shell and Payload Update Separately

A shell changes rarely; the server it runs may change weekly.
Version them separately:

- **The shell** updates through Sparkle, the Homebrew cask, or an in-app “new version
  available” notice that links to the DMG.
- **The server**, if it lives outside the bundle, updates through its own installer (uv,
  npm, Homebrew), which the shell can run at startup or on request.
  Apply the 14-day cool-off there too.
- **A server bundled inside the app** updates with the app, and must be signed and
  notarized with it.

Treat “the app was updated” as a trigger to reconcile the server environment.

### Sparkle 2

[Sparkle](https://sparkle-project.org/) is the standard updater for Developer ID apps.
Pin a fixed version, and never one below 2.9.6. These advisories were published in 2026
(GitHub security advisories API):

| Advisory | Severity | Fixed in | Summary |
| --- | --- | --- | --- |
| CVE-2026-47121 (GHSA-hg88-v3cw-3qrh) | Medium | 2.9.2 | Binary delta apply follows intermediate symlinks in a malicious `.delta`. |
| CVE-2026-47122 (GHSA-g3hp-f6mg-559v) | Medium | 2.9.2 | The installer’s XPC listener accepts unvalidated connections, allowing spoofed appcast data. |
| CVE-2026-115568 (GHSA-gmj2-gq3j-vqmj) | Medium | 2.9.5 | Incomplete fix of CVE-2026-47121, allowing arbitrary file overwrite. |
| GHSA-3x7w-j75x-ppq5 | High | 2.9.6 | The update is validated on the resolved path but moved via the unresolved path. |
| GHSA-4v99-qgq9-6pxp | High | 2.9.6 | Root-privileged cache cleanup follows a symlink under the user’s home. |

2.10.0 (2026-09-13) raised the minimum to macOS 12 and dropped CocoaPods.
2.10.1 (2026-10-25) contains fixes and translations.

- **Sign updates with EdDSA.** Run `generate_keys` once (the private key goes in your
  login Keychain; export it into CI secrets for automated releases), put the public key
  in `SUPublicEDKey`, and set `SUFeedURL`. `generate_appcast` signs the archives in a
  folder and writes the appcast and deltas.

- **Sign the feed too.** `SURequireSignedFeed` (Sparkle 2.9 and later) makes Sparkle
  validate that “appcasts and release notes are signed,” and requires
  `SUVerifyUpdateBeforeExtraction`
  ([Customization](https://sparkle-project.org/documentation/customization/)).

- **No XPC services outside the sandbox.** Sparkle’s sandboxing guide says “If you do
  not sandbox your application, you should skip this guide,” and that a non-sandboxed
  app “may choose to remove these services in a post install script”
  ([Sandboxing](https://sparkle-project.org/documentation/sandboxing/)).

- **Wire it in code:**

  ```swift
  import Sparkle

  let updater = SPUStandardUpdaterController(
      startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
  let item = NSMenuItem(
      title: "Check for Updates…",
      action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)), keyEquivalent: "")
  item.target = updater
  ```

- **Under plain SwiftPM** Sparkle is a binary target.
  Copy `Sparkle.framework` into `Contents/Frameworks`, add the rpath
  `@executable_path/../Frameworks` to the executable, and sign its nested code as in
  [Signing Order](#signing-order).
  Sparkle documents only Xcode’s archive flow for this, and this guideline did not build
  it, so verify with `otool -l` (look for `LC_RPATH`),
  `codesign --verify --deep --strict`, and `spctl`.

- **Host on GitHub.** Archives as release assets and `appcast.xml` on GitHub Pages or as
  a release asset. syncthing-macos generates its appcast from GitHub Releases with a
  small tool (`cmd/ghreleases2appcast`); NetNewsWire keeps appcasts in its repository.

- **Size.** The embedded framework measured 2.8MB (Arc, Sparkle 2.9.4).

### Cask Plus In-App Notice

Without Sparkle, the shell checks the GitHub Releases API (or a small JSON manifest) at
most daily, compares versions, and shows a notice linking to the release.
Homebrew users run `brew upgrade --cask`. Do not declare `auto_updates true` for this;
the app does not install anything itself.
Start here, and add Sparkle when shell releases become frequent enough to justify its
attack surface and advisory tracking.

### Refuse Translocated and Read-Only Launches

A quarantined app opened where it landed (Downloads, or a mounted DMG) runs from a
randomized read-only copy, App Translocation, which breaks self-updates
([Eclectic Light](https://eclecticlight.co/2023/05/09/what-causes-app-translocation)).
Sparkle by default does not notify the user “if an update cannot be performed, like if
the app is running from a read-only mount”
([Sparkle documentation](https://sparkle-project.org/documentation/)). Detect it and ask
the user to move the app:

```swift
func isRunningFromReadOnlyLocation() -> Bool {
    let url = Bundle.main.bundleURL
    let readOnly = (try? url.resourceValues(forKeys: [.volumeIsReadOnlyKey]))?.volumeIsReadOnly ?? false
    return readOnly || url.path.contains("/AppTranslocation/")
}
```

That a translocated launch reports a read-only volume is an inference from translocation
running the app from a read-only mount, not tested here; the path check is the second
signal.

* * *

## 8. macOS Platform Rules for Local-Server Shells

These apply to any shell that starts or shows a local server: Swift, Tauri, Electron, or
Electrobun.

### TCC: Folder Prompts and the Responsible Process

- **Protected locations prompt per folder.** Desktop, Documents, and Downloads each
  prompt separately on first access (macOS 10.15 and later), as do removable volumes,
  network volumes, and file provider domains under `~/Library/CloudStorage`. Each has an
  `Info.plist` usage-description key, listed in the example above.
  Mail, Messages, Safari data, and Time Machine backups need Full Disk Access and fail
  with `EPERM` and no prompt.
  On macOS 27, access to other teams’ app containers and group containers “no longer
  prompts … such accesses are denied by default”
  ([macOS 27 release notes](https://developer.apple.com/documentation/macos-release-notes/macos-27-release-notes)).
- **The app is the responsible process for its children.** TCC charges a helper’s access
  to the app that spawned it, so prompts show your app’s name and usage strings and the
  decision applies to the whole app
  ([Apple DTS, forum thread 678819](https://developer.apple.com/forums/thread/678819)).
  TN3179 states the same model for Local Network privacy: “if your app spawns a helper
  tool and the helper tool performs a local network operation, macOS considers the app
  to be the responsible code.”
  Spawn the server as a direct child; do not daemonize it and do not use the private
  `responsibility_spawnattrs_setdisclaim`.
- **A terminal-launched server uses the terminal’s grants.** The same server started
  from Terminal, iTerm2, or an editor inherits that host’s grants, including Full Disk
  Access. Users will notice that the two differ; say so in your documentation.
- **User intent needs no prompt.** Choosing a file in an Open or Save panel, dropping it
  on the app, or opening it from Finder grants access to that file.
  Whether a folder chosen in the shell’s `NSOpenPanel` also covers the child server’s
  reads inside it is unverified; it follows from the responsible-process model, so test
  it.
- **Never touch protected folders eagerly.** Do not list, stat, or size Desktop,
  Documents, Downloads, iCloud Drive, or `/Volumes/*` at startup or while prefetching.
  Each touch can raise a prompt before the user did anything.
  Prompt in context, after an in-app explanation, and map `EPERM` to a message that
  links to System Settings.
- **Full Disk Access cannot be requested.** The user adds the app in System Settings >
  Privacy & Security > Full Disk Access.
  Offer it as an optional step; every child process, including any plugin code your
  server runs, inherits it.
- **Keep the signing identity stable.** Grants key off the app’s designated requirement,
  so a Developer ID signature keeps them across updates and ad hoc builds re-prompt on
  every rebuild. For development builds, sign with one stable Apple Development identity
  rather than ad hoc, so grants survive rebuilds.
  Reset with `tccutil reset <Service> <bundleID>`.

### Quarantine and Gatekeeper

This section is the reference the other desktop guidelines link to.
In one sentence: **Gatekeeper’s identified-developer and notarization checks, and its
first-open approval prompt, apply to quarantined code; every app, quarantined or not, is
still scanned for known malware the first time it opens, and on Apple silicon every
executable needs a valid signature, of which an ad hoc one is enough.**

- **What marks a file.** `com.apple.quarantine` is added by the app that downloaded or
  received the file: browsers, Mail, AirDrop, and Homebrew for cask downloads.
  “Unix-y networking tools, like `curl` and `scp`, don’t quarantine the files they
  download,” and `tar` and `unzip` don’t propagate it
  ([Apple DTS, forum thread 706442](https://developer.apple.com/forums/thread/706442)).
  A sandboxed app, or one with `LSFileQuarantineEnabled`, quarantines the files it
  creates.
- **Quarantined code, at first open.** “Gatekeeper verifies that the software is from an
  identified developer,” is notarized, and has not been altered, and “also requests user
  approval before opening downloaded software for the first time”
  ([Gatekeeper and runtime protection](https://support.apple.com/guide/security/gatekeeper-and-runtime-protection-sec5599b66df/web),
  Apple Platform Security).
  Without a stapled ticket the check goes online.
  Unnotarized or ad hoc code is refused: ad hoc binaries “cannot pass through
  Gatekeeper”
  ([macOS Big Sur universal apps release notes](https://developer.apple.com/documentation/macos-release-notes/macos-big-sur-11_0_1-universal-apps-release-notes)),
  and since macOS 15 the only override is Open Anyway in System Settings.
- **Code without the quarantine attribute** gets no notarization requirement and no
  approval prompt. Apple scopes both to downloaded software, and on the research Mac ad
  hoc–signed, unquarantined interpreters installed by uv ran without either.
  It is still checked:
  - **Malware scan, always.** “All software in macOS is checked for known malicious
    content the first time it’s opened,” “regardless of how it arrived on the Mac”
    (Gatekeeper and runtime protection).
    In macOS 10.15 and later, XProtect scans when “an app is first launched,” when “an
    app has been changed (in the file system),” and when its signatures update
    ([Protecting against malware](https://support.apple.com/guide/security/protecting-against-malware-sec469d47bd8/web)).
    A match is blocked whether or not the file was quarantined.
  - **A signature, on Apple silicon.** “The operating system enforces that any
    executable must be signed before it’s allowed to run,” and “a simple ad-hoc
    signature is sufficient” (Big Sur release notes).
    The linker applies one by default, so this bites only binaries modified after
    linking.
  - **Revocation, for signed code.** macOS “regularly checks for new revocation tickets”
    in the background (Protecting against malware).
  - **Provenance.** After the first checks, macOS tags apps with `com.apple.provenance`
    and uses it to recognize them later.
    Apple does not document the attribute; the best description is secondary
    ([Eclectic Light, 2025-12-05](https://eclecticlight.co/2025/12/05/quarantine-macl-and-provenance-what-are-they-up-to/)),
    which also observed signature-integrity checks and a cdhash lookup at the first run
    of unquarantined code.
    On the research Mac, uv’s interpreters and `uv` carried provenance and no
    quarantine.
- **Reading other guidelines.** “Gatekeeper does not assess unquarantined code” is right
  about notarization and the prompt.
  “Unquarantined code still gets a first-run assessment” is right about the malware
  scan. Neither means unquarantined code needs notarizing.
- **Never set `LSFileQuarantineEnabled`.** It makes “the files this app creates …
  quarantined by default”
  ([Apple](https://developer.apple.com/documentation/bundleresources/information-property-list/lsfilequarantineenabled)),
  and child processes inherit the quarantine flags.
  [pnpm issue 11056](https://github.com/pnpm/pnpm/issues/11056) shows a terminal inside
  an app with this key producing quarantined native addons that Gatekeeper then refused.
  A shell with the key would quarantine every interpreter, wheel, or binary its server
  downloads, and Gatekeeper would block them.
  Chrome sets the key; do not copy Chrome’s `Info.plist`.

### Library Validation Is Per Process

Library validation is part of the hardened runtime, which a signature opts into.
It stops a hardened process from loading frameworks, plug-ins, or libraries “unless
they’re either signed by Apple or signed with the same Team ID as the main executable”
([Apple](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation)).
A child started by `posix_spawn` runs under its own executable’s signature, so the
shell’s library validation does not reach it.
On the research Mac, uv-installed python-build-standalone interpreters were signed
`flags=0x20002(adhoc,linker-signed)`, with no hardened-runtime flag, so library
validation did not apply to them either.

So `disable-library-validation` is needed only by a hardened-runtime process that loads
code signed ad hoc or by another team, which in practice means an interpreter, embedded
in the shell or bundled and signed with the hardened runtime, that imports native
extensions such as wheels’ `.so` files.
A bundled interpreter signed with the hardened runtime that loads only code signed with
your own Team ID does not need it.
Datasette Desktop added the entitlement so plugins with unsigned `.so` files would load
([issue #96](https://github.com/simonw/datasette-app/issues/96)). Prefer a separate,
unhardened interpreter process.

Calibrate this: the per-process result was observed with ad hoc signatures only (an ad
hoc, hardened probe shell and ad hoc interpreters).
A Developer ID–signed, notarized parent spawning an ad hoc interpreter was not tested
here; test it before you rely on it.

### Local Network Privacy and Loopback

[TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy),
revised 2026-10-06:

- A local network is “an IP network associated with a broadcast-capable network
  interface”: Wi-Fi and Ethernet, not cellular or VPN. Loopback is not
  broadcast-capable, so `127.0.0.1` falls outside the definition; no Apple page says
  “loopback” explicitly.
- Outgoing TCP connections to a local network address require access; “Listening for and
  accepting incoming TCP connections” does not.
- “Traffic originating from WKWebView, SFSafariViewController, and Safari doesn’t
  require local network access.”
  Chromium-based shells get no such exemption.
- Command-line tools run from Terminal or SSH, and their children, are allowed
  automatically; the same tool under your app is attributed to your app and uses its
  `NSLocalNetworkUsageDescription`. A Git remote on a LAN address or a `.local` name
  will prompt in your app’s name.
- Local Network privacy tracks identity by code signature and main executable UUID, so
  ad hoc signing makes it misbehave.

Bind and connect to `127.0.0.1` (or `::1`) only, never `0.0.0.0` or the Mac’s LAN
address. That avoids the Local Network prompt and any exposure to the network.
Whether the Application Firewall still asks about an ad hoc–signed server that listens
only on loopback is an [open question](#open-research-questions).

### App Sandbox and the Mac App Store

Do not sandbox a shell that spawns a server.
Child processes inherit the sandbox, so the server could not read arbitrary folders or
run its toolchain, and every file it downloads is quarantined.
The Mac App Store requires the sandbox and its guidelines bar downloading or executing
new code (2.4.5(iv), 2.5.2), so a local-server shell ships as a Developer ID app outside
the store.

### Minimum macOS and Architecture

- **Target macOS 15.** In November 2026 Apple ships security updates for 27, 26, and 15;
  macOS 14 lost them in September 2026. macOS 15 and later get the current WebKit with
  Safari 27, Local Network privacy exists only from 15, and the privacy test matrix
  stays at three releases.
  Every API in this guideline is available on 14.0 or earlier, so 14 costs nothing in
  code, only in testing.
  Homebrew’s 30-day analytics (2026-10-09 to 2026-11-08) put macOS 15 and later at about
  95 percent of macOS events.
- **Ship arm64 first.** macOS 27 runs only on Apple silicon, macOS 26 is the last Intel
  release, and Homebrew moved Intel to Tier 3 in September 2026. A universal Swift shell
  costs only a second `swift build` and `lipo`, so add x86_64 if Intel users matter; a
  bundled server binary must then be universal or per architecture too.
- **Test on 15, 26, and 27 in VMs with snapshots**, using a Developer ID–signed build,
  because ad hoc builds re-prompt and first-run privacy behavior needs a clean state.

* * *

## 9. Example Repositories

Observed 2026-11-08.

| Repository | Stack | What it shows |
| --- | --- | --- |
| [syncthing/syncthing-macos](https://github.com/syncthing/syncthing-macos) (v2.1.6-1, 2026-10-06) | Objective-C and Swift, menu bar | **Supervising a bundled daemon**: `DaemonProcess.swift` isolates stdin with `Pipe()`, restarts after 10 s, keeps 200 log lines, passes `--no-browser`. Sparkle with an appcast generated from GitHub Releases. Opens the UI in the default browser rather than a web view. |
| [ollama/ollama](https://github.com/ollama/ollama) `app/` | Go and Objective-C | **Closest architecture**: `WKWebView` (vendored zserge `webview`) on `http://127.0.0.1:<port>`, link interception, `createWebViewWithConfiguration`, a token cookie, and a custom updater that verifies the downloaded bundle’s code signature before swapping. |
| [kofigumbs/multi](https://github.com/kofigumbs/multi) (v3.0.2, 2026-02-06) | Swift, SwiftPM | Remote-site wrapper; universal SwiftPM build, `codesign`, DMG, `notarytool`, `stapler`, and `brew bump-cask-pr` in one `Makefile`. GPL-3.0. |
| [rcarmo/swift-webapp-viewer](https://github.com/rcarmo/swift-webapp-viewer) (v1.1.2, 2026-05-06) | Swift, `swiftc` from a Makefile | Chromeless `WKWebView` app with `WKDownloadDelegate`, `isInspectable`, `pageZoom`, and multiple windows (`Sources/WebAppViewer/BrowserWindow.swift`). |
| [kiwix/kiwix-apple](https://github.com/kiwix/kiwix-apple) (3.18.0, 2026-10-31) | Swift 6, XcodeGen | Generated Xcode project, hardened runtime, and a `WKURLSchemeHandler` serving content. The reference for the custom-scheme route. GPL-3.0. |
| [livebook-dev/livebook](https://github.com/livebook-dev/livebook) history | Swift (removed) | A SwiftPM shell built by script (`swift build`, `plutil`, `actool`), removed 2026-04-10 after the move to Tauri. Read it in Git history. |
| [jlevy/paraverse](https://github.com/jlevy/paraverse/tree/bb9a567679da7cb95724a71be1c10eac1ade11e8/native) `native/` at `bb9a567` | Swift, SwiftPM only | `WKWebView` on a spawned loopback Starlette and uvicorn server; a tested lifecycle state machine with injectable process and probe factories; warm reuse; a build script with no Xcode project. Not notarized, no updater, fixed ports. |
| [WebKit MiniBrowser](https://github.com/WebKit/WebKit/blob/main/Tools/MiniBrowser/mac/WK2BrowserWindowController.m) | Objective-C | WebKit’s own AppKit browser: find bar, zoom, printing, `createWebViewWith`. It also uses private SPI; copy only public calls. |

* * *

## Size and Memory

Measured 2026-11-08 on macOS 26.5.2.

**Disk.** The example in this guideline is a 992KB universal bundle, with a 484KB arm64
executable (281KB stripped).
Sparkle adds about 2.8MB. A minimal arm64 Electron app installs at about 300MB.

**Memory**, from one `footprint` sample per process of a probe showing a trivial page
with one SSE stream in an offscreen window.
Treat it as a floor, not a benchmark:

| Process | WKWebView probe | Headless Chrome 152.0.7977.83, throwaway profile |
| --- | --- | --- |
| App or browser process | 22MB | 77MB |
| GPU | 12MB | 72MB |
| Network | 7MB | 24MB, plus a 20MB storage service |
| Content | 10, 19, and 7.6MB (current, previous origin, prewarmed) | 58, 29, 28, 29, and 25MB (5 renderers) |
| **Total** | **about 78MB** | **about 362MB** |

Headless Chrome is not Electron and spawned spare renderers, so the ratio is
approximate, and the gap narrows under real workloads
([tauri#5889](https://github.com/tauri-apps/tauri/issues/5889)). Your server’s own
memory is the same in every shell and often dominates.

* * *

## Swift 6 Concurrency Notes

- **Use main-actor default isolation** (`.defaultIsolation(MainActor.self)`, tools
  version 6.2) for app and supervision targets.
  With it, all the AppKit and WebKit code here compiles clean in Swift 6 mode.
- **Mark I/O types `nonisolated`.** Process, pipe, and dispatch-source code runs off the
  main actor; make those types `nonisolated` and `Sendable` (or `@unchecked Sendable`
  with a serial queue or a lock), and hop to the main actor for state changes.
- **WebKit completion handlers are `@MainActor`** in the macOS 26.5 SDK
  (`decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void`). Copy the
  SDK signatures exactly: a near-miss in a label or type produces a different
  Objective-C selector, WebKit never calls the method, and the compiler only warns that
  it “nearly matches” the requirement.
- **KVO closures are not isolated.** Wrap UI updates from `observe(\.title)` in
  `MainActor.assumeIsolated`.
- **Swift 5 language mode** remains available per target if a dependency fights strict
  checking.

* * *

## Best Practices

- [ ] Try an installed web app or a locally generated launcher before writing a shell.
- [ ] Build menus in code, including a full Edit menu, or copy and paste will not work.
- [ ] Use a persistent `WKWebsiteDataStore`, and set `isInspectable` deliberately.
- [ ] Keep the app origin in the window and send every other navigation to the default
  browser; compare scheme, host, and port.
- [ ] Implement `createWebViewWith` with the passed configuration, `WKDownload` with a
  save panel, and the JavaScript dialog delegates.
- [ ] Insert the find bar in the container’s `isFindBarVisible` setter.
- [ ] Deliver dropped file paths with `callAsyncJavaScript(arguments:)`, and validate
  them on the server.
- [ ] Use loopback HTTP, not a custom scheme, when the UI depends on cookies.
- [ ] Set `NSAllowsLocalNetworking`; never `NSAllowsArbitraryLoads`.
- [ ] Spawn the server with `posix_spawn` in its own process group with
  `POSIX_SPAWN_CLOEXEC_DEFAULT`.
- [ ] Follow [the shell–server contract](#the-shellserver-contract): loopback port 0,
  and one JSON ready line after listening.
- [ ] Pass the per-launch secret on stdin; shut down gracefully on stdin EOF or
  `SIGTERM`, with a deadline.
- [ ] Set the `HttpOnly` session cookie in the web view’s cookie store; use a single-use
  exchange code only for clients that cannot.
- [ ] Quit with `.terminateLater`: `SIGTERM`, bounded wait, `SIGKILL`, then reply.
- [ ] Restart with exponential backoff and show recent output on failure.
- [ ] Construct the child’s environment, including `PATH`, explicitly.
- [ ] Inject the process and probe factories, and unit-test the lifecycle.
- [ ] Build with SwiftPM and a script; select Xcode explicitly in CI.
- [ ] Sign inside out with `--options runtime --timestamp`, never `--deep`.
- [ ] Ship no entitlements unless a feature needs one.
- [ ] Notarize with an App Store Connect API key; staple the app and the DMG.
- [ ] Publish a DMG and a ZIP of the stapled app on GitHub Releases.
- [ ] Pin Sparkle to 2.9.6 or later, and require signed feeds.
- [ ] Refuse to self-update from a translocated or read-only location.
- [ ] Never set `LSFileQuarantineEnabled`, never enable App Sandbox.
- [ ] Ship usage strings for every protected location the server may touch, and never
  touch one before the user navigates there.
- [ ] Keep the bundle identifier and signing identity stable.
- [ ] Target macOS 15 and arm64; test on 15, 26, and 27 with a Developer ID build.

* * *

## Open Research Questions

1. **Does a folder grant from the shell’s `NSOpenPanel` cover the child server’s reads
   inside that folder?** The responsible-process model says yes; it is untested.

2. **Does a translocated launch report `volumeIsReadOnly`?** The check above relies on
   it.

3. **Does `NSTextFinder` match navigation work reliably with `WKWebView` on macOS 26 and
   27?** The find bar was verified; highlighting and Next/Previous were not, and older
   reports describe highlight offsets (WebKit bug 191702) and stale highlights.

4. **How many concurrent `EventSource` streams can several windows hold** against one
   loopback server before WebKit’s per-host HTTP/1.1 connection limit queues requests?
   Chromium’s limit is 6; WebKit’s number was not found.

5. **When will SwiftUI `WebPage` gain downloads, page zoom, and a new-window hook?**

6. **What is the exact nested-signing recipe for Sparkle under plain SwiftPM?** Sparkle
   documents only Xcode’s archive flow.

7. **Does the Application Firewall prompt for an ad hoc–signed server listening only on
   loopback?** Reports conflict.

* * *

## Recommendations

### When a Native Shell Is the Right Choice

- The app is macOS only, and a second operating system is not on the roadmap.
- The UI is already a web app served by a local server, in any language, or by a remote
  URL.
- You want the smallest signed app, no bundled engine, no JIT entitlement, and native
  menus, windows, drops, and URL handling.
- You can maintain about 1,000 lines of Swift, or have agents do it, and own Apple
  signing and notarization.

### When to Choose Something Else

- **More than one operating system:** Tauri
  (`tbd guidelines tauri-app-development-patterns`).
- **One engine everywhere, or Chromium-only APIs:** Electron
  (`tbd guidelines electron-app-development-patterns`).
- **A local, unsigned convenience window for a Python tool:** pywebview, or the
  zero-shell options above.
- **No need for app identity:** an installed web app costs nothing.

### If You Adopt It

Write the shell in AppKit with `WKWebView`, targeting macOS 15 and arm64. Spawn the
server in its own process group on loopback port 0, with the secret on stdin, stdin EOF
as the parent-death signal, the JSON ready line, and a session cookie set directly in
the web view’s cookie store.
Build with SwiftPM and a script, sign with Developer ID and the hardened runtime and no
entitlements, notarize in CI with an API key, and ship a stapled DMG and ZIP on GitHub
Releases with a Homebrew cask in your own tap.
Start with an in-app update notice; adopt Sparkle 2.9.6 or later, with signed feeds,
when shell releases become frequent.

* * *

## References

### Apple

- [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview) and
  [WKUIDelegate](https://developer.apple.com/documentation/webkit/wkuidelegate)
- [WKDownload](https://developer.apple.com/documentation/webkit/wkdownload)
- [Enabling the inspection of web content in apps](https://webkit.org/blog/13936/enabling-the-inspection-of-web-content-in-apps/)
- [NSAllowsLocalNetworking](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking)
- [LSFileQuarantineEnabled](https://developer.apple.com/documentation/bundleresources/information-property-list/lsfilequarantineenabled)
- [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
- [Creating distribution-signed code for the Mac](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac)
- [Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- [Disable Library Validation entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation)
- [TN3179: Understanding local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [On File System Permissions (forum thread 678819)](https://developer.apple.com/forums/thread/678819)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### Tools and Policy

- [Sparkle documentation](https://sparkle-project.org/documentation/) and
  [security advisories](https://github.com/sparkle-project/Sparkle/security-advisories)
- [actions/runner-images](https://github.com/actions/runner-images)
- [Installing an Apple certificate on macOS runners](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
- [Homebrew 5.0.0](https://brew.sh/2025/11/12/homebrew-5.0.0/),
  [Acceptable Casks](https://docs.brew.sh/Acceptable-Casks), and
  [Cask Cookbook](https://docs.brew.sh/Cask-Cookbook)
- [RFC 6265 §8.5, cookies and ports](https://www.rfc-editor.org/rfc/rfc6265#section-8.5)
- [swift-subprocess](https://github.com/swiftlang/swift-subprocess)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
