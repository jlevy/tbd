---
title: tbd Agent-CLI Guideline Improvements (from Clerk/Render/Convex review)
description: Plan to improve the tbd `cli-agent-skill-patterns` guideline based on a review of the Clerk, Render, and Convex agent-skill bundles
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: tbd Agent-CLI Guideline Improvements (from Clerk/Render/Convex review)

**Date:** 2026-06-03 (last updated 2026-06-03)

**Author:** Joshua Levy

**Status:** Completed—reconciled into the concise core and on-demand references for
issue #190. The original vendor observations remain evidence, while the durable guidance
avoids freezing vendor counts or promoting optional platform metadata to a portable
requirement.

> **tbd repo context (added on import).** This plan and its companion research doc were
> authored in the `finterm-main` repo (where the three vendor bundles are installed) and
> moved here because the guideline they target lives in *this* repo.
> The finterm originals are archived under `finterm-main/attic/moved-to-tbd-repo/`. When
> folding findings into the guideline, keep the research doc’s caveats in view: bundle
> versions weren’t pinned at observation time, the sample is n=3 of a single
> (infra/platform) genre, and several “gaps” are defensible vendor trade-offs rather
> than flat mistakes — so prefer the high-confidence, multiply-corroborated patterns
> first.

## Overview

We installed three major vendor agent-skill bundles — **Clerk** (~21 skills + `clerk`
CLI), **Render** (~21 skills + `render` CLI + hosted MCP), and **Convex** (6 skills +
`npx convex ai-files`) — into the `finterm-main` repo and reviewed each thoroughly
against our own `tbd guidelines cli-agent-skill-patterns`.

This spec captures the resulting **improvements to the tbd guideline itself** (and,
where relevant, to how tbd installs/stamps its own skills).
It is a guideline/docs change, not a product feature.
The full evidence-backed analysis lives in
[research-agent-skill-cli-practices-clerk-render-convex.md](../../research/current/research-agent-skill-cli-practices-clerk-render-convex.md).

## Goals

- Fold the **novel, validated patterns** the three vendors use (and our guideline does
  not yet cover) into `cli-agent-skill-patterns` as concrete, evidenced sections.
- **Harden** the guideline’s existing rules in the five areas where *every* vendor got
  it wrong (pinning, generated-artifact stamping, `allowed-tools`, listing-slot
  economics, full portability), so a reader copying any single vendor would be
  corrected.
- Take a **clearer, defensible stance on CLI-vs-MCP**, given that Render’s bundle
  inverts our current preference.
- Keep the guideline **non-dogmatic** and ladder-shaped (L0–L3): every addition states
  *which rung it applies to* so simple skills stay simple.

## Non-Goals

- Rewriting or re-authoring the vendor bundles themselves (Clerk/Render/Convex).
  This is about our guideline; vendor fixes, if any, are out of scope here.
- Changing tbd’s CLI runtime behavior beyond what is needed to keep tbd’s own skill the
  reference implementation the guideline cites.
- Building an evals/test harness for skills now (we will *document* the convention; an
  implementation is a separate future bead if desired).
- Any change to unrelated guidelines.

## Background

`cli-agent-skill-patterns` (last updated 2026-05-31) is already a strong,
research-backed guideline: the L0–L3 ladder, progressive disclosure,
route-don’t-restate, the meta-skill listing-budget argument, distribution/install
hygiene, and supply-chain pinning.
The review found that real shipped vendor bundles **validate most of it** but also
surface (a) genuinely new patterns worth promoting and (b) recurring mistakes the
guideline should call out more forcefully because three independent, sophisticated
vendors all made them.

Key empirical findings (see review doc for evidence and file:line cites):

- **Distribution diverges three ways** and none matches our “portable canonical + Claude
  mirror (copy, not symlink)” model: Clerk commits `.claude` **symlinks**; Render is
  **Claude-only** (no `.agents/` copy); Convex is **portable-only, subdir-scoped** (no
  `.claude` mirror).
- **All three leave zero-install runners unpinned** (`@latest`).
- **None stamps generated skills** with a `format=fNN` / `DO NOT EDIT` marker, so none
  can safely re-sync.
- **`allowed-tools` is rarely/never scoped** (Clerk partial; Render/Convex none).
- **Listing-slot economics are ignored** — routers aid navigation but not budget.
- Clerk’s **CLI agent-mode contract** (sandbox warn-once, `doctor --json` remedies,
  dry-run gating, deploy handoff, `--input-json`) is ahead of our guideline.
- Convex’s **`agents/openai.yaml` Codex companion** is a clean reference our guideline
  treats only as optional polish.
