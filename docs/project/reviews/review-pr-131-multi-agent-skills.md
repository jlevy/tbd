# Senior Engineering Review — PR #131: Modernize multi-agent skills setup

**Reviewer pass:** senior eng review of plan + research + guideline changes
**Scope:** 5 files, +972/−38 (docs/research/guideline/planning only; no product code)
**Verdict:** Approve the direction. The research is accurate and well-sourced. Merge once
two factual nits and the framing notes below are addressed. None are blockers for a
planning PR.

---

## 1. Summary

This PR re-bases tbd's agent-integration strategy from a Claude-centric model
(`.claude/skills/` + an `AGENTS.md` block for Codex) onto the now-converged cross-agent
model: `.agents/skills/<tool>/SKILL.md` as the portable primary, `.claude/skills/` as a
compatibility mirror, `AGENTS.md` as a compact always-on bootstrap, and Codex-native
hooks. The plan, research, and guideline edits are internally coherent and the bead map
is realistic. I independently validated the load-bearing external claims against current
(May 2026) vendor docs — they hold up.

## 2. External claims — independently validated

I checked the four claims the whole plan rests on. All confirmed:

| Claim in PR | Status | Source-confirmed detail |
| --- | --- | --- |
| `.agents/skills/` is the cross-client convention (not mandated by the spec) | ✅ Accurate | Spec defines *what's inside* a skill dir, not *where*; `.agents/skills/` "emerged as a widely-adopted convention," and clients are advised to also scan `.claude/skills/` pragmatically. The PR's framing ("convention, not a hard requirement") matches the implementor guide verbatim. |
| Codex reads repo skills from `.agents/skills` (CWD → repo root), user `~/.agents/skills`, admin `/etc/codex/skills` | ✅ Accurate | Codex scans `.agents/skills` in every dir from CWD up to repo root; project skills live in `.agents/skills` at repo root. |
| Codex has a hooks configuration surface | ✅ Accurate — **and stronger than the PR states** (see §3.1) | Codex hooks are a "Claude-style engine" using the **same event schema** as Claude hooks. |
| Gemini CLI documents `.agents/skills/` as an alias that takes precedence over `.gemini/skills/` within a tier | ✅ Accurate | Confirmed for both user (`~/.agents/skills/`) and workspace (`.agents/skills/`) tiers. |

