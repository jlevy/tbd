---
title: Desktop Python Runtime Patterns
description: How a desktop app with a Python backend or Python plugins ships or provisions its runtime with uv under any shell (Electron, Tauri, a native Swift shell, Electrobun)—freezing versus a runtime-extensible environment, bundle and first-run layouts, isolating an app-owned uv, hash-pinned base environments, environment lifecycle and repair, user-installed plugins, sharing with a CLI install, and macOS signing, quarantine, and library validation. Load when designing, packaging, or debugging Python inside a desktop app.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: desktop
---
# Desktop Python Runtime Patterns

**Last Updated:** 2026-11-08

## Executive Summary

This guideline covers how a desktop app gets a working Python: a backend server or
worker written in Python, Python plugins that users install, or both.
It applies to every shell that spawns a child process: Electron, Tauri, a native Swift
or AppKit shell, and Electrobun.
macOS is covered in depth because its signing rules shape the design; Windows and Linux
facts are included where they exist and are marked.

The recommended default for an app whose users install Python packages: **bundle a
signed, pinned `uv` binary and a hash-pinned `pylock.toml`; on first run, install a
pinned python-build-standalone interpreter and a real virtual environment into per-user
app data, and install plugins into that environment with the same uv.** Optionally
bundle the interpreter archive as a `file://` mirror so the first run works offline.

Five claims are worth stating up front because they contradict common advice:

- **Runtime plugin installs rule out freezing.** A frozen app has no installer and no
  writable `site-packages`. Once you ship a real interpreter and uv for plugins anyway,
  freezing the base adds a second, incompatible Python.

- **`uv tool install` does not verify hashes,** even when given a constraints file or
  requirements file full of them.
  Hash-verified installs need `uv venv` plus
  `uv pip sync --require-hashes --no-build pylock.toml`.

- **`--no-config` does not isolate uv from environment variables.** Configuration flags
  cannot disable `UV_*` variables, which outrank config files.
  Isolation needs both the flag and a scrubbed child environment.

