# Publishing (npm)

This project uses **tag-based releases** with provenance attestation to npm (no
Changesets). Version and release notes are assembled by hand from clean conventional
commits at release time; pushing a `v*` tag publishes automatically.
For the guided end-to-end flow, run `tbd shortcut cut-release`.

For daily development workflow, see [development.md](../../development.md).
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
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline
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
#    release.yml greps for it to build the GitHub Release body):
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

```bash
# Review changes since last release
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline

# Write release notes to release-notes.md or prepare for PR body
```

### Step 6: Push and Tag

**Option A: Direct git push (local development)**

```bash
git push
git tag vX.X.X
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

# Get merge commit SHA and create tag
MERGE_SHA=$(gh pr view <pr-number> -R jlevy/tbd --json mergeCommit -q '.mergeCommit.oid')
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
git push && git tag v0.2.0 && git push --tags

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