- Render **inverts CLI-vs-MCP** ("MCP preferred, CLI fallback"), contradicting us.

## Design

### Approach

Edit `cli-agent-skill-patterns` in place: **add** new subsections for the uncovered
patterns and **strengthen** existing rules with vendor-evidenced callouts.
Each edit is tagged with the ladder rung it applies to so the simple baseline (§0) stays
untouched.
Where a pattern is now a recommendation (not just “exists”), add it to the §11
Best-Practices Summary and the §12 Integration Checklist.
Cite the vendor bundles as worked examples the way the guideline already cites `tbd`,
`qmd`, `gstack`, `bd`.

The guideline’s canonical source lives in *this* repo at
[packages/tbd/docs/guidelines/cli-agent-skill-patterns.md](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md)
and ships to consumers via `tbd guidelines`. Edits land directly there.

### Components

Sections of `cli-agent-skill-patterns` to touch:

- **§4 (Writing a great SKILL.md)** — add the symmetric **“When to Use / When Not to
  Use”** convention (Convex) and the **“Guardrails / Escalate Larger Fixes”** section
  type (Convex) for skills that can trigger invasive changes.
- **§4.4 (Test the skill)** — add the **`evals/evals.json` + scaffold-fixture**
  acceptance convention (Clerk) as a concrete option.
- **§5 (Per-agent reference) / Codex** — promote **`agents/openai.yaml`** from “optional
  polish” to a documented recommended shape, including
  `policy.allow_implicit_invocation` as an explicit activation knob and per-skill
  branding (`brand_color`, icon).
- **§6.5 (Agent-friendly CLI)** — add three patterns: the **sandbox/host “warn-once +
  untrusted-until-rerun-on-host” contract** (Clerk); **`doctor --json` with per-check
  `remedy`/`fix` + a remediation table** (Clerk); the **interactive “handoff” + separate
  verification-gate** pattern and **deeplink-to-Dashboard** handoff (Clerk/Render); and
  the **“save big output to file, then `jq`”** context-budget discipline (Clerk).
  Also add **`--input-json`** universal flag-expansion as an ergonomics option.
- **§6.6 (Distribution/install)** — strengthen with a **portability matrix** showing the
  three vendor layouts and why each is incomplete; reinforce **copy-not-symlink** for
  committed mirrors (Clerk’s committed symlinks as the counter-example); cover
  **subdir-scoped skills in a monorepo** (Convex) as a legitimate pattern with its
  discovery caveat (Claude won’t see them without a mirror).
- **§6.6 + §3.2** — add the **`assets/` runnable-template library** as a distinct
  resource class (Render), separate from prose references.
- **§6.6 / new** — add **hash-tracked generated-guidance refresh**
  (`ai-files.state.json`, Convex) as a distribution channel complementary to skills, and
  note the **context cost** of an “always read this generated file first” `CLAUDE.md`
  directive vs on-demand activation.
- **§6.7 / §9 (Pinning/security)** — add a **vendor-evidenced “everyone gets this wrong”
  callout**: Clerk `bunx clerk@latest`, Convex `npx convex` ×39, Clerk templates pinned
  to `"latest"`. Reinforce the pin rule and extend it to **scaffolded template
  dependencies**, not just the runner.
- **§6.6 (Generated artifacts)** — add an **“every vendor skipped this” callout** that
  none stamps `format=fNN` / `DO NOT EDIT`, making safe re-sync impossible; reaffirm the
  rule for L2/L3.
- **§7 (CLI vs MCP)** — add a **balanced reconciliation**: document *why* a vendor ships
  a hosted MCP as primary (managed auth, no local binary to install/bootstrap, remote
  capabilities), state when that legitimately outweighs the CLI cost argument, and keep
  our default (prefer CLI when one exists) with the trade-off made explicit rather than
  absolute. Use Render as the worked counter-example.
- **§4.3 / §6.1 (Listing budget)** — add the **vendor slot-count evidence** (Clerk 21,
  Render 21, Convex 6; routers help routing not budget) to sharpen the meta-skill
  argument, and note the **lightweight-router** pattern (Convex’s 53-line router) as a
  partial mitigation that still costs N slots.
- **§11 Summary + §12 Checklist** — reflect all of the above as new bullets/checklist
  items, each tagged with its ladder rung.

### API Changes

None (documentation/guideline change).
If we decide tbd’s own skill should demonstrate a newly recommended pattern (e.g. an
`agents/openai.yaml` companion, or an `evals.json`), that becomes a small follow-on bead
against the tbd skill generator, not part of this guideline edit.

## Implementation Plan

### Final Disposition

The issue #190 rewrite incorporated the still-relevant findings as follows:

