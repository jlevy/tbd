---
type: is
id: is-01m042y5dmbxemxrpv8640d933
title: Audit existing electron-app-development-patterns.md for stale and incorrect claims
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies: []
parent_id: is-01m042xcf06tnmqey8pcfwwswt
created_at: 2026-08-16T01:28:18.611Z
updated_at: 2026-08-16T01:30:35.308Z
---
Full senior-eng review pass over the existing guideline. Identify claims that are stale, unverifiable, wrongly attributed, or misdiagnosed. Notably: the Electron 39 + macOS 14 'require(electron) returns a string' claim looks like a misdiagnosis of documented behavior (requiring electron from a plain Node process returns the binary path), and the doc carries an unresolved 'file an upstream issue' next-action list that never happened.

## Notes

# Audit: electron-app-development-patterns.md (842 lines, researched ~Feb 2026)

Senior-eng review findings. Numbered for reference in the rewrite.

## A. Structural

A1. **Organized around epistemics, not the reader's task.** The Part 1 Verified Facts /
Part 2 Third-Party Perspectives / Part 3 Analysis frame is a research-brief structure
applied to a guideline. A reader asking "how do I build a clean, minimal standalone
Electron app?" finds no project layout, no build config, no main-process skeleton, no
packaging config, no dev loop. The doc's real center of gravity is "which package manager
should I use", a narrow subtopic.

A2. **Inconsistent with sibling guidelines.** `pnpm-monorepo-patterns` (3614 lines) and
`bun-monorepo-patterns` (2962 lines) both carry: Last Updated date, Related links,
"Updating This Document" with a Last Researched Versions table and Reminders, Executive
Summary, Research Findings, Supply-Chain Mitigation, Best Practices, Open Research
Questions, Recommendations, References, Appendices with complete configs. The Electron
doc has none of the maintenance affordances: no version table, no Last Updated, no update
reminders. It is the doc most exposed to churn (Electron ships a major every 8 weeks) and
has the fewest anti-rot mechanisms.

A3. **Scope imbalance.** Roughly 40% of the doc is Bun-versus-electron-builder trouble.
Electrobun gets a full section plus comparison rows, plus Buntralino, Tauri, and a Bun
desktop discussion thread. Actual Electron app architecture gets a 3-box ASCII diagram, a
module-format table, and a 30-line security section.

## B. Factual and evidentiary

B1. **§3.1 is very likely a misdiagnosis and it is the doc's headline finding.** The
reported symptom (`require('electron')` yields a string, `process.type` undefined) is the
*documented* behavior when the `electron` module is loaded by plain Node.js rather than by
the Electron binary: `electron/index.js` exports the path to the binary so that
`spawn(require('electron'))` works. The test snippet shown, run under `node`, produces
`app: undefined` on every OS and every version. A CI/local split is far more likely an
invocation difference than an OS regression. The doc then builds a compatibility matrix
row (39.x warn on macOS 14), a stack recommendation (electron@38, or @39 on macOS 15), and
an Open Question on top of it. Most damaging error in the doc: it steers readers off a
current Electron major. [Agent verifying upstream.]

B2. **Stale by construction.** Electron 39.x as newest, Bun 1.3.x, Node 24.x, npm 10.x,
pnpm 10.x, Electrobun ~0.0.19-beta "as of 2026-02-03". The sibling pnpm doc, refreshed
2026-05-21, already contradicts several (pnpm 11, Node 26 Current / 24 LTS). Today is
2026-08-16.

B3. **Uneven evidence presented uniformly.** "Verified Compatibility Issues" includes
bun#9895 (April 2024) and bun#1588 (older still) with no re-check of current state. A 2024
Bun issue is not evidence about Bun in 2026. §7 then hardens these into a flat verdict
table (Bun: Crashes/issues, Blocked, Low) which is the exact form of claim that rots
silently.

B4. **Broken internal link.** §5 links `./research-2026-02-03-electrobun-desktop-framework.md`,
which exists nowhere in the repo. The `new-guideline` shortcut also forbids relative links
in bundled guidelines, since they break wherever the doc is installed.

B5. **Private references in a doc published to npm.** `/repos/craft-agents-oss`,
`/repos/electrobun` (local machine paths) and "internal reference: actions/runs/21639950110"
(unresolvable CI link).

B6. **Unfinished work embedded as content.** §3.1 "Next actions: test latest patch,
reproduce on a second machine, file upstream issue" is a to-do list left in a shipped
reference doc. Belongs in beads per the eng principles.

B7. **Unsupported numbers.** "Electron ~150MB minimum bundle" is high for a hello-world on
macOS arm64 and varies by platform and compression. "5-10x faster installs" is flagged as a
vendor claim yet still sits in a comparison table as if measured.

## C. Content gaps versus the stated goal

The goal is a reference for a clean, minimal, standalone Electron app with a complete
modern build system and an arbitrary backend (Node, Bun, Python, or a mix). Missing today:

C1. Project layout for a standalone (non-monorepo) app.
C2. Build system: no Vite config, no electron-vite, no main/preload/renderer wiring, no dev
    loop (renderer HMR plus main restart), no per-process tsconfig split.
C3. **Backend integration: absent entirely.** Nothing on utilityProcess, child_process,
    sidecar binaries, extraResources/asarUnpack, IPC transport choice, or Python/Bun/Go
    backends. This is the user's central requirement.
C4. Typed IPC pattern. Security section says "use contextBridge" and shows no code.
C5. Packaging config. electron-builder is named ~20 times; the only config shown is a
    Windows file-locking workaround.
C6. Code signing and notarization: nothing. This is where real projects lose the most time.
C7. Auto-update: a 6-line mention.
C8. Native modules: nothing (@electron/rebuild, ABI mismatch, prebuilds).
C9. Electron Fuses and ASAR integrity: nothing.
C10. Testing: nothing (Playwright Electron, WebDriverIO).
C11. CI: nothing (3-OS matrix, signing secrets in CI).
C12. Security section is a stub: 3 webPreferences flags and 4 bullets. No CSP example, no
     navigation guard, no permission handler, no setWindowOpenHandler code.
