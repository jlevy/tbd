---
type: is
id: is-01kzwkh4wffsgaazgq9q8857j5
title: Make Pretty obey Active and all filters exactly
kind: bug
status: closed
priority: 1
version: 3
labels:
  - web
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:44:22.414Z
updated_at: 2026-08-13T04:06:22.939Z
closed_at: 2026-08-13T04:06:22.939Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Pretty currently injects filtered-out ancestors as context, so Active can display closed rows (reported tbd-d847). Align the browser with tbd-cedu      P0  ○ open  [epic] [epic] Release tbd v0.2.0 (shared common-dir worktree, f04 migration)
├── tbd-g1gq      P2  ○ open  [bug] [bug] tbd setup --auto pins dogfood scripts at dev-version strings that aren't on npm
├── tbd-vugg      P2  ○ open  [bug] [bug] tests/lockfile.test.ts EPERM flake on Windows still hangs main CI for 20+ minutes
└── tbd-72xm      P3  ○ open  [task] [task] Bump pnpm/action-setup and softprops/action-gh-release to support Node 24
tbd-a105      P1  ○ open  [epic] Improve CLI error handling and debugging
tbd-n6ra      P1  ○ open  [bug] tbd doctor shows 0 issues when remote tbd-sync branch has data
tbd-76ma      P1  ○ open  [task] Add golden test for fresh clone with remote tbd-sync data
tbd-up8l      P1  ○ open  [epic] Spec: Docs config redesign (f06+ framework)
├── tbd-70dj      P1  ○ open  [epic] Phase 1: Basic capabilities and migration (f06+ framework backing impl)
│   ├── tbd-4wn0      P1  ○ open  [task] Wire docmap: block in .tbd/config.yml (workflow W1)
│   ├── tbd-nhsx      P1  ○ open  [task] Filesystem-only fetcher for ./ and / docrefs (workflow W3)
│   ├── tbd-itst      P1  ○ open  [task] Source resolution: walk sources in order, produce (bundle, type, name) → path map
│   ├── tbd-avbb      P1  ○ open  [task] Replace DocCache.lookupPath logic with source-walking logic (qualified lookup)
│   ├── tbd-22hm      P1  ○ open  [task] doc_types config block + generic tbd doc <type> <name> dispatcher
│   ├── tbd-hjdt      P1  ○ open  [task] Lockfile: write/read .tbd/docs.lock.yml per format spec §3 (workflow W1)
│   ├── tbd-g23p      P1  ○ open  [task] Doc map: build .tbd/docs/map.yml per format spec §4 (three-layer metadata resolution)
│   ├── tbd-mlhd      P2  ○ open  [task] Update tbd setup to seed default sources (single internal bundle for Phase 1)
│   ├── tbd-jtcz      P1  ○ open  [task] Existing doc commands work via new resolution path (tbd shortcut/guidelines/template/reference)
│   └── tbd-ns1b      P1  ○ open  [task] Phase 1 tests: migration golden (f03→f05, f04→f05), source resolution, doc map
├── tbd-lizx      P2  ○ open  [epic] Phase 2: External bundles and override roundtrip
│   ├── tbd-e7k2      P2  ○ open  [task] URL → docref normalization (GitHub/GitLab URL → github:/gitlab: forms)
│   ├── tbd-uz5o      P2  ○ open  [task] Scheme-specific fetcher: https: (single-file with gh/HTTP fallback, ETag-aware)
│   ├── tbd-wnfb      P2  ○ open  [task] Scheme-specific fetcher: github: (sparse git clone, atomic swap; port RepoCache from PR #87)
│   ├── tbd-zeie      P2  ○ open  [task] Scheme-specific fetcher: git: and gitlab: (same machinery as github:)
│   ├── tbd-8fgr      P2  ○ open  [task] Explicit contents mapping fully wired and tested ({path, type, as?})
│   ├── tbd-8jhq      P2  ○ open  [task] tbd source add/list/remove/show with bundle-name auto-suggestion + preview
│   ├── tbd-q5ii      P2  ○ open  [task] tbd sync --docs and tbd source update [<bundle>] (scheme-specific fetch + lockfile + map rebuild)
│   ├── tbd-zobd      P2  ○ open  [task] tbd doc status [<query>] — bundle-grouped output, per-doc state (A/B/C), staleness, divergence
│   ├── tbd-fmmy      P2  ○ open  [task] tbd source eject <key> [--to <local-bundle>] (copy cached doc into local bundle + git add)
│   ├── tbd-zpp2      P2  ○ open  [task] tbd source diff <key> (two-way diff: local override vs cached current; unified/side-by-side flag)
│   ├── tbd-lnji      P3  ○ open  [task] tbd source upstream <key> (github: → branch+commit+push+open PR via gh; others → patch)
│   ├── tbd-q0f3      P3  ○ open  [task] tbd source unfork <key> (git rm local override, source update <bundle>)
│   ├── tbd-5lsq      P3  ○ open  [task] tbd doc new <type> <name> [--bundle <name>] (scaffold with template frontmatter)
│   ├── tbd-0f8h      P3  ○ open  [task] tbd doctor checks for source health (clones, refs, lockfile hashes, orphaned bundles)
│   └── tbd-t1yg      P2  ○ open  [task] Phase 2 tests: e2e eject→edit→diff→unfork, bundle-add preview golden, status golden, lockfile round-trip
├── tbd-29vf      P3  ○ open  [epic] Phase 3: Migrate bundled docs to external repo (tbd-docs)
│   ├── tbd-qe5g      P3  ○ open  [task] Stand up github:jlevy/tbd-docs (initial content = current packages/tbd/docs/ ex tbd-internal shortcuts)
│   ├── tbd-bb8p      P3  ○ open  [task] Tag v1.0.0 of github:jlevy/tbd-docs
│   ├── tbd-qsxc      P3  ○ open  [task] Update tbd setup --auto to add github:jlevy/tbd-docs@v1.0.0 as default source
│   ├── tbd-pwf2      P3  ○ open  [task] Validation period: one tbd release with both internal + external sources active
│   ├── tbd-6wvv      P3  ○ open  [task] Cut: remove migrated docs from packages/tbd/docs/ (keep only tbd-internal set)
│   ├── tbd-k40e      P3  ○ open  [task] Migration path for existing installs (tbd setup --auto / tbd doctor adds external source)
│   ├── tbd-kfia      P4  ○ open  [task] Update tbd-docs release notes and link from tbd's docs
│   └── tbd-y21d      P3  ○ open  [task] Phase 3 tests: tryscripts that depend on bundled-doc content point at new bundle name
├── tbd-ru5p      P1  ○ open  [task] Q15: Decide resolver semantics (priority-only vs DocGraph+DocMap policy view)
├── tbd-vb1d      P1  ○ open  [task] Q16: Decide bundle ↔ source cardinality (1:1 vs split)
├── tbd-a16i      P1  ○ open  [task] Q17: Decide lockfile identity (docref-only vs source_id vs full config_hash)
├── tbd-ibvv      P1  ○ open  [task] Q18: Decide override provenance (computed-by-name vs recorded edge)
├── tbd-kz1r      P2  ○ open  [task] Q19: Decide as: field disambiguation (keep vs mode: discriminator vs KDEX-aligned)
└── tbd-j89q      P2  ○ open  [epic] Q20: Decide categories/types/folders, glob-first matching, CLI aliases
tbd-g9x7      P1  ○ open  [epic] Modernize multi-agent skills and hooks setup
├── tbd-qgpl      P1  ○ open  [task] Add skills/tbd distribution source
├── tbd-mjxt      P1  ○ open  [task] Define AGENTS.md scope and marker policy
├── tbd-jrir      P1  ○ open  [task] Shrink generated AGENTS.md block
├── tbd-orup      P1  ○ open  [task] Add Codex startup and gh CLI setup parity
├── tbd-shsb      P1  ○ open  [task] Document pinned CLI runner fallback patterns
├── tbd-zd4h      P2  ○ open  [task] Add --surfaces=<list> setup selector (replaces per-agent flags)
├── tbd-l2ym      P1  ○ open  [task] Update setup check remove status and doctor
├── tbd-0q8h      P1  ○ open  [task] Audit gitignore policy for agent integration files
├── tbd-bz0h      P1  ○ open  [task] Add tests for multi-agent skills and hooks setup
├── tbd-m6f3      P1  ○ open  [task] Self-apply tbd setup to this repository
├── tbd-wha7      P2  ○ open  [task] Validate ecosystem compatibility and release metadata
├── tbd-fcam      P1  ○ open  [task] Implement existing-install upgrade, migration and format guard
├── tbd-5m4k      P1  ○ open  [bug] Generated agent surfaces omit configured custom shortcut lookup paths
└── tbd-q0kh      P2  ○ open  [bug] Pin repren skill fallback instead of uvx repren@latest
tbd-6h1r      P1  ○ open  [epic] Spec: Agent CLI ergonomics (bulk ops, output contract, sync clarity)
├── tbd-shna      P2  ○ deferred  [task] Opt-in --sync and honest stage-then-publish model
│   └── tbd-sctd      P2  ○ deferred  [task] Add --sync flag with lock-release-then-sync boundary
├── tbd-ja4e      P3  ○ open  [task] Query-driven mutation: close/update --where (reuse list grammar)
├── tbd-t9em      P3  ○ open  [task] tbd apply transaction file (generalize import)
└── tbd-71oi      P4  ○ open  [task] Delivery provenance (--by-pr) and documented verb [ids...] spine
tbd-va8i      P1  ◐ in_progress  [epic] GitHub #190: Refresh skill-creation guidance and setup dry-run safety
└── tbd-z63u      P2  ◐ in_progress  [task] Reconcile legacy skill-guidance tracking and close delivered issues
tbd-g305      P1  ● blocked  [epic] Epic: Linear integration pilot (design rework pending)
├── tbd-le2l      P1  ○ open  [bug] Fix extensions merge: lww → deep_merge_by_key per design §3.5
├── tbd-80wy      P1  ○ deferred  [task] Add linked field to IssueSchema with merge_by_id (provider,id) rule
├── tbd-klb6      P2  ○ deferred  [task] Add last_actor field (TBD_ACTOR) set by mutating commands
├── tbd-fjr0      P1  ○ deferred  [task] Compatibility gate: version/format bump for new synced fields
├── tbd-7czg      P1  ○ deferred  [feature] Phase 1: Linear client, config gating, link/unlink/import, single-bead sync
├── tbd-atv5      P1  ○ deferred  [feature] Phase 2: subset sync, conflict resolution, tbd sync integration, mock-server golden tests
├── tbd-ii8p      P1  ○ deferred  [feature] Phase 3: coordination pilot on shipped watch — last_actor in reports, dispatch conventions, QA playbook
├── tbd-bbv0      P3  ○ deferred  [task] Phase 4 (deferred): webhook daemon, Linear Agents sessions, comments, deps, GitHub adapter
├── tbd-vm5s      P1  ○ open  [task] Rework Linear pilot spec under the integration layering (extensions-first, separable module)
└── tbd-z95g      P2  ○ open  [feature] Generic extensions read/write/display on the CLI
tbd-91ew      P1  ○ open  [epic] Guidelines: raise and align the ESLint/autoformatting floor across TypeScript project guidelines
tbd-bvxe      P1  ◐ in_progress  [task] Address review: PR #199 TypeScript/JavaScript quality floor
├── tbd-12e9      P1  ○ open  [bug] PR #199 review R1: Route normal TS/JS work to lint-format floor
├── tbd-b7hx      P1  ○ open  [bug] PR #199 review R2: Decouple package manager, language, and lint engine
├── tbd-ohqy      P1  ○ open  [bug] PR #199 review R3: Use strictTypeChecked for the high floor
├── tbd-s3rk      P1  ○ open  [bug] PR #199 review R4: Make promise-safety guarantees truthful
├── tbd-tt2n      P2  ○ open  [bug] PR #199 review R5: Make Biome warning-free checks fail
├── tbd-6oc6      P2  ○ open  [bug] PR #199 review R6: Add all formatters to verify-only gates
├── tbd-4w3h      P2  ○ open  [bug] PR #199 review R7: Serialize repo autofix hooks and verify at push
└── tbd-7bb0      P2  ○ open  [bug] PR #199 review R8: Define and apply the high TypeScript compiler floor
tbd-4zhi      P1  ○ open  [epic] Ship gh decision-rule guidance so it reaches agents (GH issue #195)
└── tbd-yhz0      P1  ○ open  [task] Cut release carrying #195 guidance; verify shipped shortcut and AC1/AC4
tbd-j3q1      P1  ○ open  [bug] Flaky tryscript: cli-edge-cases 'Non-existent short ID' collides with did-you-mean suggestions
tbd-tp6n      P1  ◐ in_progress  [epic] Release-validate bead watch infrastructure
└── tbd-t750      P1  ○ open  [task] Run manual release-candidate QA for bead watch
tbd-gvju      P1  ○ open  [epic] Epic: External tracker integrations (Linear first, GitHub next)
├── tbd-1ae2      P2  ○ open  [task] Phase 3: GitHub adapter for issues and PR links
│   ├── tbd-lmo9      P2  ○ open  [task] integrations/github/: client, adapter, mapping
│   ├── tbd-v75l      P2  ○ open  [task] PR links: extensions.github.prs to attachmentLinkGitHubPR
│   └── tbd-xbkm      P3  ○ open  [task] Phase 3 documentation
└── tbd-3qfj      P2  ○ open  [bug] sync should detect multiple beads linked to one external item
tbd-0zpa      P1  ◐ in_progress  [task] Address review: PR #205 — final additivity and docs audit
├── tbd-9ggk      P1  ◐ in_progress  [bug] PR #205 final R1: preserve empty-status list behavior
├── tbd-55a2      P1  ◐ in_progress  [bug] PR #205 final R2: document watch commands in agent skill
├── tbd-uqkh      P2  ○ open  [task] PR #205 final A1: assess cross-platform watch CI gate
├── tbd-3dft      P2  ○ open  [task] PR #205 final A2: assess unrelated bulk-mutation fixture rename
├── tbd-o0t8      P1  ◐ in_progress  [bug] Review finding: validate watch durations as safe milliseconds
├── tbd-redu      P1  ◐ in_progress  [bug] Review finding: delimit configured watch remote from Git options
└── tbd-ns9a      P1  ◐ in_progress  [task] Final docs audit: reconcile watch validation and common-doc metadata
tbd-6gy0      P1  ○ deferred  [bug] Triage runtime js-yaml audit advisory before next release
tbd-1fgu      P1  ○ open  [task] Address review: PR #206 — Bugbot findings + owner design comments
├── tbd-7aod      P2  ○ open  [bug] PR #206 review R2: board refresh() drops SSE wake during in-flight fetch
└── tbd-s6r5      P2  ○ open  [bug] PR #206 review R3: GET /api/board reads mid-reload snapshot
tbd-wter      P1  ◐ in_progress  [epic] Polish web table time and column layout
├── tbd-jp34      P1  ○ open  [bug] Remove synthetic pretty-tree bars from wrapped title lines
├── tbd-fijh      P1  ○ open  [bug] Preserve active sort stack across live bead updates
├── tbd-g5v7      P2  ○ open  [feature] Replace rough native titles with a fast consistent tooltip system
├── tbd-qv9j      P1  ○ open  [feature] Default the board to Updated descending then Priority ascending
├── tbd-8fcm      P1  ○ open  [feature] Cap composed sorting at two keys and add an explicit reset
├── tbd-aw5y      P1  ○ open  [feature] Make label facets iteratively reflect conjunctive intersections
├── tbd-96da      P2  ○ open  [bug] Prevent the Updated secondary-sort indicator from clipping
├── tbd-vzun      P2  ○ open  [bug] Render relative ages as sans chrome and exact timestamps as literals
├── tbd-ng1l      P3  ○ open  [bug] Clarify filtered header tallies with shown
├── tbd-x9lk      P1  ○ open  [feature] Add dynamic tallies to Status, Type, and Priority facets
├── tbd-o0zq      P2  ○ open  [bug] Make the Beads/sidebar divider continuous and symmetrically owned
├── tbd-zxu9      P2  ○ open  [bug] Keep aggregate facet tallies out of closed chooser labels
├── tbd-osu2      P1  ○ open  [task] Audit Ready semantics and prominence in the live browser
├── tbd-ewol      P1  ○ open  [feature] Compact latest-change field diffs and suppress created-value noise
├── tbd-wv8o      P2  ○ open  [bug] Normalize status-panel chrome to the body text scale
└── tbd-8xwj      P1  ○ open  [feature] Make Pretty the default and preserve Updated sorting
tbd-0nuf      P2  ○ open  [feature] Add remote vs local issue counts to tbd stats
tbd-xqn2      P2  ○ open  [feature] Issue templates
tbd-mvus      P2  ○ open  [feature] Query DSL for list
tbd-tv5i      P2  ○ open  [feature] Format option (json/yaml/table/csv)
tbd-32ar      P2  ○ open  [task] Architecture diagrams in docs
tbd-55c3      P2  ○ open  [task] Refactor copy-docs.mjs to use shared settings
tbd-x8va      P2  ○ open  [epic] Agent documentation consolidation and cleanup
tbd-pt3v      P2  ○ open  [epic] Spec: CLI Output Design System
tbd-jgwp      P2  ○ open  [task] Message format testing
tbd-miqw      P2  ○ open  [task] Update TriScript to 0.1.6
tbd-dk3x      P2  ○ open  [task] Comprehensive testing of TriScript 0.1.6 coverage mechanisms
tbd-8rpg      P2  ○ open  [feature] Improve setup tests with dedicated fixture repos
tbd-yom2      P2  ○ open  [feature] Improve sync commit messages with ticket IDs and summaries
├── tbd-f0nb      P2  ○ open  [task] Generate commit body with long-format issue summaries (title, description, close_reason)
├── tbd-qi6q      P2  ○ open  [task] Add tests for sync commit message generation
├── tbd-r6s8      P2  ○ open  [task] Track modified issues at commit time and pass to commit message generator
└── tbd-xdwv      P2  ○ open  [task] Generate commit subject line with up to 8 short IDs (truncate if >10)
tbd-x3zq      P2  ○ open  [task] Add integration tests for shortcut command
tbd-cgb8      P2  ○ open  [task] Add golden tests for shortcut output formats
tbd-z26l      P2  ○ open  [task] Document configuration options in tbd-design.md
tbd-w4un      P2  ○ open  [task] Create claude-installation.md with installation section for Claude only
tbd-f8ih      P2  ○ open  [task] Unit tests for generateShortcutDirectory() function
tbd-79bl      P2  ○ open  [task] Integration tests for shortcuts refresh command
tbd-pf9l      P2  ○ open  [task] Golden tests for skill output with embedded shortcut directory
tbd-a62h      P2  ○ open  [task] Test marker-based replacement in installed skill files
tbd-jmqy      P2  ○ open  [feature] Create closing-protocol shortcut and refactor skill file
tbd-2nz2      P2  ○ open  [task] Create packages/tbd/docs/shortcuts/standard/closing-protocol.md
tbd-g1n1      P2  ○ open  [task] Update SKILL.md SESSION CLOSING PROTOCOL to reference shortcut
tbd-8wt3      P2  ○ open  [task] Update skill file generation to include closing-protocol in shortcut directory
tbd-16oe      P2  ○ open  [epic] Spec: Beads Migration
tbd-df33      P2  ○ open  [epic] Spec: Transactional Mode and Agent Registration
tbd-d7za      P2  ○ open  [epic] CLI output consistency: stats formatting and status icons
├── tbd-v809      P2  ○ open  [task] Audit and ensure consistent status icon usage across all CLI commands
└── tbd-vbet      P2  ○ open  [bug] Redesign stats command output: unified status section with active/closed/total columns
tbd-6fps      P2  ○ open  [epic] Spec: Welcome Message Improvements
tbd-1r0w      P2  ○ open  [epic] Spec: CLI Output Formatting Consistency
tbd-omgl      P2  ○ open  [epic] Spec: Design Docs Review
tbd-v9pq      P2  ○ open  [feature] Unified sync command: sync both issues and docs by default
├── tbd-2d3s      P2  ○ open  [task] Phase 3: Update auto-sync in DocCache to merge defaults
├── tbd-2dmg      P3  ○ open  [task] Phase 7: Testing for unified sync
├── tbd-6zhj      P2  ○ open  [task] Phase 2: Update sync command with --issues/--docs flags
├── tbd-kvb5      P2  ○ open  [task] Phase 4: Remove docs --refresh command
├── tbd-offi      P2  ○ open  [task] Phase 1: Extract shared syncDocsWithDefaults() function
├── tbd-oz2c      P2  ○ open  [task] Phase 5: Update setup command to use shared function
└── tbd-xlmp      P3  ○ open  [task] Phase 6: Update documentation for unified sync
tbd-v3le      P2  ○ open  [task] Review and validate research-claude-code-sub-agents.md
tbd-gv67      P2  ○ open  [task] Review: Key Takeaways — verify Opus settings, Cloud methods, and what-doesn't-work claims
tbd-tzqx      P2  ○ open  [task] Review: Section 1 — Sub-Agent Architecture and Built-in Types (verify model defaults, tool access, nesting constraint)
tbd-9ths      P2  ○ open  [task] Review: Section 2 — Model Selection and Control (verify env vars, alias resolution, cost claims)
tbd-e6yn      P2  ○ open  [task] Review: Section 3 — Context Transfer Between Parent and Sub-Agents (verify what is/isn't shared)
tbd-0d19      P2  ○ open  [task] Review: Section 4 — Environments: CLI, VS Code, Desktop, Cloud (verify Cloud config methods, /model behavior)
tbd-q1lw      P2  ○ open  [task] Review: Section 5 — Emerging Best Practices (verify Anthropic multi-agent claims, 90.2% stat, token scaling)
tbd-1lyj      P2  ○ open  [task] Review: Section 6 — Sub-Agent Orchestration Patterns (verify loops, background sub-agents, agent teams)
tbd-w5tg      P2  ○ open  [task] Review: Section 7 — Claude-Code-Invoking-Claude-Code (verify CLI flags, comparison table, code examples)
tbd-ttd2      P2  ○ open  [task] Review: Section 8 — Comparison Table: Native Sub-Agents vs Agent Teams vs Outer Loop
tbd-35zg      P2  ○ open  [task] Review: Section 9 — Custom Sub-Agent Delegation Frameworks (verify hooks, permissions, pipeline patterns)
tbd-z5zg      P2  ○ open  [task] Review: Section 10 — Self-Managed Compaction (verify all 8 approaches, hook bugs, Ralph Loop, bead-managed loop)
tbd-odic      P2  ○ open  [task] Review: Recommendations and Quick-Reference (verify settings examples are correct and complete)
tbd-6ssd      P2  ○ open  [task] Review: References — validate all URLs, check for dead links, verify cited issue numbers
tbd-mgnn      P2  ○ open  [epic] Review & research pass: Claude Code Sub-Agents research doc
tbd-tysy      P2  ○ open  [task] Review S1: Sub-Agent Architecture and Built-in Types
tbd-takq      P2  ○ open  [task] Review S2: Model Selection and Control
tbd-m2q5      P2  ○ open  [task] Review S3: Context Transfer Between Parent and Sub-Agents
tbd-l48q      P2  ○ open  [task] Review S4: Environments — CLI, VS Code, Desktop, Cloud
tbd-oux3      P2  ○ open  [task] Review S5: Emerging Best Practices for Sub-Agents
tbd-mtm6      P2  ○ open  [task] Review S6: Sub-Agent Orchestration Patterns
tbd-e7a1      P2  ○ open  [task] Review S7: Claude-Code-Invoking-Claude-Code (Ralph Wiggum Loops)
tbd-2pw1      P2  ○ open  [task] Review S8: Comparison — Native Sub-Agents vs Agent Teams vs Outer Loop
tbd-bzg0      P2  ○ open  [task] Review S9: Creating Custom Sub-Agent Delegation Frameworks
tbd-06po      P2  ○ open  [task] Review S10: Self-Managed Compaction and Agent Self-Restart
tbd-du6t      P2  ○ open  [task] Review: Key Takeaways, Recommendations, and References
tbd-68ub      P2  ○ open  [task] Research: Emerging agentic workflow tooling, trending GitHub projects, and analogs
tbd-hch7      P2  ○ open  [feature] kdex: Core store + source resolution (Phase 1)
tbd-yk3p      P2  ○ open  [feature] kdex: Knowledge map + progressive reading (Phase 2)
tbd-5hv2      P2  ○ open  [feature] kdex: tbd integration + migration (Phase 3)
tbd-6qix      P2  ○ open  [task] Add comment to IssueSchema explaining why short_id is not in the schema
tbd-lh55      P2  ○ open  [task] Clean up .gitattributes setup: use idempotent insertion (like .gitignore), remove hard-coded issue reference, add comment explaining merge=union strategy
tbd-de2w      P2  ○ open  [epic] Post-merge ID mapping resilience: polish and cleanup
tbd-n7ll      P2  ○ open  [bug] Stabilize flaky full-suite timeouts in doc-add/performance/setup-hooks tests
tbd-i49m      P2  ◐ in_progress  [task] Phase 2: tbd docs status + bare overview + tbd status Docs line (docmap --json)
tbd-wzqp      P2  ◐ in_progress  [task] Phase 2: shared docmap renderer + tbd docs list/show; migrate per-kind --list --json to docmap
tbd-f233      P2  ◐ in_progress  [task] Phase 5: self-docs migration (reference kind, register tbd-docs/tbd-design, retire bare-docs manual viewer)
tbd-ujyy      P2  ○ open  [chore] Triage dev-tooling vulnerabilities reported by pnpm audit
tbd-t7sk      P2  ○ open  [task] F
tbd-ncmu      P2  ○ open  [task] F
tbd-hoib      P2  ○ open  [task] F
tbd-649r      P2  ○ open  [bug] show --json returns null for notes on first write
tbd-1yw2      P2  ○ open  [task] probe
tbd-f6y4      P2  ○ open  [bug] doc-references test dirties the working repo (setup --auto at monorepo root in beforeAll)
tbd-wul8      P2  ○ open  [bug] pre-push test run stamps real .tbd/config.yml with dev tbd_version (isolation leak)
tbd-o2xt      P2  ○ open  [bug] Restore dependency auditing after npm audit endpoint retirement
tbd-5hcu      P2  ○ open  [task] Update flowmark/flowmark-rs skill generators to current allowed-tools guidance (space-separated; drop Bash(uvx:*) wildcard)
tbd-3etj      P2  ○ open  [bug] Running the test suite from the repo stamps the real .tbd/config.yml with a dev version
tbd-35nh      P2  ○ open  [task] PR #196 review S-A: cap Myers diff edit distance with whole-field fallback
tbd-s9vn      P2  ○ open  [chore] Ratchet: re-enable @typescript-eslint/no-unnecessary-condition
tbd-tdh3      P2  ○ open  [chore] Ratchet: enable exactOptionalPropertyTypes in tsconfig.base.json
tbd-h0mu      P2  ○ open  [task] pnpm test skips tryscript CLI suites; gate them locally
tbd-sndk      P2  ○ open  [bug] tbd sync issues phase hangs in proxied remote session; killed sync leaves stale lock that silently blocks all issue writes
tbd-w5xi      P2  ○ open  [bug] tbd update --due rejects a plain date and reports a raw Zod error
tbd-47j5      P2  ○ open  [task] integrations/core/bridge-state.ts: state.yml, meta.yml, base tuples
tbd-75kn      P2  ○ open  [task] integrations/core/three-way.ts: diffAgainstBase and fieldwise merge
tbd-ohev      P2  ○ open  [task] integrations/core/intents.ts: write-ahead journal and replay
tbd-4iyz      P2  ○ open  [task] Conflict handling: attic entry plus external comment with resolve lifecycle
tbd-203u      P2  ○ open  [task] tbd integration sync: batched pull, push, echo suppression, orphans
tbd-xl0t      P2  ○ open  [task] Phase 2 documentation and sync golden tests
tbd-pht1      P2  ○ open  [bug] Orphaned empty data-sync.lock blocks all syncs; doctor reports healthy
tbd-zmpo      P2  ○ open  [bug] tbd sync push triggers repo pre-push code gates; bead sync takes minutes
tbd-v8lv      P2  ○ open  [bug] tbd list --defer-before is declared but never implemented
tbd-v7qn      P2  ○ open  [bug] Harden immediate tbd watch integration test against suite-load flake
tbd-zlej      P2  ○ open  [bug] init accepts id prefixes the display-id parser cannot resolve
tbd-6org      P3  ○ open  [task] Add ESLint rule to enforce atomically for file writes
tbd-c626      P3  ○ open  [task] Add cross-references to research-running-claude-code.md: Parts 7-8 should reference the new orchestration-and-uis doc for detailed protocol analysis of --sdk-url, IDE WebSocket, and ACP. Add Related section at top linking to new doc.
tbd-1tc9      P3  ○ open  [task] Add cross-reference to research-claude-code-sub-agents.md: Section 7 (Ralph Wiggum Loops) should reference the new orchestration-and-uis doc for the protocol/interface perspective on instance-from-instance orchestration. Add to Related section.
tbd-w1k9      P3  ○ open  [task] Update research-running-claude-code.md Part 8 (IDE and Platform Integrations): Section is dated (written Jan 2026). Missing coverage of JetBrains official plugin, ACP adapter ecosystem growth (JetBrains co-developer, 25+ agent implementations), and the Toad TUI. Should be updated or reference new orchestration-and-uis doc for current state.
tbd-l3g3      P3  ○ open  [task] Update research-running-claude-code.md third-party projects list: Missing several newer projects (OpCode, Claudix, Sandbox Agent, Toad, claude-agent-server). The list in Part 2 and the intro table are from Jan 2026 and don't cover the Feb 2026 landscape.
tbd-l9oh      P3  ○ open  [feature] UX: agent-friendly bead annotations: update --reason (parity with close) and a comment/notes alias
tbd-mzk7      P3  ○ open  [task] Update spec statuses after v0.3.0 ship (f05/f06)
tbd-1asx      P3  ○ open  [task] Consolidate close/reopen/update bulk orchestration into a shared runBulkMutation driver
tbd-l1bt      P3  ○ open  [task] Fix pre-existing broken architecture links in docs/development.md
tbd-kgs6      P3  ○ open  [task] Commit regenerated agent hook scripts after #188 hook-template hardening
tbd-230y      P3  ○ open  [task] Defer redundant surface marker cleanup to the next real format migration
tbd-uf0i      P3  ○ open  [chore] Five docs on main are not flowmark-clean under the pinned flowmark-rs@0.3.1 (format:md churns them)
tbd-xtcw      P3  ○ open  [task] Doc-guidelines audit: deferred items from 2026-07-17 repo sweep
tbd-pwud      P3  ○ open  [chore] Session git broker: first push attempt often fails (sideband disconnect); tag pushes always rejected
tbd-bgvx      P3  ○ open  [chore] Repo-wide doc-guidelines sweep: pre-existing spaced em dashes in docs, comments, and CLI strings
tbd-9brb      P3  ○ open  [task] Future: javascript-browser-project-patterns guideline (source-first ESM, checkJs, no build step)
tbd-3inp      P3  ○ open  [task] packages/tbd/.claude/skills/tbd/SKILL.md is stale vs current skill surfaces
tbd-1qgi      P3  ○ open  [task] Fold into tbd sync behind sync_on_tbd_sync (default off)

262 issue(s): every displayed bead must satisfy the active query; when a parent is absent, a matching child becomes a root. Remove the ancestor-context exception and stale context caveats/metadata where possible, cover Active with a closed parent plus label/search cases, and validate tbd-d847 no longer appears under Active unless it independently matches.

## Notes

Live API and browser validation under Status Active + Pretty returned zero tbd-d847 rows. The response contained only matching active rows; filtered closed ancestors are no longer serialized as context.
