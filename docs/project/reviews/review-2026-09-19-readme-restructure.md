---
title: README Restructure Review
description: Information-architecture review of the main README—optional incremental adoption, replaceable guidelines and shortcuts, and how to stay current without a kitchen-sink landing page
author: Review session operated with LLM assistance
---
# README Restructure Review

**Date:** 2026-09-19

**Reviewed texts:**

- `main` `README.md` at `528083ce` (864 lines).
  Outdated product picture.
- PR [#309](https://github.com/jlevy/tbd/pull/309) `README.md` at `eca9187c` (667
  lines). Latest committed landing page.
  PR [#310](https://github.com/jlevy/tbd/pull/310) is byte-identical.
- Cross-checked against `packages/tbd/src/lib/policy-grants.ts`,
  `packages/tbd/docs/guidelines/agent-policy-grants.md`,
  `packages/tbd/docs/shortcuts/standard/` (setup-tbd, pr-review-workflows,
  review-and-merge-prs, stacked-prs, welcome-user),
  `packages/tbd/docs/shortcuts/system/skill-baseline.md`,
  `packages/tbd/docs/tbd-design.md` §1, `packages/tbd/docs/tbd-docs.md`,
  `packages/tbd/scripts/generate-readme-tables.ts`, and the Unreleased notes in
  `packages/tbd/CHANGELOG.md`.

**Scope:** How the landing page should be structured.
Not a rewrite of `README.md` in this change.
[Refresh tbd design docs](bc-b240dfab-eff7-53d7-8b12-f193b38e55fd) may still edit
`README.md` for factual consistency; this review does not.

Implementation follow-up: bead `tbd-eti9`.

## 1. Verdict

**Restructure the #309 README. Medium information-architecture pass, not a rewrite from
`main` and not another feature catch-up.**

#309 already did the hard catch-up: policies, the PR review lifecycle, six agent
surfaces, `setup-tbd`, generated catalogs, and a factual tone.
What is still wrong is the *shape*. The page now lists the product’s power as if those
flows were the default religion.
A first-time reader cannot tell that install-plus-beads is a complete use, or that every
other surface is optional and replaceable.

Do not start from `main`. Do not reopen [#174](https://github.com/jlevy/tbd/pull/174)
(June 2026; stale). Do not implement until #309’s README is the base and
[Refresh tbd design docs](bc-b240dfab-eff7-53d7-8b12-f193b38e55fd) has finished any
factual README edits (`tbd-6mmb`).

Target after the pass: about 350–450 lines of authored prose, plus the generated catalog
regions if they stay as an appendix.
One sitting for a human who already has #309 in front of them.

## 2. Job of the README

The root `README.md` is the GitHub landing page and the body of `tbd readme`. It should
answer, in about a minute: what tbd is, how to install it, that the rest is optional,
and where the live indexes live.

It is not the operator manual (`tbd prime` / skill-baseline), not the CLI reference
(`tbd docs show tbd-docs`), not the architecture (`tbd design`), not a workflow
procedure (shortcuts), and not the policy schema (`agent-policy-grants.md` on #309,
implemented by `policy-grants.ts`). Those documents already exist and are tested against
the code.
Duplicating them in the README is how the landing page went stale on `main` and
how the #309 policy and merge-gate sections will go stale next.

## 3. What the Current README Does Well

**`main`:** Clear install commands, a working “what you say” table, and an honest Beads
comparison. The rest is first-person, enthusiastic, and factually behind the product.

**#309 (the text to restructure):**

- Factual tone. The Ralph-loop / overnight-agent framing is gone.
- Product catch-up: policy grants, `setup-tbd`, `review-and-merge-prs`, stacked PRs, six
  surfaces, `tbd web` / `tbd watch` / Linear as named capabilities.
- Generated shortcut, guideline, and template tables
  (`pnpm --filter get-tbd generate:readme`) with a drift test.
  Counts can no longer silently rot the way `main`’s “25+” / “40+” / “over a dozen” did.
- `setup-tbd` as the setup path; `--surfaces=` documented; “Can I add my own
  guidelines?” is already a yes.
- FAQ states the four `github-merge` values and that `pr-review-requirements` is a
  separate bar. That matches `policy-grants.ts` (`never` | `confirm-every` |
  `confirm-session` recommended | `autonomous`; no `discouraged` field).

## 4. Gaps Versus Current Product

The product is a **core plus optional layers**. Design principle 6 already says
“Progressive enhancement: Core works standalone, bridges/UI are optional layers”
(`tbd-design.md` §1.5). `welcome-user` already asks whether to keep all bundled
guidelines or a subset, and whether to leave them cached or fork them.
`setup-tbd` already accepts “Not now” for every unanswered policy.
The README does not lead with any of that.

Specific gaps, all on the #309 text:

1. **Optionality is an afterthought.** “What You Get”, “Talking to Your Agent”, and “Why
   tbd” present beads, specs, the full PR lifecycle, delegation, and policies as the
   product. A reader who wants only git-native issues has to infer that is allowed.
2. **Quick Start implies a full policy ceremony.** It sends the agent through
   `setup-tbd`, which *asks* about every unanswered grant.
   That is correct product behavior, but the README never says unanswered is a valid
   steady state, or that “not now” is an answer.
   Incremental adoption starts after npm install, not after granting merge, stacks,
   sub-agents, and Linear.
3. **Replaceability is a FAQ.** Bundled guidelines and shortcuts are a default library.
   You can load some, fork and edit, add from a URL (`tbd docs add` / per-kind `--add`),
   serve replacements from `docs_cache.files` and `docs_cache.local_dirs`, or write your
   own. #309 mentions add/fork/config at the bottom.
   It should be a first-class rung of the adoption ladder, matching `welcome-user`’s
   two-axis offer (scope, visibility).
4. **The talking table is a second skill-baseline.** Twenty-plus rows, including all
   three `review-and-merge-prs` modes.
   Useful as a map; fatal as the first “how to use this” section, because it implies you
   use all of it.
5. **Policy section is a second `agent-policy-grants`.** Full seven-row table, example
   `AGENTS.md` block with a date, CLI verbs, and a merge-gate FAQ that restates
   dispositions, pinned heads, and `--admin`. That schema is already the single
   definition, kept in agreement with `policy-grants.ts` by tests.
   Inlining it is how `main`’s `tbd prime` still says `per-request` while #309 says
   `confirm-session`.
6. **“Why tbd” still narrates one path.** Plan → beads → implement → validate →
   `review-and-merge-prs` is *a* optional flow.
   Presenting it as the way tbd is used undoes the optionality claim.
7. **Stale counts in authored prose.** “What You Get” still says “40+” guidelines while
   the generated table says 46. `main` also contradicts itself (25+ vs 40+; “over a
   dozen” shortcuts vs the real set).
   Authored counts should die.
8. **Power is listed, not framed.** The PR lifecycle, stacks, grants, and delegation
   *are* much stronger than `main` implied.
   The fix is a short capabilities map that says each item is optional, then links.
   Not another dump of procedure.

`main`-only staleness (do not “fix `main`”; #309 already did): four surfaces instead of
six; no `setup-tbd` / `review-and-merge-prs` / `delegate-to-subagents`; no policy
section; incomplete shortcut table; first-person voice.

## 5. Proposed Outline

Keep the badges. Then:

1. **Opening (8–12 lines).** What tbd is in one sentence (git-native beads; Markdown on
   `tbd-sync`; no daemon).
   Second sentence: optional layers exist and are not required.
   Third: drop-in `bd` replacement; works through the CLI in any agent.
2. **What You Can Use (the four capabilities, labeled optional).** Same four items the
   skill and `tbd-design.md` §1.1 already share (beads, spec workflows, guidelines,
   shortcuts), plus a one-line “also available” for web, watch, Linear, and policy
   grants. One clause each that they are optional.
3. **Quick Start.** npm install; tell the agent to run `tbd prime` and set up tbd;
   prefix required. One sentence that `setup-tbd` *offers* policy questions and that “not
   now” / unanswered is fine.
   Link Installation for cloud, upgrade, Beads import.
4. **Adopt Only What You Want.** The adoption ladder (section 7). This is the spine.
   Four rungs, no procedure.
5. **Talking to Your Agent.** Six to ten exemplar requests (create a bead, show the
   board, plan a spec, review a PR, set up tbd).
   One line that every shortcut default yields to the user’s wording.
   Point at `tbd shortcut --list`, `tbd guidelines --list`, and “what can I do with
   tbd?” (`welcome-user`).
6. **Optional Capabilities (glance list).** One bullet each: beads architecture;
   spec/PR/stack workflows; policy grants (four merge values, separate review bar);
   web/watch; Linear; replaceable docs.
   Each bullet is a link, not a how-to.
7. **Installation and Setup.** Requirements, the three `tbd setup` forms, team join,
   `--surfaces=` in a short table, `gh` as optional, Linear as optional, Beads
   migration. Cut hook-script and token-permission detail to `setup-github-cli` /
   `setup-linear`.
8. **Commands.** A short beads/docs/maintenance cheatsheet.
   Link `tbd-docs` for flags, watch selectors, and integration verbs.
9. **Bundled Library (generated appendix).** Keep the generate:readme regions if they
   stay, but title them as an optional index, not “what you get.”
   Or replace with counts plus six exemplars and `tbd shortcut --list`.
10. **Why tbd / Compared to Beads.** Problem (session memory, prompt-pasted rules), core
    (git-native beads), optional quality layer (guidelines and shortcuts you choose).
    Beads comparison in a short paragraph plus the existing note on capitalization.
    Spec-driven cycle as *one* optional flow, not the plot.
11. **FAQ (four questions).** Beads vs tbd; seeing beads without the CLI; can agents
    merge (four values + “review bar is separate” + link); replacing guidelines and
    shortcuts. No merge-gate checklist.
12. **Contributing / License.** Unchanged.

## 6. Focused Suggestions

**A. Lead with optional incremental adoption.** Opening and “What You Can Use.”
Why: the #309 lede is accurate and still reads as a bundle you buy whole.
Where: replace the current subtitle and the unlabeled four-item list with the opening in
section 9.

**B. Put the adoption ladder immediately after Quick Start.** Why: optionality cannot
survive as FAQ #4. Where: new H2, section 7.

**C. Shrink “Talking to Your Agent” to exemplars.** Why: the current table is a
skill-baseline for humans and trains readers that the PR lifecycle is ordinary day-one
use. Where: keep 6–10 rows; move the rest to `welcome-user` and `tbd shortcut --list`.

**D. Cut the policy section to a pitch.** Why: the seven-row table, sample block, and
merge-gate FAQ will rot the next time a value is renamed (already happened:
`per-request` → `confirm-session`; `discouraged` removed).
Where: 8–12 lines under Optional Capabilities: grants live in `AGENTS.md`; they are
preferences; unanswered means ask-first; `github-merge` is `never` | `confirm-every` |
`confirm-session` (recommended) | `autonomous`; `pr-review-requirements` is independent
and still applies under `autonomous`. Link `agent-policy-grants` and `tbd policy show`.
Delete the example block.

**E. Keep generated catalogs as an appendix, or drop them to a live index.** Why:
generation solves *staleness of names* and creates *implied obligation* (“Available
shortcuts (43)”). Prefer a heading that says “bundled, all optional” plus
`tbd shortcut --list`. Do not hand-maintain counts in prose.

**F. Rewrite “Why tbd” so spec-driven and review-and-merge are one optional path.** Why:
that five-step list is the strongest all-or-nothing signal on the page.
Where: one paragraph on beads as the core; one on optional knowledge and workflows; the
numbered cycle only after “if you want that flow.”

**G. Say Quick Start can stop at beads.** Why: `setup-tbd` asking every unanswered
policy is fine; implying the user must answer them is not.
Where: one sentence next to the setup prompt: unanswered grants stay ask-first; “not
now” is valid; grant merge, stacks, sub-agents, or Linear later.

**H. Do not put the following in the README.** Detail that belongs elsewhere and will
rot: merge-gate checklist; review marker format; lettered finding IDs; disposition
vocabulary; policy-block example; per-policy coverage paragraphs; session-closing
protocol; worktree/attic/LWW; Linear `field_sync`; sub-agent tier research; hook script
names; PAT permission lists; `main`’s first-person “I use tbd most frequently…” and
concurrent-agent counts.
The Jan 2026 plan (`plan-2026-01-27-improve-readme-value-proposition.md`) pushed full
guideline tables and equal-weight pillars; do not revive that.
It produced the kitchen-sink `main` README.

## 7. Adoption Ladder

Present this as the spine, not a tip.
Four rungs, each sufficient to stop:

1. **Install the core.** `npm install -g get-tbd@latest`, then
   `tbd setup --auto --prefix=<name>` (or `--from-beads`). Beads work.
   Sync with `tbd sync`. This is a complete use.
2. **Pick surfaces.** Default setup writes portable, `AGENTS.md`, Claude, and Codex
   files, plus tier-agent definitions on #309. `--surfaces=` keeps only the generated
   agent files you want.
   Initialization, format migration, and the docs cache still run.
3. **Pick or replace guidelines and shortcuts.** Load none until a task needs one.
   Keep the standard set, keep a language/stack subset (`welcome-user` already asks),
   fork into `docs/tbd/` and edit, add your own from a URL, or point `docs_cache.files`
   / `docs_cache.local_dirs` at replacements.
   The bundled library is a default, not a contract.
4. **Set policies when a workflow needs them.** Grants in `AGENTS.md` are settable
   preferences for the whole project.
   Unanswered is ask-first (`confirm-every` for merge, `standard` for review
   requirements). Record `github-merge`, `pr-review-requirements`, `github-stacked-prs`,
   `subagents`, `linear`, or the GitHub editing/workflow grants only if you want that
   flow on a standing basis.

Web, watch, Linear, stacked PRs, the PR review lifecycle, and sub-agent delegation sit
on rungs 3–4. They are capabilities you turn on by asking, not a process you opt out of.

## 8. Freshness Strategy

**Allowed to inline (product pitch; change only with a deliberate README edit):**

1. Git-native beads: one Markdown file per issue, `tbd-sync` branch, no daemon, no
   SQLite.
2. The agent operates tbd; the user talks in natural language.
3. Layers above beads are optional; adoption is incremental.
4. Guidelines and shortcuts are a replaceable library (subset, fork, `--add`, config).
5. Policy grants are settable preferences in `AGENTS.md`.
6. `github-merge` is `never` | `confirm-every` | `confirm-session` (recommended) |
   `autonomous`; `pr-review-requirements` is a separate policy and still applies under
   `autonomous`.
7. Core CLI is a drop-in `bd` replacement.

Do not inline counts (“40+”, “43”, “46”). Do not inline the full policy table, merge
gate, or shortcut roster.

**Generate, do not hand-edit:** the shortcut / guideline / template regions via
`pnpm --filter get-tbd generate:readme`. `tests/readme-reference-tables.test.ts` fails
on drift. Generation writes root `README.md` only
(`packages/tbd/scripts/readme-reference-tables.ts`). The package README is a publish
copy, not a second source; on `main` it is not even in git.

**Link, do not copy:**

| Fact | Live source |
| --- | --- |
| Policy names, values, unanswered defaults | `agent-policy-grants.md` (#309) and `policy-grants.ts` |
| PR review stages, markers, merge gate | `tbd shortcut pr-review-workflows` and `review-and-merge-prs.md` (#309) |
| Setup questions and “not now” | `setup-tbd.md` (#309) |
| Guideline scope / visibility offer | `tbd shortcut welcome-user` |
| Command flags, integration, watch | `tbd docs show tbd-docs` |
| Architecture | `tbd design` |
| Operator rules | `tbd prime` / skill-baseline |

**Sync triangle.** `tbd-design.md` §1.1 says the four capabilities are “listed
identically in the README and the installed skill.”
If the README opening changes, update skill-baseline and §1.1 in the same change or they
will fight. That is the one intentional duplication; keep it to the four names plus
“optional.”

## 9. Draft Snippets

Repo voice: factual, second person, no intensifiers.
Matches #309, not `main`.

### Opening

```markdown
# tbd

**Git-native issue tracking for coding agents, plus optional workflows you adopt
incrementally.**

`tbd` stores issues (beads) as Markdown files on a dedicated sync branch: no daemon,
no database, and a drop-in replacement for [Beads](https://github.com/steveyegge/beads)
(`bd`).
You can stop there.

On top of that core, tbd can add spec-driven planning, on-demand engineering
guidelines, reusable workflow shortcuts, a live web board, Linear sync, a PR review
lifecycle, stacked PRs, and project-wide policy grants.
Each of those is optional. Install tbd, use beads, and pick up a layer when you want
it. You can use some of the bundled guidelines and shortcuts, or replace them with
your own.
```

### Optional, Incremental

```markdown
## Adopt Only What You Want

tbd is a kit. After install, each layer is optional:

1. **Beads.** `tbd setup --auto --prefix=<name>` is enough. Track work; run
   `tbd sync`. This is a complete use.
2. **Surfaces.** Setup can write agent files for Claude, Codex, and portable skills.
   `--surfaces=` keeps only the ones you want.
3. **Guidelines and shortcuts.** The bundled set is a default library. Load some,
   fork and edit some, add your own from a URL, or replace them in
   `.tbd/config.yml`. `tbd shortcut --list` and `tbd guidelines --list` are the live
   indexes. “What can I do with tbd?” runs the welcome shortcut, which also asks
   whether to keep all guidelines or a subset.
4. **Policies.** Grants in `AGENTS.md` are settable preferences, not a required
   ceremony. Unanswered stays ask-first. Say “not now” during setup, or record only
   the grants a workflow needs (`github-merge`, `pr-review-requirements`, `linear`,
   and the rest).

The PR review lifecycle, stacked PRs, Linear, `tbd web`, and `tbd watch` work the
same way: capabilities you turn on by asking for them.
```

## Notes for the Implementer

- Base the edit on the #309 README (`eca9187c` or later on that branch), after
  `tbd-6mmb` finishes any factual README touch-ups.
  Do not merge this review’s outline into a competing `README.md` rewrite on the same
  files.
- Root `README.md` is the source.
  Do not invent a second long-form package README.
- If the four-capability list changes wording, change skill-baseline and `tbd-design.md`
  §1.1 in the same PR.
- Keep `generate:readme` regions valid; run the generator if the appendix stays.
- Tone: no enthusiasm, no “unreasonably effective,” no first person.

## Addendum: User-supplied product pitch (2026-09-19)

The user supplied the product positioning after this review was written, then
course-corrected: do not implement the medium IA pass (no adoption-ladder rewrite, no
talking-table or policy cuts).
Keep the #309 README’s style, spirit, and structure.
Customize only the core-value and background framing.

**What landed:** a light opening edit on the #309 README. The talking table, policy and
merge sections, generated catalogs, and FAQ shape stay.

**Core value:** tbd is a skill and CLI that upgrades coding quality, task tracking, and
workflows for any coding agent.

**Philosophy:** give agents task tracking for longer unattended operation (beads),
better engineering knowledge (reusable guidelines), and better workflows (code reviews,
PR workflows, shortcuts), in a way that is **gradual** (use only what you want),
**customizable** (override or change skills and guidelines), and **batteries included**
(defaults include hard-learned practices).
Optionality is a clarification in that opening, not a new architecture for the page.

**History (one short beat):** tbd started in January 2026 as a better Beads and has
since extended to include improved workflows of many kinds.

Implementation bead: `tbd-eti9`. This review remains IA rationale only; the user chose
not to execute it.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