This is a high-quality research brief. The recommendation ("stop making `.claude/skills/`
canonical; make it a mirror") is the correct read of the ecosystem.

## 3. Issues / corrections

### 3.1 (Should fix) The Codex hooks story is better than the PR claims — and the comparison table now contradicts itself

`cli-agent-skill-patterns.md:352`, the agent comparison table still lists the **Codex CLI
"Hooks" cell as `—`**, but §6.10 of the same file was edited in this PR to say Codex
*does* load hooks. That's an internal contradiction introduced by this PR.

The accurate, current picture (worth capturing because it de-risks `tbd-orup`):

- Codex hooks use a **Claude-style engine with the same event schema as Claude hooks.**
- Supported events include **`SessionStart`, `PreCompact`, `PostCompact`, `PreToolUse`,
  `PostToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStart`, `SubagentStop`,
  `PermissionRequest`.**
- Loadable from `hooks.json` **or inline `[hooks]` tables in `config.toml`** that sit
  next to active config layers.
- **Command hooks are supported; prompt/agent hook handlers are parsed but skipped.**

**Why this matters:** tbd's four Claude hooks map *almost 1:1* onto Codex events —
`SessionStart → tbd prime`, `PreCompact → tbd prime --brief`, `PostToolUse (git push) →
sync reminder`, `SessionStart → ensure gh`. So the plan's defensive fallback
(`plan §Codex Hook Parity`: "if Codex lacks a direct equivalent … make the limitation
explicit") is unlikely to be needed in practice. The realistic outcome for `tbd-orup` is
near-full parity, not graceful degradation.

Concrete fixes:
- Update `cli-agent-skill-patterns.md:352`: replace the Codex hooks `—` with the real
  event set (or at least "Claude-compatible event schema").
- In the plan's "Codex Hook Parity" and research §"Refresh Notes," upgrade the cautious
  "Codex's docs now list a hooks configuration surface" to the confirmed fact that the
  event schema matches Claude's, so the SessionStart/PreCompact/PostToolUse mapping is
  direct. Keep the caveat that only **command** handlers run.

### 3.2 (Should fix) tbd does not yet follow this guideline — the AGENTS.md block is the live counter-example

You asked specifically that tbd follow its own guidance. Right now it conspicuously
doesn't, and the gap is large enough to call out:

- This repo's `AGENTS.md` is **281 lines, of which the `BEGIN/END TBD INTEGRATION` block
  is 246 lines** — roughly 1.6×–3× over the "<80–150 lines, shorter is better" budget the
  PR itself introduces (`cli-agent-skill-patterns.md:175-180`).
- `packages/tbd/src/lib/integration-paths.ts` still hardcodes only the Claude surface
  (`CLAUDE_SKILL_REL = .claude/skills/tbd/SKILL.md`); there is no `.agents/skills/` or
  Codex constant.
- There is no `.agents/`, no `.codex/`, and no `skills/tbd/SKILL.md` in the repo today.

This is *expected* for a planning PR (implementation is Phases 2–4, tracked under
`tbd-jrir`, `tbd-0fhy`, `tbd-m6f3`), so it's not a blocker. But the PR description and
plan should state plainly that **tbd is currently non-conformant** and that the shrink +
`.agents/skills/` adoption is the dogfooding deliverable that closes the gap. Today a
future agent reading tbd's own `AGENTS.md` would see the anti-pattern, not the pattern.

### 3.3 (Minor) Surface table says "four" but lists five rows

`plan §Agent Integration Surfaces` says "Use four distinct surfaces" then lists five rows
(`AGENTS.md`, `.agents/skills`, `.claude/skills`, `skills/tbd`, `.codex/*`). Either say
"five surfaces" or group the two skill mirrors. Trivial, but it's the kind of thing that
erodes trust in an otherwise precise doc.

### 3.4 (Minor) Codex hook path precision in §6.6 / §6.10

The new §6.6 text recommends `.codex/hooks.json` or `.codex/config.toml`; §6.10 lists
`~/.codex/hooks.json`, `~/.codex/config.toml`, `<repo>/.codex/hooks.json`,
`<repo>/.codex/config.toml`. The docs frame it as "hooks.json files or inline `[hooks]`
tables in config.toml that sit next to active config layers." Recommend stating the
**inline `[hooks]`-in-`config.toml`** option explicitly (it's the lower-friction path for
a single managed file) and keeping the "command handlers only" caveat next to it.

## 4. Balanced Claude + Codex guidance (your core ask)

The PR lands the balance well. To make it *durable guidance for future projects*, I'd
tighten three things so the advice reads as symmetric rather than "Claude with Codex
bolted on":

1. **State the install matrix as one table, both agents first-class.** A future author
   should see, in one place: portable skill → `.agents/skills/<tool>/SKILL.md` (Codex,
   Gemini, Cursor, Copilot, Amp, OpenCode, pi); Claude mirror → `.claude/skills/`;
   always-on → `AGENTS.md` (every agent) + `CLAUDE.md` (Claude only, since Claude does
   **not** auto-load `AGENTS.md` — already correctly noted at line 165). The guideline has
   all the pieces; they're just spread across §1.2, §6.6, and the big table.

2. **Hooks: teach "one shared script, two thin configs."** Because Codex and Claude now
   share an event schema, the *right* pattern for a multi-agent CLI is a single
   neutral-location script (e.g. `scripts/agent/tbd-session.sh`) referenced by both
   `.claude/settings.json` and Codex `[hooks]`/`.codex/hooks.json`. The PR's rule "Codex
   hooks must not reference `.claude/`" is correct but stated only as a prohibition;
   framing it as the positive pattern (shared script + per-agent config) is better
   guidance for someone starting fresh. Note this also requires moving tbd's own scripts
   out of `.claude/scripts/` (today `TBD_SESSION_SCRIPT_REL = .claude/scripts/...`).

3. **Pinned-runner guidance is excellent — generalize the header.** The `uvx --from
   pkg@ver` / `npx --yes pkg@ver` / `pipx run pkg==ver` / `go run mod@ver` chain is
   exactly right and the "never unpinned network runner in generated instructions" rule is
   a genuine supply-chain win that aligns with this repo's `SUPPLY-CHAIN-SECURITY.md`.
   Consider cross-linking the two so future agents see it as policy, not just a tip.

## 5. Self-application / dogfooding assessment

| Guideline introduced | tbd today | Closes under |
| --- | --- | --- |
| `AGENTS.md` block < 80–150 lines | 246-line block | `tbd-jrir` |
| `.agents/skills/tbd/SKILL.md` primary | absent | `tbd-1h9x` |
| `.claude/skills/` is a mirror, not canonical | only surface | `tbd-1h9x` / `tbd-0fhy` |
| Path constants centralized for all surfaces | Claude-only in `integration-paths.ts` | `tbd-0fhy` |
| Codex hooks installed | none | `tbd-orup` |
| `skills/tbd/SKILL.md` distribution copy | absent | `tbd-qgpl` |
| Hook scripts in neutral location | under `.claude/scripts/` | `tbd-orup` (recommend adding explicitly) |

The bead map covers the gaps. One addition worth a bead (or a note on `tbd-orup`): the
**script relocation** out of `.claude/scripts/` is implied by the "don't reference
`.claude/` from Codex" rule but isn't its own tracked item.

## 6. Guidance quality for future agents (your ask)

Strong. A future agent bootstrapping a new project from
`tbd guidelines cli-agent-skill-patterns` would get correct, current, multi-agent advice.
Two things that would make it bulletproof:

- **Add a 10-line copy-paste "new project" recipe** at the top of §6.6: the exact files to
  create and the one-line `AGENTS.md` bootstrap block. Future agents copy recipes far more
  reliably than they synthesize from prose.
- **Date-stamp the volatile claims.** The doc already says "this matrix reflects May
  2026." Good. Apply the same inline stamp to the Codex hooks event list and the
  `.agents/skills` path claims, since these are the fastest-moving facts and the ones an
  agent six months from now most needs to re-verify.

## 7. Documentation consistency

- The three research files and the plan cross-link cleanly and agree on the recommendation.
- `research-cli-as-agent-skill.md` §1.2 was correctly rewritten from a "two-file approach"
  to a "three-surface approach" — consistent with the guideline.
- **Inconsistency to fix:** the guideline's own comparison table (§7, line 352) wasn't
  updated for Codex hooks while §6.10 was (see §3.1).
- `development.md` / architecture docs: no update needed yet — this PR changes no behavior.
  Flag for the implementation PRs (Phases 2–4), where `setup`/`doctor`/`status` behavior
  and `integration-paths.ts` *will* change and `development.md` likely needs a setup-surface
  section.

## 8. CI status

Green. DeepSource grade A across Security/Reliability/Complexity/Hygiene; Secrets analysis
passed; coverage reported (no changed source files, as expected for a docs PR);
`mergeable_state: clean`. PR body documents local `format:check`, `git diff --check`,
`build:check`, and full test suite (57 files / 1064 tests) passing.

The PR's note about `tbd sync` hitting the old-layout worktree conflict (deferred to
PR #121) is a reasonable scope decision — the conflict is unrelated to these docs.

## 9. Suggestions (non-blocking)

- Resolve the open question "install `.agents/skills/` unconditionally?" toward **yes**:
  it's project-local and harmless, and unconditional install is what makes the portable
  path actually portable (detection-gating it re-introduces the Claude-centric bias this
  PR is removing).
- For `skills/tbd/SKILL.md`: prefer **committed + drift test** (regenerate-and-compare),
  matching the pattern already used elsewhere in the repo for generated docs. Best of both:
  browsable on GitHub / skills.sh, and guarded against drift.
- Copy-over-symlink default: agreed and correct for cross-platform/sandbox reliability.

---

### Bottom line

Direction is right and the research is unusually well-validated. Fix the Codex-hooks table
contradiction (§3.1), state tbd's current non-conformance explicitly (§3.2), and fold in
the "shared script + per-agent config" hook pattern (§4.2). With those, this is a solid
foundation for the implementation phases.