- **`disable-library-validation` belongs only on an interpreter that is signed with the
  hardened runtime and loads ad-hoc-signed or other-team code**, such as wheels
  installed at runtime.
  Library validation applies per process, from that process’s own signature, so a
  hardened shell that spawns uv’s ad-hoc, unhardened Python needs no entitlement, and
  neither does a bundled interpreter whose every library you signed with your own Team
  ID. This was measured with ad-hoc signatures; the same test under a Developer
  ID-signed, notarized shell is still an [open question](#open-research-questions).

- **The cool-off belongs at release time.** The base environment installs from exact
  pins and hashes, so nothing resolves on a user’s machine except plugins.

**Related:**

- [uv documentation](https://docs.astral.sh/uv/)
- [python-build-standalone](https://github.com/astral-sh/python-build-standalone)
- [Companion: Electron App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electron-app-development-patterns.md)
- [Companion: Tauri App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/tauri-app-development-patterns.md)
- [Companion: macOS WebView Shell Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md)
- [Companion: Electrobun App Development Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electrobun-app-development-patterns.md)
- [Companion: Python Modern Guidelines](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/python-modern-guidelines.md)
- [Companion: Python CLI Patterns](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/python-cli-patterns.md)
- [Companion: Supply-Chain Hardening](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)

* * *

## Updating This Document

uv ships two to three releases a week (33 releases from 0.12.0 on 2026-07-28 to 0.13.7
on 2026-11-03), and python-build-standalone ships roughly weekly around CPython patch
releases.
The version pins here go stale within weeks; the mechanisms change more slowly,
but several open uv issues listed below would change specific recommendations.

### Last Researched Versions

Observed 2026-11-08 through the GitHub Releases API, the PyPI JSON API, and the
crates.io API. The 14-day cool-off in
[Supply-Chain Hardening](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)
means a release is eligible only if its UTC publish date is on or before 2026-10-25;
where the newest release is younger, the table gives the aged release as the pin.

| Tool | Pin | Newest (published) | Check For Updates |
| --- | --- | --- | --- |
| **uv** | 0.13.5 (2026-10-22) | 0.13.7 (2026-11-03); 0.13.6 (2026-10-27) also too recent | [GitHub releases](https://github.com/astral-sh/uv/releases), [changelog](https://github.com/astral-sh/uv/blob/main/CHANGELOG.md). Never pin below **0.12.12** (2026-09-09), the first release whose macOS executables are Developer ID signed and notarized and whose Windows executables are Authenticode signed. 0.13.5 rejects compromised eMudhra intermediates (`rustls-webpki` 0.103.16) and embeds python-build-standalone 20261021 download metadata. 0.13.0 made 3.15 the default Python and changed cache formats. |
| **python-build-standalone** (PBS) | 20261021 (2026-10-21) | 20261026 (2026-10-26) | [GitHub releases](https://github.com/astral-sh/python-build-standalone/releases). Pinning uv pins this too: each uv release embeds the URLs and SHA-256 digests of the builds it installs. No `universal2` macOS builds exist; macOS ships `aarch64-apple-darwin` and `x86_64-apple-darwin` only. |
| **CPython** | 3.14.9 or 3.13.17 (both PBS 20261021) | 3.15.1 is also built | [python.org downloads](https://www.python.org/downloads/). Choose the minor by wheel availability, not by recency: the newest PyYAML (6.0.3) publishes no `cp315` wheels, so a 3.15 lock installed with `--no-build` fails on it. |
| **PyInstaller** | 6.22.3 (2026-09-12) | 6.22.3 | [changelog](https://pyinstaller.org/en/stable/CHANGES.html). Python 3.8–3.15. |
| **Nuitka** | 4.3.1 (2026-10-17) | 4.3.5 (2026-11-08); 4.3.4 and 4.3.3 also too recent | [PyPI](https://pypi.org/project/Nuitka/). Releases every few days; AGPLv3 with a commercial edition. |
| **py2app** | 0.28.10 (2026-02-13) | 0.28.10 | [GitHub](https://github.com/ronaldoussoren/py2app). The 2.0 rewrite on `main` is unreleased. |
| **Briefcase** | 0.4.6 (2026-10-13) | 0.4.7 (2026-10-27) | [release notes](https://briefcase.beeware.org/en/stable/about/releases/). 0.4.7 fixes [GHSA-j2qc-j92x-qqhj](https://github.com/beeware/briefcase/security/advisories/GHSA-j2qc-j92x-qqhj), a Windows-only cache-filename path traversal; macOS and Linux builds on 0.4.6 are not exposed. |
| **PyApp** | 0.30.0 (2026-10-12) | 0.31.0 (2026-10-27) | [crates.io](https://crates.io/crates/pyapp). 0.31.0 updates TLS trust dependencies after a certificate-authority compromise for `--locked` builds. The PyPI project named `pyapp` is unrelated. |
| **PyOxidizer** | Do not use | 0.24.0 (2022-12-30) | [GitHub](https://github.com/indygreg/PyOxidizer). Last commit 2024-11-03; Anki left it as “abandoned” ([anki#3081](https://github.com/ankitects/anki/issues/3081)). |

### Reminders When Updating

1. **Re-run the experiments** in [Appendix A](#appendix-a-re-verification-commands) with
   the uv you intend to pin.
   Most recommendations here rest on a measured behavior that a uv release could change.

2. **Recheck the open uv work** that would change a recommendation:
   [#14893](https://github.com/astral-sh/uv/issues/14893) and
   [#14843](https://github.com/astral-sh/uv/issues/14843) (`install_name_tool`),
   [#22220](https://github.com/astral-sh/uv/pull/22220) (native Mach-O editing),
   [#16726](https://github.com/astral-sh/uv/issues/16726) (SIGKILL of managed Python),
   [#17371](https://github.com/astral-sh/uv/issues/17371) and
   [#18596](https://github.com/astral-sh/uv/pull/18596) (first-import scanning and
   hardlinks), [#21962](https://github.com/astral-sh/uv/pull/21962),
   [#22067](https://github.com/astral-sh/uv/pull/22067), and
   [#22595](https://github.com/astral-sh/uv/pull/22595) (hash-verified tool installs
   from packaged locks), and [#5802](https://github.com/astral-sh/uv/issues/5802)
   (`uv bundle`).

3. **Recheck Briefcase** [#419](https://github.com/beeware/briefcase/issues/419) (pip in
   packaged apps, open since 2020-06-10) and the release status of `allow_subprocesses`
   ([#3078](https://github.com/beeware/briefcase/issues/3078), merged to `main`, not in
   0.4.7). Either would change the freezing verdict.

4. **Honor the 14-day cool-off** when bumping any pin, with the documented security
   exception.

5. **Update the code examples**, not just the table: version strings appear in the
   bundle layout, the release workflow, and the `uv.toml` examples.

* * *

## 1. Decide What Kind of Python the App Needs

Answer one question first: **will users install Python packages at runtime?** Everything
else follows from it.

|  | Fixed backend | Runtime-extensible app |
| --- | --- | --- |
| Example | A local server whose dependencies are known at build time | An app whose plugins are Python packages, discovered through entry points |
| Who installs packages | The release pipeline | The release pipeline for the base, then the user |
| Where the environment lives | Can live inside the signed bundle | Must live outside it, in per-user app data |
| Freezing (PyInstaller, Nuitka, Briefcase) | Works | Works against you |
| Recommended layout | Frozen app, or a PBS tree with dependencies installed into it at build time | [Layout A or A′](#2-layouts-and-their-trade-offs) |

### Why Freezing Complicates Runtime Plugins

A frozen app typically loads its bundled modules first.
Some freezers, including
[PyInstaller](https://pyinstaller.org/en/stable/advanced-topics.html#python-imports-in-a-bundled-app),
also support external modules on the filesystem.
To accept ordinary Python packages with dependencies, entry points, and native
extensions, the app still needs:

- An installer at runtime.
  Briefcase deliberately removes pip from packaged apps
  ([briefcase#419](https://github.com/beeware/briefcase/issues/419), open since
  2020-06-10). Until the unreleased `allow_subprocesses` option
  ([briefcase#3078](https://github.com/beeware/briefcase/issues/3078)), `sys.executable`
  in a Briefcase app is the app itself, so `subprocess.run([sys.executable, ...])`
  relaunches the app.

- A writable location on `sys.path`. Writing into a signed bundle breaks its seal on
  macOS and collides with every updater’s atomic replace on every platform.
  A sidecar directory works only if every plugin’s native extensions match the frozen
  interpreter’s exact ABI.

- One dependency resolution.
  A sidecar directory resolves separately from the frozen set, so a plugin can bring a
  second, conflicting copy of a base dependency.

External packages can load into the frozen interpreter.
Providing a writable environment with a normal installer is usually simpler when you
need general package installation, dependency resolution, or subprocesses that invoke
Python.

The surveyed apps generally split along this line.
Apps whose plugins are pip-installable packages (Datasette Desktop, Open WebUI Desktop,
ComfyUI Desktop, Mu, JupyterLab Desktop, Spyder, napari) keep a writable environment
outside the bundle. Apps whose plugins are not packages freeze: calibre plugins are zip
files of Python code, Anki add-ons are folders, and Kolibri exposes no plugin installs.
Anki’s 2026 move back to a frozen build ([§10](#10-what-shipping-apps-do)) was possible
because its add-ons never needed a writable `site-packages`.

* * *

## 2. Layouts and Their Trade-Offs

### Frozen Packagers: Current Status

These remain the right tools for a fixed backend.
For a runtime-extensible app, use them only as a signing and packaging step around a
bundle you assemble yourself.

| Tool | Status (2026-11-08) | Runtime plugin installs | Notes |
| --- | --- | --- | --- |
| **PyInstaller** 6.22.3 | Maintained, Python 3.8–3.15 | No installer in the frozen app; entry points need `--copy-metadata` | Ad-hoc signs by default; with `--codesign-identity` signs binaries and enables the hardened runtime ([feature notes](https://pyinstaller.org/en/stable/feature-notes.html)). 6.16.0 added python-build-standalone POSIX support. |
| **Nuitka** 4.3.x | Maintained, very fast cadence | Same as PyInstaller, with long compiles | `--mode=app`, `--macos-sign-identity`, `--macos-sign-notarization` (sets the hardened runtime; submission is yours). AGPLv3 per PyPI. |
| **py2app** 0.28.10 | Maintenance; 2.0 rewrite unreleased | Same; standalone builds zip `site-packages` | Tested against python.org framework builds; the 2.0 docs’ code-signing section reads “intentionally left blank”. |
| **Briefcase** 0.4.6 | Maintained | Not supported (#419) | Signs every Mach-O with `--options runtime` and notarizes by default. Default macOS entitlements include `disable-library-validation` and `allow-unsigned-executable-memory`. 0.4.5 added `env_manager = "uv"` for the *build* environment. Its external-app mode signs, notarizes, and packages an `.app` built by another tool. |
| **PyApp** 0.30.0 | Maintained | Yes, through `<exe> self pip`, but the install path embeds the app version, so every update starts a fresh environment without the user’s plugins | Bootstraps PBS and a venv on first run, optionally with uv. No hash check of the downloaded Python or uv; uv defaults to the latest release unless `PYAPP_UV_VERSION` is set. On Unix it `exec`s or spawns an interpreter outside any bundle, so a GUI process loses the app’s identity. Its design idea, materializing a writable uv environment on first run, is the one this guideline uses. |
| **PyOxidizer** 0.24.0 | Abandoned | — | Do not start here. |

### The Four uv Layouts

All four keep the environment outside the signed bundle.
They differ in where the interpreter comes from.

|  | **A**: uv only | **A′**: uv plus a PBS archive as an offline mirror | **B**: uv plus a signed PBS tree | **C**: the user’s own uv |
| --- | --- | --- | --- | --- |
| Bundle adds | uv (14.4 MB compressed, 27.9 MB unpacked, arm64) | uv plus a 25–27 MB archive per architecture | uv plus a 65 MB tree per architecture | Nothing |
| First-run network | Python (25 MB) and wheels | Wheels only | Wheels only | Same as A unless the user’s cache is warm |
| Offline first run | Fails | Works if a wheelhouse is also bundled; otherwise wheels still need the network | Same as A′ | Fails |
| Python Mach-O signed by you | None | None | Every executable and `.dylib` in the tree | None |
| `disable-library-validation` | Never | Never | On the bundled `python3.x` | Never |
| Survives the bundle moving | Yes | Yes | No: every venv built on the tree breaks | Yes |
| Main failure modes | No network, TLS interception, ad-hoc code killed by MDM or EDR | Notarization of a nested archive is untested | Bundle moves, App Translocation, larger signing and notarization surface | Unknown uv version and config; writes into the user’s directories |
| Use when | Online-first app, smallest bundle | Default when offline first run or managed networks matter | Fleets that kill ad-hoc executables | Developer or power-user mode only |

The numbers in this section were measured on 2026-11-08 on macOS 26.5.2 (25F84), Apple
silicon, with uv 0.13.5 and CPython 3.13.17 from PBS 20261021, with every uv directory
redirected and `--no-config` set.
The test environment was a 22-package lock (FastAPI, `uvicorn[standard]`, Jinja2 and
their dependencies) with 8 native extension modules and 19 MB of installed files.
[Appendix A](#appendix-a-re-verification-commands) reproduces them.

### Layout A: Bundle uv Only

Every command below runs through the single isolated invocation described in
[§3](#3-isolating-an-app-owned-uv); `uvc` stands for
`uv --no-config --config-file <bundle>/uv.toml` with the scrubbed environment.
`ENV` is a fresh environment path under the runtime root
([Environment Lifecycle](#5-the-two-layer-artifact-and-environment-lifecycle)).

```bash
uvc python install --no-bin 3.14.9
uvc venv --no-project --managed-python --python 3.14.9 "$ENV"
uvc pip sync --python "$ENV/bin/python" \
    --require-hashes --no-build "$BUNDLE/python-runtime/pylock.toml"
"$ENV/bin/myapp-server" --self-test   # smoke test before switching
```

- **First-run cost (measured):** Python 3.13.17 download and install 2.4–6.6 s on a fast
  connection (25.3 MB); `uv venv` 0.13 s; `pip sync` of the 22-package lock from a cold
  cache 1.2 s; first import of the 8 native extensions 2.0–2.4 s
  ([§8](#first-import-security-scan-and-link-mode)). At 20 Mbit/s the Python download
  alone takes about 10 s.
- **Hosts contacted:** `releases.astral.sh` for Python (falling back to GitHub release
  assets) and `files.pythonhosted.org` for wheels.
  A pylock install fetches the wheel URLs recorded in the lock, so the index setting
  does not matter for the base set.
- **Offline:** the first run fails.
  Afterwards, `pip sync --offline` rebuilds from the cache (0.42 s for the test set with
  `UV_LINK_MODE=hardlink`).
- **Signing:** nothing Python-related is signed by you, and nothing needs an
  entitlement. The interpreter keeps its ad-hoc linker signature, which carries no
  hardened runtime, so it loads any wheel’s extension modules (measured with ad-hoc
  signatures; [§8](#library-validation-is-per-process)).

### Layout A′: Bundle the PBS Archive as an Offline Mirror

Ship the `install_only_stripped` archive that uv would download, as data, in a directory
laid out like the release:

```
python-runtime/python-mirror/20261021/cpython-3.14.9+20261021-aarch64-apple-darwin-install_only_stripped.tar.gz
```

```bash
uvc python install --no-bin --mirror "file://$BUNDLE/python-runtime/python-mirror" 3.14.9
```

- **Measured:** 0.85 s with no network, verified against the SHA-256 compiled into uv.
  A copy of the archive with one byte appended was rejected with the expected and
  computed digests.
- **A user-configured mirror is used exclusively**, with no fallback to the network
  (`download_urls_with_astral_mirror` in `crates/uv-python-managed/src/downloads.rs`),
  so `--offline` adds nothing here.
- **Do not set `UV_PYTHON_CACHE_DIR` together with `--offline`.** With that variable
  set, uv looks for the archive only in the Python cache directory and fails with “An
  offline Python installation was requested, but … is missing” even though the `file://`
  mirror holds it (measured; same file, `OfflinePythonMissing`).
- **Result:** identical to layout A. The interpreter lives in app data with an ad-hoc
  signature, with no coupling to the bundle path and no library-validation entitlement.
- **Offline wheels:** a wheelhouse alone cannot replace remote URLs recorded in a
  pylock, even with `--find-links`
  ([uv’s pylock resolution](https://github.com/astral-sh/uv/blob/0.13.5/crates/uv-pip-commands/src/sync.rs#L399-L433)).
  For a fully offline first run, bundle the wheels with a pylock that names their hashed
  relative paths, or supply a verified cache seeded for the exact lock and uv version.
  Test the signed release with networking disabled and no preexisting user cache.
  Notarization of the nested archives remains untested
  ([Open Research Questions](#open-research-questions)).
- **License:** bundling PBS redistributes CPython and its bundled libraries (OpenSSL,
  Tcl/Tk, ncurses, SQLite, and others); ship their notices from the PBS repository’s
  `LICENSE.*` files. Layout A does not redistribute PBS.

### Layout B: Sign a PBS Tree Inside the Bundle

```bash
uvc venv --no-project --python "$BUNDLE/python/bin/python3.14" "$ENV"
uvc pip sync --python "$ENV/bin/python" --require-hashes --no-build \
    "$BUNDLE/python-runtime/pylock.toml"
```

- **Every Mach-O in the tree must be signed** with your Developer ID, the hardened
  runtime, and a secure timestamp, because notarization requires it of every executable
  ([Apple](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)).
  The count is small: an installed 3.13.17 `install_only_stripped` tree has 1,840 files,
  of which 10 are Mach-O (the interpreter and nine libraries), because PBS builds most
  extension modules into the interpreter (measured).
- **The hardened interpreter then rejects ad-hoc wheel extensions.** Measured with a
  copy of the tree re-signed `-o runtime`: importing `pydantic_core` failed with
  “mapping process and mapped file (non-platform) have different Team IDs”.
  Adding `com.apple.security.cs.disable-library-validation` to the interpreter alone
  made the same imports succeed.
  Apple warns that “Gatekeeper runs extra security checks on programs that have it
  disabled”
  ([entitlement reference](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation)).
- **The venv dies when the bundle path changes.** `pyvenv.cfg` `home` and `bin/python`
  are absolute paths into the bundle.
  Moving the measured bundle made the venv’s interpreter “No such file or directory”,
  while the relocatable PBS tree itself still ran.
  Renames, `~/Applications` versus `/Applications`, side-by-side versions, and App
  Translocation all change the path.
  Compare `pyvenv.cfg` `home` with the live bundle path on every launch and rebuild the
  environment when they differ (Datasette Desktop had to add this;
  [datasette-app#89](https://github.com/simonw/datasette-app/issues/89)).
- **Never let Python write into the bundle.** Set `PYTHONDONTWRITEBYTECODE=1` or
  `PYTHONPYCACHEPREFIX` for any process that runs the bundled interpreter directly; a
  `__pycache__` written after signing breaks the sealed-resources hash.
- **Fixed backends without runtime plugins** can skip the venv entirely: install the
  locked dependencies into the tree at build time and sign everything with your Team ID.
  Every extension is then signed by the same team as the interpreter, which library
  validation permits, so no entitlement is needed.
  The
  [Electron guideline’s](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/electron-app-development-patterns.md)
  sidecar appendix shows that build.

### Layout C: Use the User’s Own uv

```bash
"$USER_UV" tool run --managed-python --python 3.14 --from 'myapp-server==2.3.0' myapp-server serve
```

- **Discovery:** a GUI-launched app does not get the login shell’s `PATH`. Probe
  `~/.local/bin/uv`, `/opt/homebrew/bin/uv`, `/usr/local/bin/uv`, and `~/.cargo/bin/uv`,
  as Positron does because the official installer “only updates shell rc files”
  ([positron `uv.ts`](https://github.com/posit-dev/positron/blob/5d355d4cbe7e46087286c0d17f277c0d82fd2593/extensions/positron-python/src/client/pythonEnvironments/common/environmentManagers/uv.ts#L58)).
- **Unknown uv:** it may predate signing, relative `exclude-newer` spans, or pylock
  support. The user’s configuration applies unless you pass `--no-config`, which silently
  discards settings the user chose.
- **No hash pinning, and disposable:** `uvx` environments live in the cache and
  `uv cache clean` deletes them
  ([tools docs](https://docs.astral.sh/uv/concepts/tools/)).
- **Use it** as an opt-in developer mode, never as the default.

### Where uv Goes in Each Shell

| Shell | Placement | Who signs it | Entitlements to watch |
| --- | --- | --- | --- |
| **Electron** (electron-builder 26) | `extraFiles` to `Contents/Helpers/uv`, or `extraResources` to `Contents/Resources`; data files through `extraResources` | `@electron/osx-sign` signs every file its `isbinaryfile` heuristic flags, inside-out (`src/util.ts`, read 2026-11-02). That includes non-Mach-O binaries such as a `.tar.gz`, so add the PBS archive and any wheelhouse to `mac.signIgnore`. | v26’s default template grants `allow-jit`, `allow-unsigned-executable-memory`, and `disable-library-validation` to everything when you supply no file. Supply your own. |
| **Tauri 2** | `bundle.externalBin` (`binaries/uv-aarch64-apple-darwin`, copied to `Contents/MacOS/uv` without the target suffix); data through `bundle.resources` | The bundler signs the main binary, every `externalBin`, and `macOS.frameworks`, but not `bundle.resources` or `macOS.files` (`tauri-bundler` 2.10.4 source). A PBS tree in resources therefore keeps unsigned Mach-O files, which notarization does not accept; pre-sign it yourself for layout B. | One entitlements file for every target; the `sidecarEntitlements` PR ([tauri#16212](https://github.com/tauri-apps/tauri/pull/16212)) closed unmerged on 2026-10-05. |
| **Native Swift shell** | `Contents/Helpers/uv` or `Contents/MacOS/uv`; data in `Contents/Resources` | You: `codesign -f -s "Developer ID Application: …" -o runtime --timestamp` on uv, then on the app, without `--deep` ([Apple](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac)) | None for uv. |
| **Electrobun** | Anywhere in the bundle; spawn it from the Bun main process | Hutch signs every Mach-O deepest-first, always with the hardened runtime | Default entitlements (`allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation`) apply to every executable Mach-O from one file. |

Per-user locations for the mutable layer:

| Platform | Environment, interpreter, plugin record | uv cache |
| --- | --- | --- |
| macOS | `~/Library/Application Support/<app-id>/python-runtime` | `~/Library/Caches/<app-id>/uv` |
| Windows | `%LOCALAPPDATA%\<App>\python-runtime` | `%LOCALAPPDATA%\<App>\cache\uv` |
| Linux | `$XDG_DATA_HOME/<app>/python-runtime` (default `~/.local/share`) | `$XDG_CACHE_HOME/<app>/uv` (default `~/.cache`) |

Keep the cache on the same volume as the environments: uv’s storage reference states
that “the cache directory needs to be on the same filesystem as virtual environments”
for performance, and hardlink mode requires it.
On Windows, override uv’s default persistent directory (`%APPDATA%\uv\data`, the roaming
profile) so a 65 MB interpreter does not roam with the user’s profile.

* * *

## 3. Isolating an App-Owned uv

An app’s uv must behave identically on every user’s machine.
Every isolation control below closed a leak that was either reproduced on 2026-11-08 or
reported against a shipping app.

### The One-Function Rule

**Every uv invocation in the app goes through one function** that sets the flags, the
working directory, and the environment.
A single call site that forgets `--no-config` or the scrubbed environment brings back
the user’s configuration, their `.python-version`, or an inherited `UV_*` variable.
The same function serializes uv operations: uv takes file locks (`UV_LOCK_TIMEOUT`,
default 300 s), and a queued second operation would otherwise sit silently behind the
first.

### Flags, Variables, and the Leak Each Closes

| Control | Value | The leak it closes |
| --- | --- | --- |
| `--no-config` | always | The user’s `~/.config/uv/uv.toml` applies otherwise. Measured: a user file with `exclude-newer = "7 days"` and a custom `index-url` showed up in `--show-settings`; `--no-config` cleared both. Legacy ComfyUI Desktop omitted it, and a user’s `exclude-newer` made installs unsatisfiable ([desktop#1722](https://github.com/Comfy-Org/desktop/issues/1722)). |
| `--config-file <bundle>/uv.toml` | always, with `--no-config` | Applies the app’s own settings. Alone it is not enough: `--config-file` without `--no-config` still honored a `.python-version` of 3.9 in the working directory (measured); with both, the file was ignored. |
| Scrubbed environment | always | No flag disables environment variables, and they outrank config files. Measured: `UV_INDEX_URL=https://env.invalid/simple` appeared in resolved settings despite `--no-config --config-file`. Anki’s launcher strips every `UV_*` variable, `VIRTUAL_ENV`, and `SSLKEYLOGFILE` ([main.rs](https://github.com/ankitects/anki/blob/2fcaa560238e4e9613a9f52d41a83036b93ee86a/qt/launcher/src/main.rs)). |
| `UV_MANAGED_PYTHON=1` and an explicit `--python <patch>` | always | Without it, uv built a venv on Xcode’s `/Applications/Xcode.app/.../python3` 3.9.6 when no managed Python existed (measured). It conflicts with `UV_PYTHON_PREFERENCE`, so set only one: “cannot be used with `--python-preference`” (measured). |
| `UV_PYTHON_INSTALL_DIR` | app data | Legacy ComfyUI Desktop shared uv’s global `~/.local/share/uv/python` and hit “Permission denied” ([desktop#1463](https://github.com/Comfy-Org/desktop/issues/1463)). |
| `--no-bin` on `uv python install`, plus `UV_PYTHON_BIN_DIR` | always | By default `uv python install` links `python3.x` into `~/.local/bin` ([docs](https://docs.astral.sh/uv/concepts/python-versions/#installing-python-executables)); measured with a redirected `HOME`. An app must not put executables on the user’s `PATH`. |
| `UV_CACHE_DIR` | app cache | Keeps the app’s cache from mixing with, or being cleaned by, the user’s uv. uv 0.13 notes that “multiple versions of uv can still safely share the same cache directory”; isolation is still simpler to reason about. |
| `UV_TOOL_DIR`, `UV_TOOL_BIN_DIR`, `UV_CREDENTIALS_DIR`, `UV_PYTHON_BIN_DIR` | app data | Point every remaining uv directory inside the app’s root, even ones you do not expect to use, so a future command cannot write into the user’s home. |
| `python-downloads = "manual"` (in `uv.toml`) | always | Only the explicit `uv python install` step may fetch Python; no other command downloads one implicitly. |
| `no-build = true` (in `uv.toml`) | recommended | Disallows builds from ordinary source distributions. Use it during release resolution and installation so an sdist-only dependency fails before shipping. Reject editable and other source inputs at the app boundary; the flag does not block editable builds. |
| `cwd` = the app’s runtime root, and `uv venv --no-project` | always | No stray `pyproject.toml`, `uv.toml`, or `.python-version` above the working directory is discovered. |
| `UV_NO_PROGRESS=1`, `NO_COLOR=1` | always | stderr carries plain lines the progress UI can parse. |
| `UV_LINK_MODE=hardlink` | macOS | Cuts repeated first-import scanning ([§8](#first-import-security-scan-and-link-mode)). |
| `UV_SYSTEM_CERTS=1` | user toggle | uv uses its bundled Mozilla roots by default; TLS-intercepting corporate networks need the platform store ([§8](#corporate-tls)). |
| A no-op `install_name_tool` first on `PATH` | macOS | Prevents the Command Line Tools prompt and a shadowed conda `install_name_tool` ([§8](#the-install_name_tool-prompt)). |

### The Spawn Environment

Start from an empty environment and add only what you choose:

- **Pass through:** `HOME`, `USER`, `LOGNAME`, `TMPDIR`, `LANG`, `LC_*`, and the network
  settings you choose to honor (`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`,
  `SSL_CERT_FILE`, `SSL_CERT_DIR`).
- **On Windows, also pass** `SystemRoot`, `USERPROFILE`, `LOCALAPPDATA`, `APPDATA`,
  `TEMP`, `TMP`, and `PATHEXT`. Python’s
  [subprocess documentation](https://docs.python.org/3/library/subprocess.html#popen-constructor)
  states that on Windows, “in order to run a side-by-side assembly the specified env
  must include a valid `%SystemRoot%`”.
- **Set explicitly:** a minimal `PATH` and every `UV_*` variable in the table.
- **Never pass:** any inherited `UV_*`, `PYTHON*`, `PIP_*`, `VIRTUAL_ENV`, `CONDA_*`, or
  `SSLKEYLOGFILE`.

A Finder-launched app mostly receives launchd’s environment, but the same app launched
with `open -a` from a terminal, or by running its binary directly, inherits the
terminal’s environment.
Test both.

uv’s HTTP client is built with the `system-proxy` feature, so macOS System Settings
proxies should apply to a GUI-spawned uv (from uv’s `Cargo.toml`; not tested).

### Reference Implementation

This TypeScript serves an Electron or Electrobun main process; a Tauri shell writes the
same thing with `std::process::Command::env_clear()`, and a Swift shell with
`posix_spawn` and an explicit `envp`.

```ts
import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

export interface RuntimePaths {
  uv: string; // signed uv inside the bundle
  uvToml: string; // the bundled uv.toml
  stubBin: string; // bundle directory holding the no-op install_name_tool (macOS)
  root: string; // per-user runtime root in app data
  pythonRoot: string; // app-data directory keyed by the expected interpreter artifact
  cache: string; // per-user uv cache, on the same volume as root
}

// Passed through from the shell's environment; everything else is dropped.
const PASS_THROUGH = [
  'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'SystemRoot', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'TEMP', 'TMP', 'PATHEXT',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
];

function uvEnv(p: RuntimePaths, systemCerts: boolean): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of PASS_THROUGH) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  env.PATH =
    process.platform === 'darwin'
      ? [p.stubBin, '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':')
      : process.platform === 'win32'
        ? `${env.SystemRoot}\\System32;${env.SystemRoot}`
        : '/usr/bin:/bin';
  Object.assign(env, {
    UV_CACHE_DIR: p.cache,
    UV_PYTHON_INSTALL_DIR: p.pythonRoot,
    UV_PYTHON_BIN_DIR: path.join(p.root, 'python-bin'),
    UV_TOOL_DIR: path.join(p.root, 'tools'),
    UV_TOOL_BIN_DIR: path.join(p.root, 'tools-bin'),
    UV_CREDENTIALS_DIR: path.join(p.root, 'credentials'),
    UV_MANAGED_PYTHON: '1',
    UV_NO_PROGRESS: '1',
    UV_LINK_MODE: 'hardlink',
    NO_COLOR: '1',
  });
  if (systemCerts) env.UV_SYSTEM_CERTS = '1';
  return env;
}

let queue: Promise<unknown> = Promise.resolve();

/** The only function in the app that starts uv. Runs one uv operation at a time. */
export function runUv(
  p: RuntimePaths,
  args: string[],
  onLine: (line: string) => void,
  systemCerts = false,
): Promise<void> {
  const run = queue.then(
    () =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(p.uv, ['--no-config', '--config-file', p.uvToml, ...args], {
          cwd: p.root,
          env: uvEnv(p, systemCerts),
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        for (const stream of [child.stdout, child.stderr]) {
          readline.createInterface({ input: stream }).on('line', onLine); // progress UI and log
        }
        child.on('error', reject);
        child.on('close', (code, signal) =>
          code === 0 ? resolve() : reject(new Error(`uv ${args[0]}: ${signal ?? `exit ${code}`}`)),
        );
      }),
  );
  queue = run.catch(() => undefined);
  return run;
}
```

Launch the Python server itself with the same discipline: an explicit environment
without `PYTHONPATH`, `PYTHONHOME`, `PYTHONSTARTUP`, `PYTHONUSERBASE`, or `VIRTUAL_ENV`,
plus `PYTHONNOUSERSITE=1`, so a user’s `~/.local/lib/python3.x/site-packages` never
loads into the app.

* * *

## 4. Pinning Exactly What Was Tested

The goal is that the file CI tested is the file the user installs from, byte for byte,
with every artifact checked against a hash.

### What Verifies Hashes

Measured with uv 0.13.5 by replacing one wheel’s SHA-256 with zeros.

| Mechanism | Hashes enforced? | Measured behavior |
| --- | --- | --- |
| `uv tool install -c constraints.txt` with `--hash` lines | **No** | Installed `click` despite a zeroed hash. Source: `HashStrategy::default()` unless a tool lock exists (`crates/uv-tool-commands/src/install.rs`). |
| `uv tool install --with-requirements req.txt` with hashes | **No** | Installed the PyYAML binary wheel whose real hash was absent from the file. |
| `uv pip sync pylock.toml` | **Yes, by default** | “Hash mismatch … Expected … Computed”, even without `--require-hashes`. |
| `uv pip sync --require-hashes requirements.txt` | Yes, but **any listed hash may match** | With the wheel hash corrupted and the sdist hash intact, uv silently built PyYAML from the sdist with setuptools. The result lacked the libyaml C extension (`yaml.__with_libyaml__` was `False`): a different build from the one tested. |
| The same, plus `--no-build` | Yes | Failed with “Hash mismatch”. |
| `uv sync --frozen` (project plus `uv.lock`) | Yes | Needs a project directory and `UV_PROJECT_ENVIRONMENT`. |
| `uv tool install` with preview `tool-install-locks` | Yes, against a lock uv writes beside the tool on first install | Not a release-supplied lock. Hash-verified installs from a lock packaged in the wheel are open draft PRs ([#21962](https://github.com/astral-sh/uv/pull/21962), [#22067](https://github.com/astral-sh/uv/pull/22067), [#22595](https://github.com/astral-sh/uv/pull/22595)). |

So the base environment is built with `uv venv` plus
`uv pip sync --require-hashes --no-build pylock.toml`. A pylock file must be named
`pylock.toml` or `pylock.<name>.toml`; passing it positionally to `pip sync` or
`pip install` is stable, while the separate `--pylock` flag is a preview.

### Why `--no-build` Matters

`--require-hashes` guarantees that *some* listed artifact matched, not that the artifact
you tested was installed.
A lockfile records hashes for the sdist and every wheel, so a damaged or missing wheel
quietly turns into a local build, which needs a build backend, may need a compiler, runs
arbitrary build code on the user’s machine, and can produce a different artifact (the
PyYAML case above).
`--no-build` makes the only acceptable outcome the wheel you shipped.
Putting `no-build = true` in the app’s `uv.toml` applies the same rule to ordinary
plugin packages. Editable requirements are an exception
([uv’s editable test](https://github.com/astral-sh/uv/blob/0.13.5/crates/uv/tests/pip_install/pip_install.rs#L2728-L2749)).
If the app requires wheel-only plugins, accept registry package names and approved
version constraints rather than arbitrary requirements files or command-line options.

### The Release-Time Lock

Keep a tiny runtime project in the app repository.
It names the backend and nothing else; uv resolves the rest.

```toml
# runtime/pyproject.toml (no [build-system]: a virtual project, never built)
[project]
name = "myapp-runtime"
version = "0"
requires-python = "==3.14.*"
dependencies = ["myapp-server==2.3.0"]
```

```toml
# runtime/uv.toml: used at release time and bundled as the app's only uv config
python-downloads = "manual"
no-build = true
exclude-newer = "14 days"

[exclude-newer-package]
myapp-server = false   # first-party, released by the same pipeline
```

Commit `runtime/uv.lock`, so every change to the base set is a reviewable diff.
`uv lock` records the span (`exclude-newer-span = "P14D"`) and applies it relative to
the moment you lock.

Exempt first-party packages from the window.
The same `uv.toml` governs plugin installs at runtime, and a base constraint on a
version younger than the window makes every plugin install unsatisfiable on release day.
Measured: a constraint `uv==0.13.7` failed with “was filtered by `exclude-newer`”; with
`uv = false` under `[exclude-newer-package]` it resolved.

In CI, with the exact uv binary the app bundles:

```bash
UV="vendor/uv/0.13.5/$TARGET/uv"     # the same file that goes into the bundle
uvc() { "$UV" --no-config --config-file runtime/uv.toml "$@"; }   # plus the scrubbed env

# Manual downloads disable implicit interpreter provisioning during locking.
uvc python install --no-bin 3.14.9
uvc lock --check --project runtime --python 3.14.9
uvc export --project runtime --frozen --no-emit-project --format pylock.toml \
    -o build/python-runtime/pylock.toml
uvc export --project runtime --frozen --no-emit-project --no-hashes \
    --format requirements.txt -o build/python-runtime/base-constraints.txt

# Materialize and test on every target architecture, exactly as a user's first run does.
uvc venv --no-project --managed-python --python 3.14.9 "$RUNNER_TEMP/env"
uvc pip sync --python "$RUNNER_TEMP/env/bin/python" --require-hashes --no-build \
    build/python-runtime/pylock.toml
"$RUNNER_TEMP/env/bin/myapp-server" --self-test
# ...run the backend's test and golden suites against $RUNNER_TEMP/env...

shasum -a 256 build/python-runtime/pylock.toml   # recorded in the bundle manifest
```

The exported pylock is universal: the test lock carried 136 hashes for 22 packages,
covering every platform’s wheels with markers, so one file serves every architecture.
Test each architecture you ship anyway, because a wheel can be missing for one of them.

When the backend is built in the same pipeline as the app, it may not be on PyPI yet.
PEP 751 allows a hashed `path` entry relative to the lock, which would let the pylock
reference the freshly built wheel; that variant is untested here.

### Pin and Verify the uv Binary

- Download uv by exact version from the
  [release page](https://github.com/astral-sh/uv/releases), not through an installer
  script that resolves “latest”.
- Check the `.sha256` asset and the GitHub artifact attestation:
  `gh attestation verify uv-aarch64-apple-darwin.tar.gz --repo astral-sh/uv` (the 0.13.5
  arm64 tarball has two attestations in the GitHub attestations API).
- On macOS, `codesign -dvvv` shows `Identifier=sh.astral.uv`, `flags=0x10000(runtime)`,
  and `Authority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)` for 0.13.5,
  and `codesign --verify --check-notarization` succeeds (measured).
- Record the uv version, the Python version and PBS build, and the pylock SHA-256 in a
  bundle manifest the shell reads at launch.
- uv is `MIT OR Apache-2.0`; the release archive contains only `uv` and `uvx`, so
  include a license notice yourself.

* * *

## 5. The Two-Layer Artifact and Environment Lifecycle

### Immutable Bundle, Mutable Environment

- **Immutable layer, inside the signed bundle:** the shell, the pinned uv, the bundled
  `uv.toml`, the `pylock.toml`, the base constraints, the manifest, and in layout A′ the
  PBS archive. The platform’s signed updater replaces all of it atomically.
- **Mutable layer, in per-user app data:** the interpreter, one or more environments,
  the plugin record, and state markers.
  Only the bundled uv writes here, and only what the signed lock names or what the user
  explicitly installed.

This keeps an honest update-integrity chain.
Shell updates arrive through the signed updater; each shell version carries its own
hash-pinned lock; the bundled uv installs only what that lock names.
The only code outside the chain is what the user chose to install, under the package
manager’s own trust model.
Treat “the app was updated” as a trigger to reconcile the environment: JupyterLab
Desktop documents that an app update leaves its extracted environment stale
([troubleshoot.md](https://github.com/jupyterlab/jupyterlab-desktop/blob/0d7e537b04e49c80ed61911d895273eee9af0f44/troubleshoot.md)).

### Layout in App Data

```
python-runtime/
  python/
    <interpreter-artifact-id>/  # UV_PYTHON_INSTALL_DIR for one Python/PBS build and target
  envs/
    <runtime-id>-<generation>/ # a fresh environment built and tested at its final path
    <previous-generation>/    # the previous one, kept for rollback
  plugins.in                   # the user's plugin requirements, one per line
  state.json                   # the active environment and what was verified
  logs/                        # uv and server output
```

Compute the runtime ID from the uv artifact, exact Python and PBS build, target platform
and architecture, base lock, and realized plugin set.
Give every build or repair a fresh generation, even if the inputs match.
For managed Python, key the installation directory by the pinned interpreter artifact:
`uv python install` may reuse a matching patch version already in that directory without
checking the PBS build.
Do not reinstall in an interpreter directory still referenced by a live or rollback
environment.

`state.json` is the pointer.
Write it atomically (write a temporary file, then rename it over the old one), which
works on every platform; a symlink swap does the same on Unix but needs privileges on
Windows. Entry-point scripts inside each environment carry absolute shebangs into that
environment’s own directory, so environments never need to move after they are built.

```json
{
  "active": "envs/7f3c…e1",
  "previous": "envs/a91b…04",
  "uv": "0.13.5",
  "python": "3.14.9+20261021",
  "pylock_sha256": "7f3c…",
  "plugins_sha256": "e1…",
  "verified_at": "2026-11-08T17:02:11Z"
}
```

### First Run

1. Show the app’s own progress UI before starting.
   Never open a Terminal window: Anki’s launcher re-launched itself in Terminal to show
   uv output, and its maintainer reported “users’ eyes glazing over the moment a
   terminal window appears”; an education admin reported Terminal blocked on managed
   Macs ([anki#4556](https://github.com/ankitects/anki/issues/4556)).
2. Install Python (`python install --no-bin`, from the mirror in layout A′).
3. Build the environment in a fresh generation directory with `uv venv`. Keep it at that
   path after publishing; never clear the active or rollback generation.
4. `pip sync --require-hashes --no-build` the bundled pylock.
5. Reapply plugins, if any ([§6](#6-plugins-and-user-installed-packages)).
6. Warm the native extensions by importing them once, so the first-load security scan
   happens under the progress UI rather than at the first real request.
7. Run a smoke test: the server’s own self-test, or starting it and waiting for its
   readiness signal.
8. Write `state.json` last.

Stream uv’s plain stderr lines into the UI and the log.
Map them to a few user-meaningful steps (downloading Python, installing packages,
preparing for first launch), and keep the raw lines behind a disclosure for bug reports.

### Completion Markers and Interrupted Runs

Nothing counts as installed until the marker that names it is written, and the marker is
written last.

- Open WebUI Desktop writes a `.install-incomplete` marker first and forces
  `--reinstall` on the next attempt because “uv can remove packages before failing”
  ([utils/index.ts](https://github.com/open-webui/desktop/blob/f09e8015f7ffa237f4f1b99177abf42c11cc99bc/src/main/utils/index.ts#L495)).
- Anki’s launcher wrote `.sync_complete` only after a successful sync.
- Legacy ComfyUI Desktop treated any existing `.venv` as usable; an interrupted first
  install left one pointing at a missing interpreter, and the next start failed
  ([desktop#1574](https://github.com/Comfy-Org/desktop/issues/1574)).

Building every environment in a new directory and switching `state.json` only after the
smoke test makes interruption harmless: a half-built directory is never the active one,
and the next run deletes it.

### At Every Launch

1. Read the bundle manifest and `state.json`. If any runtime identity input differs, run
   the update flow before starting the server.
2. In layout B, compare `pyvenv.cfg` `home` with the live bundle path.
3. Check installed package metadata against the complete expected set.
   If there are no plugins, `uv pip sync --check --offline` against the base pylock is
   sufficient for this metadata check (28 ms in the test set).
   With plugins, record and check the resolved base and plugin packages, including their
   dependencies, at build time.
   Checking only the base lock would report healthy plugins as drift.
4. Start the server. If it fails its readiness check, enter the repair ladder.

The metadata check cannot detect all file damage.
In a probe, deleting `starlette/routing.py` left `--check` green while importing that
module failed. Include imports and a real request in the smoke test.

### Updates: Versioned Environments and Atomic Swap

When the shell update brings a new lock:

1. Build a new environment beside the current one (blue/green), with plugins reapplied.
2. Smoke-test it.
3. Restart the server on it and switch `state.json` only after it reports ready.
4. Keep the previous environment for one rollback; delete older ones.

If the new environment fails, keep running the previous one only when the shell’s
contract with the server ([§7](#version-skew): arguments, the ready line’s `protocol`,
the stdin secret) is unchanged.
Otherwise show an error with a retry, since the new shell may not be able to talk to the
old server.

A rebuild is cheap once the cache is warm: 0.42 s for the 22-package test set offline
with hardlinks, plus 0.30 s of first import.
That makes building a new environment the default response to any change, including
plugin changes.

### Repair Ladder

Try the cheapest step first and smoke-test before switching generations:

1. Rebuild offline from the cache in a fresh generation and replay the recorded plugins.
2. Rebuild online and replay the plugins.
3. Provision a fresh interpreter installation from the pinned artifact and rebuild the
   environment; do not replace an interpreter that another generation still uses.
4. Clean or replace the app-owned cache, then rebuild online.

An in-place base sync removes extra packages and can modify a running environment.
Do not use it to repair a published generation.

Rename a failed environment aside (Mu used `.FAILED` and `.SUPERSEDED` suffixes;
[virtual_environment.py](https://github.com/mu-editor/mu/blob/1cabc860416b93428af838adf83755ab9e38ab41/mu/virtual_environment.py#L590))
instead of deleting it immediately, so a bug report can include it.

### Python Patch Upgrades

- A venv created with `--python 3.14` points `home` at uv’s minor-version link
  (`cpython-3.14-macos-aarch64-none`) and silently follows `uv python upgrade`; one
  created with `--python 3.14.9` points at the patch directory and does not (measured
  both `pyvenv.cfg` forms).
  uv’s 0.13.5 notes say the same: environments pinned to a patch “do not switch to the
  updated interpreter automatically”.
- **Pin the patch, and never run `uv python upgrade` implicitly.** A patch bump arrives
  with a new app release and gets a new blue/green environment, so the interpreter never
  changes under a tested environment.
- Garbage-collect superseded interpreters with `uv python uninstall <version>` and the
  cache with `uv cache prune`, after no environment references them.

* * *

## 6. Plugins and User-Installed Packages

### Install Under Base Constraints

```bash
uvc pip install --python "$ENV/bin/python" -c "$BUNDLE/python-runtime/base-constraints.txt" \
    'some-plugin==1.4.0'
```

- `base-constraints.txt` is the base set exported without hashes.
  A plugin that needs a different version of a base package fails cleanly instead of
  upgrading the base: `starlette<0.40` against `starlette==1.10.0` reported “your
  requirements are unsatisfiable” (measured).
  Surface that message in the UI as an incompatible plugin.
- Optionally lock plugin sets too:
  `uv pip compile plugins.in -c base-constraints.txt --generate-hashes` produces a
  hashed file for reinstalls.

### Record and Replay After a Base Change

**A base `pip sync` removes plugins.** Syncing the base pylock into an environment
containing an extra package reported “Uninstalled 1 package … - six==1.17.0” (measured).
`uv pip install -r pylock.toml` is additive instead (the extra package survived), but it
also leaves stale packages behind, so it is not a substitute for sync.

So the app owns the plugin record:

- Write each user request (`some-plugin==1.4.0`) to `plugins.in` when the install
  succeeds, and remove it on uninstall.
- After every base change, build the new environment from the base pylock, then install
  `-r plugins.in` under the new base constraints.
- If a plugin no longer resolves against the new base, finish the update without it,
  keep its line marked as disabled, and tell the user why.

Mu’s `recreate()` did exactly this: record the user’s packages, rename the old
environment `.SUPERSEDED`, build a fresh one, and reinstall them.
PyApp, whose environment path embeds the app version, does not, so plugins vanish on
every update.

### Environments in Use by Running Processes

Installing into the environment a running server imports from is unsafe: a lazy import
after the install can load a mix of old and new modules, and uv may remove files a
running process still expects.
Because a rebuild from a warm cache takes well under a second, treat a plugin change
like a base change: build a new environment with the new plugin set, smoke-test it,
restart the server on it, and switch the pointer.
If the app must install in place, stop the server first.

### Plugin Cool-Off and Trust

- **Cool-off:** plugin installs resolve on the user’s machine, so the bundled `uv.toml`
  sets the window (`exclude-newer = "14 days"`). This is a product policy; expose an
  override with a clear warning rather than editing the file.
- **Trust:** a plugin runs with the full privileges of the app’s server and, on macOS,
  inherits the app’s privacy grants, since TCC attributes a child process’s file access
  to the responsible app.
  Show the package name, version, and publisher before installing, and never install a
  plugin named by remote content without the user’s confirmation.
- **Advisories:** `uv audit` and `uv tool audit` query OSV and can warn about known
  vulnerable plugins; `UV_MALWARE_CHECK` covers only project syncs.
- **Build code:** use `no-build = true` and accept only registry requirements backed by
  wheels if build backends must not run at install time.
  Reject editable and direct source requirements, including requirements-file options.
  Wheel-only installation does not sandbox the plugin when the server imports it.

* * *

## 7. Sharing With a User’s CLI Install

Many apps with a Python backend also publish it as a command-line tool.
A user may already have it, installed with `uv tool install myapp-server`.

### Discover or Build

- **Default to the app-managed environment.** It is pinned, hash-verified, and owned by
  the app; the user’s CLI is none of those.
- **Offer the user’s install as an opt-in.** Probe the usual locations
  (`~/.local/bin/<entry>`, `/opt/homebrew/bin/<entry>`, `/usr/local/bin/<entry>`) rather
  than the GUI process’s `PATH`, run a version handshake, and use it only if the
  protocol matches.
- **Do not write into the user’s uv directories.** Never run `uv tool install` or
  `uv tool upgrade` on the user’s behalf with the user’s uv: it changes their tool
  environment and their `~/.local/bin`.
- **Expose the app’s copy as an opt-in CLI.** A one-time “Install command-line tool”
  action that links the app-managed entry point into `/usr/local/bin` or `~/.local/bin`
  follows Ollama’s `/usr/local/bin/ollama` offer and answers Datasette Desktop users who
  wanted the environment’s commands on `PATH`
  ([datasette-app#92](https://github.com/simonw/datasette-app/issues/92)).

### State Directories Owned per Runtime

Two runtimes of possibly different versions must never write the same state directory
unless its format is explicitly versioned.

- Give each runtime its own state root: the CLI keeps its XDG or platform default; the
  app passes an explicit state directory to the server it launches.
- Share user-authored data (settings, bookmarks) only through a versioned format, and
  have each version refuse, with a clear message, to open state written by a newer
  schema instead of guessing.
- On macOS, the two runtimes also have different privacy grants: a server started from
  Terminal uses Terminal’s TCC grants, and the same server started by the app uses the
  app’s
  ([Eclectic Light, 2025-11-08](https://eclecticlight.co/2025/11/08/explainer-permissions-privacy-and-tcc/)).
  Users will notice, so document it.

### Version Skew

Whichever runtime starts the server, the shell talks to it through one contract, defined
in the macOS guideline’s
[Shell–Server Contract](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#the-shellserver-contract)
and used the same way by every shell:

- The server binds `127.0.0.1` on port 0.
- After it is listening, it prints one line on stdout:
  `{"event":"ready","protocol":1,"url":"http://127.0.0.1:<port>/","port":<port>,"pid":<pid>,"version":"<server version>"}`.
- The shell writes a per-launch secret as the first line of stdin, never in `argv` or
  the environment, and keeps stdin open.
  EOF on stdin, like `SIGTERM`, starts a bounded graceful shutdown.
- Requests authenticate with that secret as a bearer token, a cookie the shell sets
  directly, or a single-use exchange code at a one-time URL.

For version skew this means:

- The shell compares `protocol` before showing any UI. On a mismatch it fails fast with
  a message that names the server `version`, the protocol the shell expects, and the fix
  (update the CLI, or switch back to the app-managed environment).
  A shell that half-works against an older server produces bug reports nobody can
  reproduce.
- The pinned app-managed environment cannot skew; skew is a cost of the opt-in CLI mode
  only.

* * *

## 8. macOS Specifics

### uv’s Signed Binary and Re-Signing

Since 0.12.12, uv’s macOS executables, both in the release archives and in the `uv`
wheels, are “signed with an Apple Developer ID certificate and notarized by Apple”
([0.12.12 release notes](https://github.com/astral-sh/uv/releases/tag/0.12.12)).
0.13.5’s arm64 binary has `minos 11.0` and the hardened runtime flag; uv’s support
policy is macOS 13 and later.

- **Re-sign the bundled uv** with your own Developer ID, hardened runtime, and secure
  timestamp, inside-out before sealing the bundle.
  This is the conventional path; whether notarization also accepts a nested binary that
  keeps Astral’s signature is untested.
- **uv needs no entitlements.** It loads no third-party code in process.

### Universal Builds and uv

uv publishes thin `aarch64-apple-darwin` and `x86_64-apple-darwin` binaries only, and
python-build-standalone has no `universal2` builds.
The rule:

- **Ship per-architecture apps by default**, each bundling the matching thin uv.
  The arm64 binary is 27,897,472 bytes unpacked and the x86_64 binary 38,465,584
  (0.13.5).

- **For a universal app, `lipo -create` the two official thin binaries and re-sign the
  result with your own identity**, like every other nested binary:

  ```bash
  lipo -create uv-aarch64/uv uv-x86_64/uv -output Contents/Helpers/uv
  codesign -f -s "Developer ID Application: …" -o runtime --timestamp Contents/Helpers/uv
  ```

  Measured with 0.13.5: the 66,383,488-byte universal file kept Astral’s Developer ID
  signature on both slices (`lipo` does not alter slice contents), passed
  `codesign --verify --strict` and `--check-notarization`, and `spctl` reported
  “Notarized Developer ID”. Re-signing replaced both slices’ signatures, and each slice
  ran natively (`aarch64-apple-darwin`, and `x86_64-apple-darwin` under `arch -x86_64`).
  So `lipo` does not break uv’s signature; you re-sign because the bundle is signed
  inside-out under one identity.

- **Do not `lipo` a Python tree.** In layouts A and A′ there is nothing to merge: uv
  installs the interpreter and wheels for the Mac it runs on, at first run.
  A universal layout-B app would need two PBS trees in the bundle, or every Mach-O in
  one tree merged and re-signed; ship per-architecture builds instead.
  A universal layout-A′ app bundles both PBS archives, and a wheelhouse needs both
  architectures’ wheels.

### Quarantine Versus Provenance

- Files uv downloads carry **no `com.apple.quarantine`**. They carry only
  `com.apple.provenance`, which records the responsible app and is not a quarantine
  flag. Measured: 0 quarantine and 1,820 provenance attributes over an installed PBS
  tree; uv’s source has no quarantine handling.
- Apple DTS: “Unix-y networking tools, like `curl` and `scp`, don’t quarantine the files
  they download”
  ([forum thread 706442](https://developer.apple.com/forums/thread/706442)). uv’s HTTP
  client is in that category.
- Because uv’s downloads are not quarantined, Gatekeeper’s notarization check does not
  apply to them, which is why an ad-hoc interpreter in app data runs at all.
  What else macOS checks on unquarantined code is covered, from primary sources, in
  [Quarantine and Gatekeeper](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#quarantine-and-gatekeeper).

### Never Set `LSFileQuarantineEnabled`, and Do Not Sandbox

Both would make every interpreter and extension module uv installs a Gatekeeper
candidate: `LSFileQuarantineEnabled` makes the files an app’s processes create
quarantined, children inherit that, and a sandboxed app’s children inherit the sandbox.
The Mac App Store requires the sandbox and bars downloaded code, so a runtime-extensible
Python app ships as a Developer ID app outside it.
The rules and their sources are in the macOS guideline’s
[Quarantine and Gatekeeper](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#quarantine-and-gatekeeper)
and
[App Sandbox and the Mac App Store](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#app-sandbox-and-the-mac-app-store).
Two checks worth making in any shell: Google Chrome’s `Info.plist` sets the key to true
(checked on an installed copy), so do not start from a Chromium plist; Electron’s
default `Info.plist` does not set it, and the Tauri 2 source never mentions it.

### Library Validation Is per Process

The hardened runtime “enables library validation by default”, which prevents “a program
from loading frameworks, plug-ins, or libraries unless they’re either signed by Apple or
signed with the same Team ID as the main executable”
([Apple](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation)).
Entitlements apply to executables, and libraries inherit those of their host process
([Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)).
A child created with `posix_spawn` or `exec` runs under its own executable’s signature.
The general rule for shells is in the macOS guideline’s
[Library Validation Is Per Process](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#library-validation-is-per-process);
this section adds the Python measurements.

Measured 2026-11-08 (ad-hoc signatures, no Developer ID):

| Process loading the wheels | Result |
| --- | --- |
| uv-installed Python (`adhoc,linker-signed`, no runtime flag) spawned by a parent signed `-o runtime` | All 8 extensions imported |
| The same Python re-signed `-o runtime` | `dlopen` failed: “mapping process and mapped file (non-platform) have different Team IDs” |
| The same, plus `disable-library-validation` on the interpreter | All 8 imported |

The rule that follows: `disable-library-validation` is needed only by an interpreter
signed with the hardened runtime that loads ad-hoc-signed or other-team code.
In layouts A, A′, and C the shell keeps full library validation and needs no
entitlement; native plugins load in the uv-installed interpreter because that
interpreter is not hardened.
In layout B the bundled interpreter needs it, on that executable alone, because runtime
wheels are not signed by your team; apply it per file (osx-sign’s `optionsForFile`, or
your own signing script), not through an entitlements file inherited by every binary.
A bundled interpreter whose every library you signed with your Team ID needs none.
These results come from ad-hoc signatures; repeating them under a Developer ID-signed,
notarized shell is [open research question 2](#open-research-questions).
VS Code is a shipping precedent: its main app has no `disable-library-validation` and
runs user Pythons, language servers, and `git` as children.

### The `install_name_tool` Prompt

On every Python install, uv runs `install_name_tool -id` on `libpython3.x.dylib` so that
native extensions built against that interpreter link correctly (`ensure_dylib_patched`
in `crates/uv-python-managed/src/managed.rs`). On a Mac without the Command Line Tools,
`/usr/bin/install_name_tool` is a shim that pops a “developer tools” installation prompt
([uv#14893](https://github.com/astral-sh/uv/issues/14893), opened by Anki, open), and a
conda `install_name_tool` earlier on `PATH` can break the install or SIGKILL it
([uv#14843](https://github.com/astral-sh/uv/issues/14843), open;
[anki#4216](https://github.com/ankitects/anki/issues/4216)).

- **Workaround:** put a directory containing a no-op `install_name_tool` first on uv’s
  `PATH`. Anki shipped a compiled `int main(void){return 0;}`; a two-line shell script
  (`#!/bin/sh` and `exit 0`) in `Contents/Resources` works the same way and needs no
  Mach-O signing.
- **Why it is safe:** the patch matters only when building native extensions against the
  interpreter. With `no-build = true` the app builds nothing, and uv treats a failed
  patch as a warning, not an error.
- **Upstream:** a draft PR adds a `native-macho-edit` preview feature that edits and
  ad-hoc signs the dylib without the tool
  ([uv#22220](https://github.com/astral-sh/uv/pull/22220), open as of 2026-11-04).
  Recheck it before keeping the stub.

### SIGKILL of Ad-Hoc Python

[uv#16726](https://github.com/astral-sh/uv/issues/16726) (open; last activity
2026-10-15) reports uv-managed interpreters killed with SIGKILL and no log when they
carry `com.apple.provenance` and an ad-hoc signature.
The reporter found that removing the attribute did not help and that re-signing
(`codesign --force --sign -`) did.
Maintainers asked for triage data on 2026-10-05, and the latest reporter is on a
corporate MDM, which suggests endpoint software as a factor.

- Comfy Desktop 2 ships a repair step: strip quarantine, ad-hoc re-sign every Mach-O in
  the environment, and retry when the process “was killed by macOS”
  ([macRepair.ts](https://github.com/Comfy-Org/Comfy-Desktop/blob/c8890334e952d1774c2bff2e9303602a7a813cfb/src/main/sources/standalone/macRepair.ts)).
  Add the same step to the repair ladder, triggered only by a signal-9 exit.
- Layouts A and A′ depend on macOS continuing to run ad-hoc code outside bundles.
  Keep layout B documented as the fallback for fleets that kill it.

### First-Import Security Scan and Link Mode

On the first `dlopen` of an ad-hoc `.so`, macOS assesses it and caches the result per
inode. uv’s default link mode on macOS is `clone`, which creates new inodes for every
environment, so every rebuilt environment pays the scan again
([uv#17371](https://github.com/astral-sh/uv/issues/17371), open; a duplicate reported
about 17 s for a data-science stack).

| Measured, 8 native extensions | First import | Warm import |
| --- | --- | --- |
| New environment, `clone` | 2.42 s | 0.08 s |
| Rebuilt environment, `clone` | 1.96 s | — |
| First environment, `hardlink` | 2.04 s | — |
| Rebuilt environment, `hardlink` (shares cache inodes) | 0.30 s | 0.08 s |

- Set `UV_LINK_MODE=hardlink` with the cache and environments on the same volume.
  The cost is copy-on-write isolation: an in-place edit of an installed file also edits
  the cached copy. [uv#18596](https://github.com/astral-sh/uv/pull/18596), a draft PR,
  would hardlink Mach-O files by default.
- Warm the imports during the first-run progress UI.
- The scan grows with every native plugin.

### App Translocation and Bundle Moves

App Translocation runs a quarantined app opened where it landed from a randomized
read-only copy, so the bundle path changes between launches; detecting it and asking the
user to move the app is covered in the macOS guideline’s
[Refuse Translocated and Read-Only Launches](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/macos-webview-shell-patterns.md#refuse-translocated-and-read-only-launches).
For Python the consequence is layout-specific.
Layouts A and A′ are unaffected, because the interpreter and environments live in app
data. In layout B every environment is bound to the bundle path: moving the measured
bundle made the venv’s interpreter “No such file or directory” while the PBS tree itself
still ran ([Layout B](#layout-b-sign-a-pbs-tree-inside-the-bundle)). So in layout B, run
the first-run setup only after the app is out of a translocated or read-only location,
and keep the `pyvenv.cfg` `home` check at every launch.

### Corporate TLS

uv verifies TLS against its bundled Mozilla roots by default.
On networks that intercept TLS with a private root, downloads fail until uv uses the
platform store: `UV_SYSTEM_CERTS=1` (since 0.11.0; it replaces the deprecated
`UV_NATIVE_TLS`), or an explicit `SSL_CERT_FILE`. Make it a visible setting, offered
when a download fails with a certificate error, rather than a silent default: trusting
the system store also trusts whatever an administrator or malware added to it.

### A GUI Launch’s `PATH`

A Finder-launched app does not see the login shell’s `PATH`; JupyterLab Desktop calls
`fix-path` at startup to recover it
([main.ts](https://github.com/jupyterlab/jupyterlab-desktop/blob/0d7e537b04e49c80ed61911d895273eee9af0f44/src/main/main.ts#L52)),
and `spawn uvx ENOENT` is the textbook symptom in MCP clients.
The app-managed runtime needs no `PATH` at all: spawn the bundled uv and the
environment’s executables by absolute path, and give uv the minimal `PATH` from
[§3](#the-spawn-environment).
Recover the login `PATH` only for features that run the user’s own tools.

* * *

## 9. Windows and Linux Notes

### Windows

- **Signing:** since 0.12.12, uv’s Windows executables have timestamped Authenticode
  signatures from Azure Artifact Signing, intended to “reduce security warnings and
  antivirus false positives” (0.12.12 release notes).
- **Antivirus and EDR:** uv maintains a pinned issue for Windows antivirus and EDR
  interference: errors such as “Access is denied.
  (os error 5)” during installs, or uv itself quarantined
  ([uv#20792](https://github.com/astral-sh/uv/issues/20792), open).
  Surface those errors with that context and route them to the repair ladder.
- **Venvs are path-bound here too:** on Windows, uv creates `Scripts\python.exe` as a
  trampoline pointing at the base interpreter’s absolute path, with a minor-version
  junction for patch upgrades (`crates/uv-virtualenv/src/virtualenv.rs`). Moving the
  interpreter breaks the environment, as on Unix.
- **Directories:** uv defaults to `%LOCALAPPDATA%\uv\cache` for the cache and
  `%APPDATA%\uv\data` (roaming) for persistent data
  ([storage reference](https://docs.astral.sh/uv/reference/storage/)); point both at
  `%LOCALAPPDATA%\<App>`.
- **Support:** uv supports Windows 10 and Windows Server 2016 and later.
  PBS publishes `x86_64-pc-windows-msvc`, `aarch64-pc-windows-msvc`, and
  `i686-pc-windows-msvc` builds (3.14.9 x86_64 `install_only_stripped`: 23,250,453
  bytes).

### Linux

- **AppImage:** the runtime mounts the image at a temporary, read-only mount point
  ([AppImage architecture](https://docs.appimage.org/reference/architecture.html)), so a
  layout-B environment built on an interpreter inside the image breaks on the next
  launch. Use layout A or A′ with the environment under `$XDG_DATA_HOME`.
- **libc:** PBS publishes glibc (`x86_64-unknown-linux-gnu`, plus `x86_64_v2` to `v4`
  microarchitecture variants) and musl builds; uv picks the matching one.
  Wheels follow manylinux or musllinux tags, so test the distributions you claim.
- **Flatpak and Snap** confine child processes; whether a uv-installed interpreter runs
  inside them was not researched.

* * *

## 10. What Shipping Apps Do

Observed 2026-11-08 from each project’s source at a pinned commit and the GitHub API.

| App | Shell | How Python arrives | Where the environment lives | Plugins | Lesson |
| --- | --- | --- | --- | --- | --- |
| **ComfyUI Desktop**, legacy (archived 2026-06) | Electron | Bundled uv 0.8.13; `uv venv --python-preference only-managed` downloads PBS at first run | A user-chosen `.venv`; Python in uv’s global directory | Custom nodes through `uv pip` | No isolation: user `uv.toml` broke installs (#1722), shared Python directory permissions (#1463), partial `.venv` treated as usable (#1574). |
| **Comfy Desktop 2** | Electron (ToDesktop) | Small bundled PBS bootstrap; downloads a prebuilt relocatable environment (810,109,512-byte macOS tarball) | Per-install directory | Custom nodes through `uv pip`; snapshots and rollback | “No pip/uv failures, no CUDA roulette at install time” ([README](https://github.com/Comfy-Org/Comfy-Desktop/blob/c8890334e952d1774c2bff2e9303602a7a813cfb/README.md)); quarantine strip, ad-hoc re-sign, and retry built in. |
| **Datasette Desktop** (last release 2023-02) | Electron 20 | PBS 3.9.6 inside the bundle; `python -m venv` at first run | `~/.datasette-app/venv` | `pip install` into that venv | Moving the app broke the venv (#89), fixed with a health check and rebuild; entitlements include `disable-library-validation`. |
| **JupyterLab Desktop** | Electron | conda-pack tarball in the bundle, extracted and `conda-unpack`ed | `~/Library/jupyterlab-desktop/jlab_server`, because conda cannot install to a path with spaces | pip or conda in that environment | CI signs 1,208 binaries from a list; an app update does not update the environment. |
| **Anki** 25.07–25.09 | Rust launcher, Qt app | Bundled uv; `uv sync --managed-python --no-config` at first run | `AnkiProgramFiles` in app data | Add-on folders, not packages | Strong isolation, but Terminal-based UX; replaced by Briefcase. |
| **Open WebUI Desktop** | Electron 45 | Downloads PBS 3.12.13 with a pinned SHA-256, installs uv with pip, then `uv pip install` into the base interpreter | Electron `userData` | Tools declare requirements installed with `pip` | Incomplete-install marker forces `--reinstall`. |
| **Positron** | Electron (VS Code fork) | None bundled; discovers interpreters, and with consent installs uv through the official script | The user’s environments | The user’s | Probes known uv paths because the GUI `PATH` lacks them. |
| **Mu** (archived 2025) | Qt | PBS inside the bundle; a venv per Mu and Python version | `mu_venv-<py>-<timestamp>` in user data | pip into that venv | Renames failed and superseded venvs aside and replays user packages. |
| **Spyder 6**, **napari** | Qt | conda constructor `.pkg` | `~/Library/spyder-6`; `~/Library/napari-<version>` | conda or pip into the runtime environment | Spyder left py2app to install and uninstall plugins ([spyder#18870](https://github.com/spyder-ide/spyder/issues/18870)). |
| **calibre**, **Kolibri**, **Anki** 26.05+ | Qt, wxPython | Frozen (bypy, PyInstaller, Briefcase) | Inside the bundle | Not packages, or none | Freezing works when plugins are not packages; calibre keeps library validation on. |
| **Orange** | Qt | Relocatable python.org framework inside the `.app` | Inside the `.app` | The add-on dialog runs `pip install` against the bundled interpreter | Writes into the signed bundle; do not copy. |

### Reversals and Their Reasons

- **Anki: PyOxidizer, then a uv launcher, then Briefcase.** PyOxidizer was abandoned
  upstream ([anki#3081](https://github.com/ankitects/anki/issues/3081)). The uv launcher
  shipped in 25.07; the maintainer cited “uv edge cases” and the Terminal window
  ([anki#4556](https://github.com/ankitects/anki/issues/4556)), users described the
  Terminal-based install as “virus-like” and an offline-installer request drew 29
  upvotes ([anki#4557](https://github.com/ankitects/anki/issues/4557)), and the app
  showed up as Python in process lists while the approach “seems to break Screen Time
  tracking on macOS” ([anki#4151](https://github.com/ankitects/anki/issues/4151)).
  [PR #5019](https://github.com/ankitects/anki/pull/5019), merged 2026-06-17, removed
  the launcher: Briefcase “solves most problems with the uv launcher with less
  complexity and at a lower maintenance cost”.
  Most of those causes are avoidable (in-app progress, an offline archive, the GUI
  process staying the shell), and Anki’s add-ons never needed a writable
  `site-packages`, so the reversal argues against a Terminal-driven launcher, not
  against uv as the engine.
  Briefcase then needed a follow-up because the build “didn’t respect locked
  dependencies” ([anki#5593](https://github.com/ankitects/anki/pull/5593)).
- **ComfyUI: resolve at first run, then a prebuilt environment.** For a PyTorch-scale
  stack, resolution and download at first run was the failure point; a comment in the
  successor’s installer calls `torch_deps_sync` “the dominant +60min sink”
  ([install.ts](https://github.com/Comfy-Org/Comfy-Desktop/blob/c8890334e952d1774c2bff2e9303602a7a813cfb/src/main/sources/standalone/install.ts#L43)).
  Comfy Desktop 2 downloads a prebuilt relocatable environment and uses uv only for
  deltas.
- **Spyder: py2app standalone apps, then conda constructor,** to make third-party
  plugins installable (#18870).
- **Datasette Desktop: PyInstaller considered, then PBS plus a venv,** because plugins
  need pip ([datasette-app#25](https://github.com/simonw/datasette-app/issues/25)).

* * *

## Best Practices

1. **Decide extensibility first.** Freeze only if users never install Python packages.

2. **Keep every writable byte outside the signed bundle.** The bundle holds the
   installer and the lock; app data holds the interpreter and environments.

3. **Pin uv by exact version, at least 0.12.12, and verify its hash and attestation.**
   Re-sign it with your Developer ID on macOS.

4. **Route every uv call through one function** with `--no-config`, `--config-file`, a
   scrubbed environment, an app-owned working directory, and serialization.

5. **Set every uv directory explicitly**, including the ones you do not use, and pass
   `--no-bin` to `uv python install`.

6. **Always pass `UV_MANAGED_PYTHON=1` and an exact `--python` patch version.**

7. **Install the base with `uv pip sync --require-hashes --no-build pylock.toml`**,
   never with `uv tool install` when hashes matter.

8. **Lock and apply the cool-off at release time in CI, with the same uv binary you
   ship**, and test the exported pylock on every architecture.

9. **Exempt first-party packages from the cool-off** in the bundled `uv.toml`, or plugin
   installs fail on release day.

10. **Build environments blue/green**, smoke-test before switching, write the pointer
    last, and keep one previous environment for rollback.

11. **Smoke-test; do not trust `pip sync --check`** to detect damaged files.

12. **Record user plugins and replay them after every base change**, because a base sync
    removes them.

13. **Never open a Terminal window.** Show uv’s progress in the app’s own UI.

14. **Never set `LSFileQuarantineEnabled` and never sandbox** a runtime-extensible app.

15. **Do not add `disable-library-validation` to the shell.** Add it only to a
    hardened-runtime interpreter that loads ad-hoc-signed or other-team code (layout B),
    per file.

16. **Use `UV_LINK_MODE=hardlink` on macOS** with the cache and environments on one
    volume, and warm native imports during first run.

17. **Stub `install_name_tool` on macOS** while uv still shells out to it, and test on a
    clean Mac without the Command Line Tools.

18. **Add a SIGKILL repair step** (ad-hoc re-sign and retry) for interpreters killed by
    macOS.

19. **Speak the shared shell–server contract**: a ready line carrying `protocol` and
    `version`, a stdin secret, and a fast failure on a protocol mismatch.

* * *

## Open Research Questions

1. **Notarization of nested archives.** How the notary service treats a bundled PBS
   `.tar.gz` (layout A′) or a wheelhouse of `.whl` files containing ad-hoc Mach-O code
   is untested. Apple says the service “processes nested containers”.

2. **A Developer ID parent.** The library-validation experiment used ad-hoc signatures
   with the hardened runtime.
   Repeating it under a notarized, Developer ID-signed shell on macOS 26 and 27 should
   give the same result, but has not been done here.

3. **Keeping Astral’s signature.** Whether notarization accepts a nested uv that keeps
   its Developer ID signature from another team, instead of being re-signed, is
   unverified.

4. **uv#16726.** The root cause of SIGKILLed ad-hoc interpreters is unknown; it decides
   whether layouts A and A′ hold on locked-down fleets.

5. **Hash-verified tool installs.** If packaged locks
   ([#21962](https://github.com/astral-sh/uv/pull/21962) and companions) ship,
   `uv tool install --locked` may become a simpler alternative to `uv venv` plus
   `pip sync`; `--with` is unsupported in locked mode in the drafts.

6. **TCC and the spawned server.** Whether a folder grant from an Open panel in the
   shell covers the Python child reading inside that folder is inferred from the
   responsible-process model, not tested.

7. **Windows and Linux.** Antivirus and EDR behavior with app-managed environments,
   Windows path-length limits in deep environments, and Flatpak or Snap confinement of
   uv-installed interpreters have no measurements here.

8. **Universal layout B.** `lipo`-merging uv is measured
   ([Universal Builds and uv](#universal-builds-and-uv)); the signing and notarization
   cost of two PBS trees, or of a merged tree, in a universal layout-B app is not.

* * *

## Recommendations

### Runtime-Extensible App, Online First

Layout A: bundle the signed uv, `uv.toml`, `pylock.toml`, and base constraints; install
Python and the environment into app data on first run.
Smallest bundle, no Python signing, no entitlements, and plugins with native code load
without exceptions.

### Runtime-Extensible App That Must Start Offline or on Managed Networks

Layout A′: ship the PBS archive as a `file://` mirror.
For a fully offline launch, also ship the exact locked wheels with verified local paths,
or seed the app’s cache for the pinned uv release.
The measured interpreter install took about a second offline; test the complete install
from the signed artifact with networking disabled.

### Fleets Where Ad-Hoc Executables Are Killed

Layout B: a Developer ID-signed PBS tree in the bundle, `disable-library-validation` on
the interpreter only, the environment in app data, and a bundle-path check at every
launch. Plugin extension modules remain ad hoc, so confirm with the fleet’s endpoint
software that they load.

### Fixed Backend, No Plugins

Freeze with PyInstaller 6.22.3 or Briefcase 0.4.6, or install the locked dependencies
into a PBS tree at build time and sign every Mach-O with your Team ID. When every
library is signed by your team, library validation permits them, so
`disable-library-validation` should be unnecessary.
Briefcase nevertheless adds it, with `allow-unsigned-executable-memory`, to every macOS
app by default (`platforms/macOS/__init__.py`). Like every library-validation result
here, this is untested under your own Developer ID until your first signed build.

### PyTorch-Scale Dependencies

Ship or download a prebuilt, relocatable environment artifact per platform, verified by
hash, and use uv only for deltas and plugins (Comfy Desktop 2). Resolving and
downloading gigabytes on first run is the failure point.

### Developer Tools Whose Users Already Have uv

Default to the app-managed environment, and offer layout C or the user’s installed CLI
as an opt-in mode with a version handshake.

### What to Avoid

- `uv tool install` or `uvx` as the production install path.
- A venv built at build time and shipped inside the bundle: its scripts and `pyvenv.cfg`
  hardcode the build machine’s paths.
- Writing plugins, bytecode, or anything else into the signed bundle.
- Sharing uv’s global Python directory, cache, or tool directory with the user.
- A Terminal window for first-run output.
- `disable-library-validation`, `allow-unsigned-executable-memory`, or
  `LSFileQuarantineEnabled` on the shell.

* * *

## References

### uv and python-build-standalone

- [uv releases](https://github.com/astral-sh/uv/releases) and
  [changelog](https://github.com/astral-sh/uv/blob/main/CHANGELOG.md); signing in
  [0.12.12](https://github.com/astral-sh/uv/releases/tag/0.12.12)
- [Environment variables](https://docs.astral.sh/uv/reference/environment/),
  [configuration files](https://docs.astral.sh/uv/concepts/configuration-files/),
  [settings](https://docs.astral.sh/uv/reference/settings/),
  [storage](https://docs.astral.sh/uv/reference/storage/),
  [Python versions](https://docs.astral.sh/uv/concepts/python-versions/),
  [tools](https://docs.astral.sh/uv/concepts/tools/),
  [platform policy](https://docs.astral.sh/uv/reference/policies/platforms/)
- uv source read at `astral-sh/uv@3e2f08f` (2026-11-07):
  `crates/uv-static/src/env_vars.rs`, `crates/uv-python-managed/src/downloads.rs`,
  `crates/uv-python-managed/src/macos_dylib.rs`,
  `crates/uv-virtualenv/src/virtualenv.rs`, `crates/uv-tool-commands/src/install.rs`
- [python-build-standalone releases](https://github.com/astral-sh/python-build-standalone/releases)
- [PEP 751: pylock.toml](https://peps.python.org/pep-0751/)

### Apple

- [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Creating distribution-signed code for the Mac](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac)
- [Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
  and
  [disable-library-validation](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation)
- [LSFileQuarantineEnabled](https://developer.apple.com/documentation/bundleresources/information-property-list/lsfilequarantineenabled)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple Developer Forums
  [thread 706442](https://developer.apple.com/forums/thread/706442) (quarantine and
  command-line tools)
- Eclectic Light on
  [provenance](https://eclecticlight.co/2023/05/10/how-macos-now-tracks-the-provenance-of-apps/),
  [first-run checks](https://eclecticlight.co/2023/07/05/how-does-ventura-check-the-security-of-known-apps-and-command-tools/),
  [App Translocation](https://eclecticlight.co/2023/05/09/what-causes-app-translocation),
  and
  [TCC attribution](https://eclecticlight.co/2025/11/08/explainer-permissions-privacy-and-tcc/)

### Packagers

- [PyInstaller](https://pyinstaller.org/en/stable/),
  [Nuitka](https://nuitka.net/user-documentation/user-manual.html),
  [py2app](https://github.com/ronaldoussoren/py2app),
  [Briefcase](https://briefcase.beeware.org/), [PyApp](https://github.com/ofek/pyapp),
  [PyOxidizer](https://github.com/indygreg/PyOxidizer)

### Issues Cited

- uv: [#5802](https://github.com/astral-sh/uv/issues/5802),
  [#14843](https://github.com/astral-sh/uv/issues/14843),
  [#14893](https://github.com/astral-sh/uv/issues/14893),
  [#16726](https://github.com/astral-sh/uv/issues/16726),
  [#17371](https://github.com/astral-sh/uv/issues/17371),
  [#18596](https://github.com/astral-sh/uv/pull/18596),
  [#20792](https://github.com/astral-sh/uv/issues/20792),
  [#21962](https://github.com/astral-sh/uv/pull/21962),
  [#22067](https://github.com/astral-sh/uv/pull/22067),
  [#22220](https://github.com/astral-sh/uv/pull/22220),
  [#22595](https://github.com/astral-sh/uv/pull/22595)
- Anki: [#3081](https://github.com/ankitects/anki/issues/3081),
  [#4151](https://github.com/ankitects/anki/issues/4151),
  [#4216](https://github.com/ankitects/anki/issues/4216),
  [#4556](https://github.com/ankitects/anki/issues/4556),
  [#4557](https://github.com/ankitects/anki/issues/4557),
  [#5019](https://github.com/ankitects/anki/pull/5019),
  [#5593](https://github.com/ankitects/anki/pull/5593)
- ComfyUI Desktop: [#1463](https://github.com/Comfy-Org/desktop/issues/1463),
  [#1574](https://github.com/Comfy-Org/desktop/issues/1574),
  [#1722](https://github.com/Comfy-Org/desktop/issues/1722)
- Datasette Desktop: [#25](https://github.com/simonw/datasette-app/issues/25),
  [#89](https://github.com/simonw/datasette-app/issues/89),
  [#92](https://github.com/simonw/datasette-app/issues/92)
- Briefcase: [#419](https://github.com/beeware/briefcase/issues/419),
  [#3078](https://github.com/beeware/briefcase/issues/3078)
- Others: [spyder#18870](https://github.com/spyder-ide/spyder/issues/18870),
  [pnpm#11056](https://github.com/pnpm/pnpm/issues/11056),
  [nub#575](https://github.com/nubjs/nub/issues/575),
  [nub#601](https://github.com/nubjs/nub/pull/601),
  [tauri#16212](https://github.com/tauri-apps/tauri/pull/16212)

* * *

## Appendices

### Appendix A: Re-Verification Commands

These reproduce the measured claims with an isolated uv, without touching the user’s uv
directories. Run them in a scratch directory on an Apple silicon Mac with the uv you
intend to pin; the hash step targets the macOS arm64 wheel, and the last two blocks are
macOS-only. They need the network for wheels and Python.
The last `grep -c` exits 1 because it counts zero matches, which is the expected result.
The whole script was run on 2026-11-08 and produced the results quoted in this document.

```bash
LAB="$PWD/uvlab"; UV=/path/to/pinned/uv
mkdir -p "$LAB"/{home,tmp,work} && cd "$LAB/work"
iso() {
  env -i HOME="$LAB/home" USER="$USER" TMPDIR="$LAB/tmp" PATH=/usr/bin:/bin LANG=en_US.UTF-8 \
    UV_CACHE_DIR="$LAB/cache" UV_PYTHON_INSTALL_DIR="$LAB/python" UV_PYTHON_BIN_DIR="$LAB/pybin" \
    UV_TOOL_DIR="$LAB/tools" UV_TOOL_BIN_DIR="$LAB/toolbin" UV_CREDENTIALS_DIR="$LAB/creds" \
    UV_NO_PROGRESS=1 UV_MANAGED_PYTHON=1 ${EXTRA:-} "$@"
}
printf 'python-downloads = "manual"\nexclude-newer = "14 days"\n' > "$LAB/uv.toml"
u() { iso "$UV" --no-config --config-file "$LAB/uv.toml" "$@"; }

# Interpreter and environment (layout A).
u python install --no-bin 3.13.17
u venv --no-project --python 3.13.17 env
mkdir -p rt && printf '[project]\nname = "rt"\nversion = "0"\nrequires-python = "==3.13.*"\ndependencies = ["fastapi", "uvicorn[standard]", "jinja2"]\n' > rt/pyproject.toml
u lock --project rt --python 3.13.17
u export -q --project rt --frozen --no-emit-project --format pylock.toml -o pylock.toml
u export -q --project rt --frozen --no-emit-project --format requirements.txt -o req.txt
u export -q --project rt --frozen --no-emit-project --no-hashes --format requirements.txt -o base.txt
u pip sync --python env/bin/python --require-hashes --no-build pylock.toml

# Leaks: user config, environment variables, .python-version.
mkdir -p "$LAB/home/.config/uv" && echo 'index-url = "https://user.invalid/simple"' > "$LAB/home/.config/uv/uv.toml"
iso "$UV" pip compile base.txt --show-settings | grep -c user.invalid          # >0: user config applies
u pip compile base.txt --show-settings | grep -c user.invalid                  # 0
EXTRA=UV_INDEX_URL=https://env.invalid/simple u pip compile base.txt --show-settings | grep -c env.invalid  # >0
mkdir -p pv && echo 3.9 > pv/.python-version && (cd pv && iso "$UV" --config-file "$LAB/uv.toml" venv --no-project v)  # tries 3.9

# Hashes: corrupt the macOS arm64 PyYAML wheel hash, then compare mechanisms.
H=$(grep -A40 '^name = "pyyaml"' pylock.toml | grep -o 'cp313-cp313-macosx_11_0_arm64.whl"[^}]*' \
    | grep -o '[0-9a-f]\{64\}' | sed -n 1p)
Z=0000000000000000000000000000000000000000000000000000000000000000
sed "s/$H/$Z/" pylock.toml > pylock.bad.toml; sed "s/$H/$Z/" req.txt > req.bad.txt
u venv -q --no-project --python 3.13.17 b1 && u pip sync --python b1/bin/python pylock.bad.toml               # Hash mismatch
u venv -q --no-project --python 3.13.17 b2 && u pip sync --python b2/bin/python --require-hashes req.bad.txt  # builds from sdist
u venv -q --no-project --python 3.13.17 b3 && u pip sync --python b3/bin/python --require-hashes --no-build req.bad.txt  # fails
u tool install --python 3.13.17 --with-requirements req.bad.txt uvicorn                                      # installs anyway

# Plugins: constraints, removal by sync, --check blind spot.
u pip install --python env/bin/python -c base.txt 'starlette<0.40'     # unsatisfiable
u pip install --python env/bin/python six && u pip sync --python env/bin/python --require-hashes --no-build pylock.toml  # uninstalls six
rm env/lib/python3.13/site-packages/starlette/routing.py
u pip sync --python env/bin/python --require-hashes --no-build --check pylock.toml; echo "exit $?"  # 0 despite the damage

# macOS: link mode and first-import scan.
cat > imp.py <<'EOF'
import time; t = time.perf_counter()
import pydantic_core, yaml, markupsafe._speedups, httptools, uvloop, watchfiles, websockets.speedups
print(f"{time.perf_counter() - t:.3f}s")
EOF
for n in h1 h2; do u venv -q --clear --no-project --python 3.13.17 $n && EXTRA=UV_LINK_MODE=hardlink u pip sync -q --python $n/bin/python --require-hashes --no-build --offline pylock.toml && $n/bin/python -I imp.py; done

# macOS: lipo the official thin uv binaries (from the PyPI wheels) and check the signature.
for a in x86_64 aarch64; do u pip install -q --target "uv-$a" --python-platform "$a-apple-darwin" --python-version 3.13 --no-deps 'uv==0.13.5'; done
lipo -create uv-aarch64/bin/uv uv-x86_64/bin/uv -output uv-universal
codesign --verify --strict uv-universal && codesign --verify --check-notarization uv-universal && spctl -a -vv -t install uv-universal

# macOS: library validation on a hardened copy of the interpreter.
cp -R "$LAB"/python/cpython-3.13.17-* "$LAB/Fake.app-python" && BPY="$LAB/Fake.app-python/bin/python3.13"
u venv -q --no-project --python "$BPY" lv && u pip sync -q --python lv/bin/python --require-hashes --no-build --offline pylock.toml
codesign -f -s - -o runtime "$BPY" && lv/bin/python -I imp.py        # different Team IDs
/usr/bin/xattr -lr "$LAB/python" | grep -c com.apple.quarantine       # 0
```

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