- The core now requires activation boundaries, safety and escalation boundaries,
  realistic prompt checks, narrow `allowed-tools`, published pins, and drift-tested
  portable bundles.
- `agent-skill-distribution` covers complete discovery directories, project/user scope,
  copy/symlink trade-offs, double-pinned automation, package-runner permission risks,
  and published-release fallback selection.
- `agent-skill-bundle-publication` treats references, scripts, and assets as one logical
  unit with ownership, forward-compatibility, failure, and stale-file tests.
- `agent-platform-integration` covers optional evaluation fixtures, structured doctor
  remedies, sandbox boundaries, handoff and verification, large-output materialization,
  structured input, hooks, MCP trade-offs, and Codex metadata/plugins.
- `agents/openai.yaml` remains optional, matching current Codex documentation; vendor
  slot counts and changing directory matrices were deliberately replaced with stable
  decision rules and links to current primary documentation.

No untracked runtime change remains from this plan.
Runtime behavior discovered during the issue #190 audit is tracked by the setup dry-run
and doctor-drift beads under that epic.

### Phase 1: Revise the guideline

- [ ] Confirm the canonical edit target for `cli-agent-skill-patterns` (tbd package
  source vs project-level shadow in `.tbd/docs/guidelines/`) — see Open Questions.
- [ ] **Strengthen existing rules** with vendor-evidenced callouts: pinning (incl.
  scaffolded template deps), `format=fNN`/`DO NOT EDIT` stamping, `allowed-tools`
  scoping, listing-slot economics, full portability (copy-not-symlink; the three-way
  portability matrix).
- [ ] **Add new pattern subsections**: When-to/Not-to-Use + Guardrails (§4); sandbox
  warn-once contract, `doctor --json` remedies, interactive handoff + verification gate,
  deeplink handoff, file-then-`jq`, `--input-json` (§6.5); `agents/openai.yaml`
  recommended shape + `allow_implicit_invocation` (§5/Codex); `evals.json` + scaffold
  convention (§4.4); `assets/` template-library resource class (§3.2/§6.6); hash-tracked
  generated-guidance refresh + context-cost note (§6.6).
- [ ] **Reconcile CLI-vs-MCP** (§7) with the balanced stance and Render counter-example.
- [ ] Update **§11 Summary** and **§12 Checklist**; tag each addition with its L0–L3
  rung.
- [ ] Update the guideline’s **“Last Updated”** line and add the three bundles to the
  worked-examples/References list.
- [ ] Verify all internal section cross-references still resolve; format with
  **flowmark** (never Prettier); keep the doc-guidelines footer.
- [ ] (If in scope) file a small follow-on bead to make **tbd’s own generated skill**
  demonstrate any newly recommended pattern, so the reference implementation stays ahead
  of the guideline.

## Testing Strategy

- This is a documentation change; “tests” are review-based.
- Re-read the revised guideline end-to-end for internal consistency: every new rule
  states its ladder rung; nothing contradicts §0’s simple baseline.
- Confirm each new claim is backed by a real, citable example in the vendor bundles (the
  review doc is the evidence index).
- Confirm cross-references resolve and the doc passes flowmark with no diff.
- Sanity check against the guideline’s own meta-rule: the additions must not bloat the
  simple path — a one-capability author should still be “done after §0”.

## Rollout Plan

- Land the edit in the tbd guideline source of truth; it ships to consumers via the
  normal tbd release/`tbd guidelines` mechanism.
- If a project-level shadow is used in the interim, note it so it can be upstreamed.

## Open Questions

- **Edit location:** ~~resolved~~ — now that this plan lives in the tbd repo, the
  canonical edit target is `packages/tbd/docs/guidelines/cli-agent-skill-patterns.md`
  here; no project-level shadow is needed.
- **CLI-vs-MCP stance:** confirm we keep “prefer CLI when one exists” as the *default*
  rather than softening to neutral — the review recommends keeping the default but
  making the trade-off explicit.
  Confirm this is the intended editorial line.
- **Scope of tbd self-demonstration:** do we want tbd’s own skill to add an
  `agents/openai.yaml` companion and/or an `evals.json` as part of this work, or track
  that separately?

## References

- Research / evidence:
  [research-agent-skill-cli-practices-clerk-render-convex.md](../../research/current/research-agent-skill-cli-practices-clerk-render-convex.md)
- Current guideline:
  [packages/tbd/docs/guidelines/cli-agent-skill-patterns.md](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md)
  (also `tbd guidelines cli-agent-skill-patterns`)
- Vendor bundles (in `finterm-main`): `.agents/skills/clerk*`,
  `.claude/skills/render-*`, `finterm-web/.agents/skills/convex*`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
