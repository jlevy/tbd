---
title: Cut a Release
description: Cut and publish a new get-tbd release — version bump, release notes, tag-triggered npm publish
category: git
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Cut a new `get-tbd` release.
tbd does **not** use Changesets — releases are assembled directly from clean
conventional commits at release time and published automatically by a tag-triggered
GitHub Action.

## How releases work here

- **No `.changeset/` files, no “Version Packages” PR.** The agent (or maintainer)
  composes the release notes from the commits since the last tag.
- **`.github/workflows/release.yml` publishes on a `v*` tag push**: it builds, runs
  `publint`, publishes `get-tbd` to npm, and creates a GitHub Release whose body is the
  matching `## X.Y.Z` section of `packages/tbd/CHANGELOG.md`.
- So the only things you produce are: a version bump, a `CHANGELOG.md` section, and a
  tag.

## Process

Create a to-do list with these items and do them in order:

1. **Start clean on latest main.**
   - `git checkout main && git pull` ; confirm a clean working tree.
   - `git fetch --tags` and find the last release: `git describe --tags --abbrev=0`.

2. **Review the delta and choose the version.**
   - Review `git log <last-tag>..HEAD` (and `git diff <last-tag>..HEAD --stat`).
   - Pick the bump from the conventional commits (a `feat` → minor, `fix`/`chore`/`docs`
     → patch, `!`/`BREAKING CHANGE` → major).
     **Note for `0.x`: a semver *minor* is `0.MINOR.0` (e.g. `0.1.29` → `0.2.0`), not
     `0.1.30`.** If the user gave an explicit number, use it and reconcile the bump type
     to match.

3. **Write the release notes** following `tbd guidelines release-notes-guidelines`
   (describe the aggregate delta, consolidate a feature with its own fixes, write from
   the user’s perspective, skip internal-only/CI/test-only changes).

4. **Apply the bump on a release branch.**

   - `git checkout -b claude/release-vX.Y.Z`

   - Set `version` in `packages/tbd/package.json` to `X.Y.Z`.

   - Prepend a section to `packages/tbd/CHANGELOG.md` (the heading MUST be exactly
     `## X.Y.Z` — `release.yml` greps for it):

     ```markdown
     ## X.Y.Z

     <release notes per the guideline>
     ```

5. **Verify locally:** `pnpm release:verify` (build and publint) and `pnpm test`.

6. **Open and merge the release PR.**
   - Commit `chore: release get-tbd vX.Y.Z`, push, open a PR to `main`.
   - Wait for CI green (`gh pr checks <n> --watch`), then merge.

7. **Tag to publish.** On updated `main`, create and push the tag:
   - `git tag vX.Y.Z && git push origin vX.Y.Z` (if a sandbox blocks tag pushes, create
     the ref via the API:
     `gh api repos/<owner>/<repo>/git/refs -f ref=refs/tags/vX.Y.Z -f sha=$(git rev-parse main)`).
   - This triggers `release.yml`.

8. **Verify the release** once the workflow finishes:
   - `gh run watch <id> --exit-status`
   - `npm view get-tbd@X.Y.Z version` and `gh release view vX.Y.Z`.

## Notes

- Keep commits clean and conventional (`tbd guidelines commit-conventions`) — they are
  the raw material for the notes.
- Generated/dogfooded artifacts (`.claude`/`.codex` session scripts, `.agents/skills`,
  `AGENTS.md`) pin the install-time version; refresh them with `tbd setup --auto` after
  a release if you want their pins to match the new version.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
