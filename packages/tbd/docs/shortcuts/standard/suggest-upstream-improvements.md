---
title: Suggest Upstream Improvements
description: Review local doc-fork customizations and contribute the generally useful changes back upstream
category: meta
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut reviews the docs this project has forked and customized (in `docs/tbd/`),
decides which changes generalize beyond this project, and proposes them upstream, to the
tbd repo for tbd’s bundled docs, or to your org’s docs repo for docs added by URL.

## When to Use

- Forked guidelines or shortcuts have accumulated edits that would help other projects.
- Before unforking: upstream the good parts first, so nothing is lost when the fork goes
  away.
- After `tbd docs update` keeps producing the same conflict because upstream lacks an
  improvement you made locally.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Collect customizations**: Run `tbd docs status --json` and collect every doc in
   `customized` state (including customized docs that also have upstream updates
   pending) **and every doc in `local` state** (new docs this project wrote that do not
   exist upstream).

2. **Review each change**: For each `customized` doc, run `tbd docs diff <name> --base`
   (your file vs its recorded base, exactly what this project changed).
   For each `local` doc there is no base: review the whole doc.
   Classify each hunk (or, for local docs, the doc as a whole):
   - **Generally applicable**: fixes, clarifications, better examples, rules any project
     would benefit from. Candidates for upstreaming.
     A generalizable `local` doc is proposed as a **new bundled doc**.
   - **Project-specific**: team conventions, internal links, stack-specific overrides.
     These stay in the fork; do not propose them.

3. **Identify the upstream target** for each doc with generalizable hunks:
   - Bundled docs (manifest `source` starts with `internal:`): the tbd repo
     (`jlevy/tbd`), where doc sources live under `packages/tbd/docs/`.
   - URL-added docs: the repo their docref points at (for example, your org’s shared
     docs repo).

4. **Draft the proposal**: For each doc, draft an issue or PR body containing:
   - Which doc (name and kind) and why the change is generally useful.
   - Only the generalizable diff hunks, in fenced code blocks.
   - Brief project context: what prompted the change here.

5. **Confirm, then file**: Show the draft to the user and get confirmation.
   Then:
   - Issue: `gh issue create -R jlevy/tbd` (or the org’s repo) with the drafted body.
   - PR (preferred when the change is small and ready): apply the generalizable hunks to
     the upstream source file on a branch and open a PR with `gh pr create`.

6. **Close the loop (after upstream merges)**: Once the change ships upstream and tbd is
   upgraded, run `tbd docs update`. If upstream adopted the customization, the merge
   converges and the doc returns to unmodified `forked` state, then a plain
   `tbd docs unfork <name>` (no `--force` needed) completes the cleanup, or keep the
   fork for future edits.
   For a `local` doc adopted upstream there is no automatic transition: once the bundled
   version exists, run `tbd docs fork <name> --force` to convert your copy into a
   tracked fork (this overwrites the file with the upstream version; `git diff` then
   shows anything upstream changed relative to your copy).
   If the copies match, a plain `tbd docs unfork <name>` completes the cleanup, or keep
   the fork for future edits.

## Notes

- Only propose hunks you would accept as a maintainer: each should stand alone, with
  rationale.
- Never file an issue or PR without showing the user the draft first.
- Diff views: `tbd docs diff <name>` (no flag) compares your copy against current
  upstream; `--base` is the right view for “what did we change”; `--upstream` shows
  incoming upstream changes.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
