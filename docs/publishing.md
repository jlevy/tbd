# Publishing (npm)

This is the get-tbd project’s own release flow.
It is **not** a general-purpose shortcut shipped to tbd users — releasing a Node package
is project-specific, so the content lives here in the project repo, not in
`packages/tbd/docs/shortcuts/standard/`.

This project uses **tag-based releases** with provenance attestation to npm (no
Changesets). Version and release notes are assembled by hand from clean conventional
commits at release time; pushing a `v*` tag publishes automatically.

For daily development workflow, see [development.md](development.md).
For release notes format and guidelines, see `tbd guidelines release-notes-guidelines`.

## One-Time Setup

Before the first release, complete these steps:

### 1. Manual First Publish

The package must exist on npm before automated releases can work.

**IMPORTANT**: Create the git tag FIRST, then build.
The version is baked in at build time from git tags.
If you build before tagging, you’ll get a `-dev.N.hash` version suffix.

```bash
cd packages/tbd

# 1. Create and push the tag FIRST (so build sees the correct version)
git tag v0.1.0
git push --tags

# 2. Build (now getGitVersion() will return "0.1.0" not "0.1.0-dev.N.hash")
pnpm build

# 3. Publish
npm publish --access public
```

This will prompt for web-based authentication in your browser.

### 2. Configure NPM_TOKEN Secret

1. Generate an npm access token at https://www.npmjs.com/settings/~/tokens
   - Select “Automation” type for CI/CD use
2. Add the token as a repository secret:
   - Go to https://github.com/jlevy/tbd/settings/secrets/actions
   - Add secret named `NPM_TOKEN` with the token value

### 3. Verify Repository Setup

- Repository must be public for provenance attestation
- Ensure the release workflow at `.github/workflows/release.yml` has `id-token: write`
  permission

## During Development

Merge PRs to `main` with clean, conventional commits.
There are no changeset files — the version bump and release notes are assembled from the
commits at release time.

## Release Workflow

Follow these steps to publish a new version.

### Step 1: Prepare

```bash
git checkout main
git pull
git status  # Must be clean
```

### Step 2: Determine Version

Review changes since last release:

```bash
PREV=$(git describe --tags --abbrev=0)
git log $PREV..HEAD --oneline

# Releases are not code-only: also review shipped content that users invoke
# (bundled guidelines, skills, shortcuts, templates) — its changes belong in the notes.
git diff --stat $PREV..HEAD -- 'packages/tbd/docs/guidelines/**' \
  'packages/tbd/docs/shortcuts/**'
```

Choose version bump:

- `patch` (0.1.0 → 0.1.1): Bug fixes, docs, internal changes
- `minor` (0.1.0 → 0.2.0): New features, non-breaking changes
- `major` (0.1.0 → 1.0.0): Breaking changes

### Step 3: Supply-Chain Review

Before bumping the version, review every dependency change since the previous release.
Recent npm supply-chain attacks (typosquatted packages, hijacked maintainer accounts,
post-install scripts) make this step non-optional even when the manifests look clean.

#### 3a. Diff manifests and lockfile

```bash
PREV=$(git describe --tags --abbrev=0)

# Manifest changes (what the project intended)
git diff $PREV..HEAD -- '**/package.json'

# Lockfile delta (what actually gets installed, including transitives)
git diff $PREV..HEAD -- pnpm-lock.yaml | head -200

# Hash check: if lockfile is byte-identical, the resolved tree is unchanged
sha256sum pnpm-lock.yaml
git show $PREV:pnpm-lock.yaml | sha256sum
```

If the lockfile hash is unchanged, the resolved dependency tree is identical to the
previous release — record this in the release notes and skip to 3c.

For each lockfile change, classify it:

- **New direct dependency**: review on npm (publish date, maintainers, weekly downloads,
  provenance attestation), check `package.json` for `scripts` entries (`preinstall`,
  `install`, `postinstall`).
- **Removed dependency**: confirm intentional.
- **Version bump**: skim the upstream CHANGELOG and diff between the two versions on
  https://diffs.dev or `npm diff <pkg>@<old> <pkg>@<new>`. Treat large unexpected diffs
  as a stop sign.
- **New transitive dependency**: same scrutiny as a new direct dep — supply-chain
  attacks often arrive through deep transitives.

#### 3b. Vulnerability audit

```bash
pnpm audit                   # All advisories
pnpm audit --prod            # Runtime-only (shipped to users)
```

Triage:

- **Runtime advisories** (paths through `packages/tbd>...` that don’t traverse dev
  tooling): treat as release-blockers unless the impact is documented as
  out-of-threat-model.
  Fix by bumping the affected dependency.
- **Dev-only advisories** (paths through `vitest`, `c8`, `tsdown`, `typescript-eslint`,
  `eslint`, `prettier`, `lefthook`, etc.): note them but do not block release.

#### 3c. Package-age and provenance check

```bash
pnpm check:package-age       # Enforces the 14-day rule
```

For any newly added direct dependency, manually verify on npm:

- Publication date >=14 days old for the resolved version
- Maintainer list is recognizable / unchanged from the prior release
- Provenance attestation present where the upstream publishes with one:
  `npm view <pkg>@<version> --json | jq '.dist.attestations // "none"'`

#### 3d. Record findings

Capture the audit summary in `release-notes.md` under a `### Security` section whenever
there is anything notable (lockfile changes, new advisories, deferred fixes, new direct
dependencies). If the lockfile is byte-identical and no new advisories landed, a single
sentence ("Lockfile unchanged since vX.X.X; no new advisories.") is enough.

### Step 4: Bump Version & Update CHANGELOG

No Changesets — bump by hand on a `claude/release-vX.X.X` branch:

```bash
# 1. Set "version" in packages/tbd/package.json to X.X.X
# 2. Prepend a section to packages/tbd/CHANGELOG.md (heading MUST be exactly "## X.X.X" —
#    release.yml's extractor matches that exact heading to build the GitHub Release body):
#
#    ## X.X.X
#
#    <release notes — see Step 5>
```

The notes you write here ARE the release notes (Step 5); there is no separate changeset
summary to keep in sync.

### Step 5: Write Release Notes

Write the `## X.X.X` CHANGELOG section following
`tbd guidelines release-notes-guidelines`.

The `## X.X.X` section you write in `CHANGELOG.md` is the single source of truth: at tag
time `release.yml` extracts it (via `packages/tbd/scripts/extract-changelog.ts`) to
populate the GitHub Release body.
`release-notes.md` is a transient, git-ignored working file — regenerate it from the
committed CHANGELOG whenever you need a `--body-file` for a PR or `gh release edit`:

```bash
# Review changes since last release
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline

# Generate the PR/release body from the CHANGELOG section you just wrote
pnpm exec tsx packages/tbd/scripts/extract-changelog.ts X.X.X > release-notes.md
```

### Step 6: Push and Tag

**Before tagging: main CI MUST have reached `conclusion=success` on the exact commit you
are about to tag.** “Mostly green” is not green.
If a job hangs (e.g., the known `tests/lockfile.test.ts` flake on Windows), cancel and
rerun the failed job — do not tag past it.

`release.yml` is independent of `ci.yml` (it triggers on the tag push, runs on
`ubuntu-latest` only).
The release will still publish successfully even if main CI is in_progress or red — but
that is a process failure: it ships work that was not confirmed to pass tests on the
merge commit. Wait for green **on the merge commit itself**, not just “main is usually
green” — right after a push/merge, an unfiltered query can return the *previous* run.

The gate below is written once and reused by both options.
It always filters by `$MERGE_SHA` (the commit being tagged), verifies the run is
actually for that SHA, and watches it to completion:

```bash
# Gate: wait for main CI success on the commit being tagged. $MERGE_SHA must be set
# by the option below before running this.
RUN_ID=$(gh run list -R jlevy/tbd --branch main --workflow=ci.yml \
  --commit "$MERGE_SHA" --json databaseId,headSha --jq '.[0].databaseId')
# If RUN_ID is empty, the run for this SHA has not been created yet — wait and retry.
gh run watch "$RUN_ID" -R jlevy/tbd --exit-status   # nonzero exit if the run fails
# Confirm it is the right commit and green before tagging:
gh run view "$RUN_ID" -R jlevy/tbd --json headSha,conclusion \
  --jq 'select(.headSha=="'"$MERGE_SHA"'" and .conclusion=="success") | "OK"'
# Expect: "OK". Only tag if you see it.
```

**Option A: Direct git push (local development)**

```bash
git push
MERGE_SHA=$(git rev-parse HEAD)   # the commit you just pushed to main
# ... run the gate above (waits for main CI success on $MERGE_SHA) ...
git tag "vX.X.X" "$MERGE_SHA"
git push --tags
```

**Option B: Via PR and GitHub API (restricted environments)**

When direct push to main is restricted:

```bash
# Push to feature branch
git push -u origin <branch-name>

# Create and merge PR (use release notes in body)
gh pr create -R jlevy/tbd --base main --head <branch-name> \
  --title "chore: release get-tbd vX.X.X" \
  --body-file release-notes.md
gh pr merge <pr-number> -R jlevy/tbd --merge

# Get the merge commit SHA, gate on its main CI, then tag
MERGE_SHA=$(gh pr view <pr-number> -R jlevy/tbd --json mergeCommit -q '.mergeCommit.oid')
# ... run the gate above (waits for main CI success on $MERGE_SHA) ...
gh api repos/jlevy/tbd/git/refs -X POST \
  -f ref="refs/tags/vX.X.X" \
  -f sha="$MERGE_SHA"
```

### Step 7: Update GitHub Release

After the release workflow completes:

```bash
# Wait for release workflow
gh run list -R jlevy/tbd --limit 3

# Update release notes
gh release edit vX.X.X -R jlevy/tbd --notes-file release-notes.md
```

### Step 8: Verify

```bash
gh release view vX.X.X -R jlevy/tbd
npm view get-tbd

# The GH Release body MUST be the "## X.Y.Z" CHANGELOG section, not the
# fallback "Release vX.Y.Z" string. v0.1.30 and v0.2.0 both shipped with the
# fallback because release.yml's awk extractor was broken. Confirm explicitly:
gh release view vX.X.X --json body --jq '.body' | head -5
# If you see just "Release vX.Y.Z", the workflow regressed — fix release.yml
# (see tbd-xk7c) and `gh release edit` the body in for the current release.
```

## Quick Reference

### Local Development (direct push)

```bash
git checkout main && git pull

# Supply-chain review (Step 3) — never skip
PREV=$(git describe --tags --abbrev=0)
git diff $PREV..HEAD -- '**/package.json' pnpm-lock.yaml | less
pnpm audit && pnpm check:package-age

# Bump packages/tbd/package.json to 0.2.0 and prepend a "## 0.2.0" CHANGELOG section
git add . && git commit -m "chore: release get-tbd v0.2.0"

# Write release notes (see release-notes-guidelines.md)
git push
# GATE: wait for main CI success on the pushed commit BEFORE tagging (see Step 6).
MERGE_SHA=$(git rev-parse HEAD)
RUN_ID=$(gh run list -R jlevy/tbd --branch main --workflow=ci.yml \
  --commit "$MERGE_SHA" --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" -R jlevy/tbd --exit-status   # only proceed if this succeeds
git tag v0.2.0 "$MERGE_SHA" && git push --tags

# Update GitHub release after workflow completes
gh release edit v0.2.0 -R jlevy/tbd --notes-file release-notes.md
```

### Restricted Environments (via PR and API)

```bash
# Supply-chain review (Step 3) — never skip
PREV=$(git describe --tags --abbrev=0)
git diff $PREV..HEAD -- '**/package.json' pnpm-lock.yaml | less
pnpm audit && pnpm check:package-age

# Bump packages/tbd/package.json to 0.2.0 and prepend a "## 0.2.0" CHANGELOG section
git add . && git commit -m "chore: release get-tbd v0.2.0"

# Write release notes, push to branch
git push -u origin <branch-name>

# Create PR, merge, tag via API
gh pr create -R jlevy/tbd --base main --head <branch-name> \
  --title "chore: release get-tbd v0.2.0" --body-file release-notes.md
gh pr merge <pr-number> -R jlevy/tbd --merge
MERGE_SHA=$(gh pr view <pr-number> -R jlevy/tbd --json mergeCommit -q '.mergeCommit.oid')
# GATE: wait for main CI success on the merge commit BEFORE tagging (see Step 6).
RUN_ID=$(gh run list -R jlevy/tbd --branch main --workflow=ci.yml \
  --commit "$MERGE_SHA" --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" -R jlevy/tbd --exit-status   # only proceed if this succeeds
gh api repos/jlevy/tbd/git/refs -X POST -f ref="refs/tags/v0.2.0" -f sha="$MERGE_SHA"

# Update GitHub release after workflow completes
gh release edit v0.2.0 -R jlevy/tbd --notes-file release-notes.md
```

## How Publishing Works

This project uses npm token-based publishing with provenance:

- **NPM_TOKEN secret**: Repository secret containing npm automation token
- **Provenance attestation**: `NPM_CONFIG_PROVENANCE=true` adds signed build provenance

The release workflow (`.github/workflows/release.yml`) triggers on `v*` tags and
publishes automatically.

## GitHub Releases

The release workflow automatically creates a GitHub Release when a tag is pushed:

- **Release name**: Matches the tag (e.g., `v0.2.0`)
- **Release notes**: Initially extracted from CHANGELOG; update with formatted notes
- **Pre-release flag**: Automatically set for versions containing `-` (e.g.,
  `1.0.0-beta.1`)

After pushing a tag:

1. Verify the release appears at: https://github.com/jlevy/tbd/releases
2. Update the release with formatted notes (Step 8 above)

## Troubleshooting

**Release workflow not running?**

- Ensure tag format is `v*` (e.g., `v0.2.0`)
- Check tag was pushed: `git ls-remote --tags origin`

**npm publish failing with 401/403?**

- Verify `NPM_TOKEN` secret is configured in repository settings
- Check the token hasn’t expired
- Ensure token has publish permissions for `get-tbd`

**First publish?**

- The package must already exist on npm before the workflow can publish
- Do a manual `npm publish --access public` first from `packages/tbd` directory

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
