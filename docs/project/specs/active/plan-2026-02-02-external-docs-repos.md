---
title: External Docs Repos
description: Pull shortcuts, guidelines, and templates from external git repositories
---
# Feature: External Docs Repos

**Date:** 2026-02-02 (last updated 2026-02-02)

**Status:** Draft

## Overview

Enable tbd to pull documentation (shortcuts, guidelines, templates) from external git
repositories, in addition to the current bundled internal docs.
This allows:

- Community-maintained docs that evolve independently of tbd releases
- Project-specific doc repos that can be shared across teams
- “Bleeding edge” guidelines that update more frequently than tbd npm releases
- Potential simplification by moving general-purpose docs out of the tbd codebase

## Goals

- Allow configuring external git repos as doc sources
- Support selective sync (only certain folders/types from a repo)
- Maintain backward compatibility with existing `internal:` and URL sources
- Make sync work seamlessly with repo sources (checkout on first sync, pull on
  subsequent)
- Keep configuration simple and declarative

## Non-Goals

- Full-featured git client (complex merge conflict resolution, etc.)
- Support for private repos requiring complex auth (initially - may add later)
- Real-time sync or webhooks
- Bidirectional sync (external repos are read-only sources)

## Background

### Current State

The `docs_cache` system currently supports two source types:

1. **`internal:`** - Bundled docs shipped with tbd (in `packages/tbd/docs/`)
2. **URLs** - Direct HTTP/HTTPS links to raw files

The config in `.tbd/config.yml` maps destination paths to sources:

```yaml
docs_cache:
  files:
    guidelines/typescript-rules.md: internal:guidelines/typescript-rules.md
    shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md
    # URL sources work but require per-file specification:
    shortcuts/custom/my-shortcut.md: https://raw.githubusercontent.com/org/repo/main/shortcuts/my-shortcut.md
```

### Problems with Current Approach

1. **URL sources require per-file enumeration** - Can’t say “all guidelines from this
   repo”
2. **No auto-discovery** - Adding a new guideline to an external repo requires config
   changes
3. **tbd-specific docs mixed with general docs** - Guidelines like `typescript-rules.md`
   are general, but shipped with tbd
4. **Updates tied to tbd releases** - New or improved guidelines require npm publish

### The Dependency Problem

Some docs reference tbd itself:

- **tbd-specific**: `code-review-and-commit.md` references
  `tbd shortcut precommit-process`
- **General**: `typescript-rules.md` has no tbd dependencies

This creates a design consideration: where should each type live?

**Option A: Categorize by dependency**

- tbd-specific docs remain `internal:`
- General docs move to external repo(s)

**Option B: Explicit dependency declaration**

- Docs declare dependencies in front matter: `requires: [tbd]`
- Sync validates dependencies

**Recommendation:** Option A is simpler and probably sufficient.
tbd-specific shortcuts naturally belong in the tbd codebase.
General guidelines can be externalized.

## Design

### Approach

Add a new source type: `repo:` sources that specify a git repository, branch/tag, and
path pattern. On sync:

1. Check out or update the repo (shallow clone to repo cache - see Cache Location)
2. Scan for matching docs based on path pattern
3. Sync matching files to `.tbd/docs/`

### Proposed Config Format

```yaml
docs_cache:
  # Sources in precedence order (earlier wins on conflicts)
  sources:
    # Built-in tbd docs (highest precedence - tbd-specific shortcuts, system docs)
    - type: internal
      paths:
        - shortcuts/system/        # system shortcuts
        - shortcuts/standard/      # tbd-specific shortcuts (code-review-and-commit, etc.)

    # Speculate repo for general guidelines, shortcuts, templates
    - type: repo
      url: github.com/jlevy/speculate
      ref: main                    # Always explicit in config for clarity
      paths:
        - guidelines/
        - shortcuts/standard/
        - templates/

    # Optional: additional project-specific or org-specific repos
    # - type: repo
    #   url: github.com/myorg/coding-standards
    #   ref: main
    #   paths:
    #     - guidelines/

  # Per-file overrides (highest precedence, applied after sources)
  files:
    guidelines/custom.md: https://example.com/custom.md
```

**Key simplification:** No `lookup_path` needed.
Source order IS the precedence.

- During sync, sources are processed in order; first source to provide a file wins
- At runtime, lookup uses fixed search order: `shortcuts/system/` →
  `shortcuts/standard/` → `guidelines/` → `templates/`
- The files in `.tbd/docs/` are already the “winning” versions from sync

**Config explicitness:** The `ref` field is always written explicitly to config.yml for
clarity, even when using the default (`main`). This makes it clear which version is
being used without requiring knowledge of defaults.

### Format Version Compatibility

This feature adds a new `sources` field to `docs_cache`, which requires a format version
bump from `f03` to `f04`. This ensures:

1. **Older tbd versions** see the unknown format and error with “format ‘f04’ is from a
   newer tbd version” rather than silently stripping the `sources` field
2. **Migration path** is clear: f03 configs without `sources` continue to work unchanged
3. **Forward safety**: Users mixing tbd versions get explicit upgrade prompts

Changes to `tbd-format.ts`:

```typescript
f04: {
  introduced: '0.1.X',  // TBD
  description: 'Adds external repo sources for docs',
  changes: [
    'Added docs_cache.sources: array for repo and internal doc sources',
    'Sources define bulk doc sync from git repos or internal bundled docs',
  ],
  migration: 'No migration needed - sources is additive',
},
```

**Migration**: The migration function updates `tbd_format: f03` → `tbd_format: f04` but
makes no other changes.
This ensures migration only runs once.
Existing `docs_cache.files` continues to work as explicit overrides.
The `sources` field is optional and defaults to `[{ type: internal }]` for
backward-compatible behavior.

**Doc cache clearing during migration**: When migration occurs (or when sources
configuration changes significantly), the doc cache (`.tbd/docs/`) should be cleared
entirely and re-synced fresh.
This ensures:

1. **Stale files are removed** - Files from old sources that are no longer configured
2. **Precedence is respected** - Fresh sync applies correct source ordering
3. **No ghost files** - Manually added files in `.tbd/docs/` are cleaned up
4. **Clean state** - User gets predictable behavior matching their config

The migration or `tbd setup` should:

```typescript
// During f03→f04 migration or source config changes:
if (formatChanged || sourcesConfigChanged) {
  // 1. Clear doc cache entirely
  await rm(join(tbdRoot, '.tbd/docs'), { recursive: true, force: true });

  // 2. Trigger fresh sync
  await syncDocsWithDefaults(tbdRoot, { quiet: false });
}
```

This is safe because `.tbd/docs/` is gitignored and can always be regenerated from
sources.

### Migration Pattern: Version-Only Bump

This is the first “version-only” migration in tbd - where we bump the format version
without transforming any data.
This pattern is needed when:

1. **Adding optional fields** that older versions would silently strip (Zod’s `strip()`)
2. **No data transformation required** - old configs work as-is with new code
3. **Forward compatibility protection** - older tbd versions must reject the new format

**Why version-only migrations matter:**

Without bumping the format version, this scenario could occur:

1. User A runs tbd 0.2.0, adds `docs_cache.sources` to their config
2. User B (same repo) runs tbd 0.1.x, which doesn’t know about `sources`
3. Zod’s `strip()` silently removes the `sources` field when parsing
4. User B runs `tbd setup` or any config-writing operation
5. The `sources` config is lost - User A’s changes are silently destroyed

By bumping to f04, step 3 instead produces: “format ‘f04’ is from a newer tbd version.
Please upgrade: npm install -g get-tbd@latest”

**Implementation checklist:**

When adding a version-only migration, update these locations in `tbd-format.ts`:

```typescript
// 1. Add to FORMAT_HISTORY
f04: {
  introduced: '0.1.X',
  description: 'Adds external repo sources, removes lookup_path',
  changes: [
    'Added docs_cache.sources: array for repo and internal doc sources',
    'Sources define bulk doc sync from git repos or internal bundled docs',
    'Removed docs_cache.lookup_path: now uses fixed search order',
  ],
  migration: 'Removes lookup_path, clears doc cache for fresh sync',
},

// 2. Implement migration function
function migrate_f03_to_f04(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  migrated.tbd_format = 'f04';
  changes.push('Updated tbd_format: f04');

  // Remove deprecated lookup_path (now uses fixed search order)
  if (migrated.docs_cache?.lookup_path) {
    delete migrated.docs_cache.lookup_path;
    changes.push('Removed deprecated lookup_path (now uses fixed search order)');
  }

  return {
    config: migrated,
    fromFormat: 'f03',
    toFormat: 'f04',
    changed: true,
    changes,
  };
}

// 3. Add to migrateToLatest() chain
if (currentFormat === 'f03') {
  const result = migrate_f03_to_f04(current);
  current = result.config;
  currentFormat = 'f04' as FormatVersion;
  allChanges.push(...result.changes);
}

// 4. Update CURRENT_FORMAT
export const CURRENT_FORMAT = 'f04';

// 5. Add to describeMigration()
if (current === 'f03') {
  descriptions.push('f03 → f04: Add external repo sources, remove lookup_path');
  current = 'f04';
}
```

**Testing version-only migrations:**

```typescript
it('should migrate f03 to f04 and remove lookup_path', () => {
  const oldConfig = {
    tbd_format: 'f03',
    tbd_version: '0.1.6',
    docs_cache: {
      files: { 'guidelines/foo.md': 'internal:guidelines/foo.md' },
      lookup_path: ['.tbd/docs/shortcuts/system'],  // deprecated in f04
    },
  };

  const result = migrateToLatest(oldConfig);

  expect(result.changed).toBe(true);
  expect(result.config.tbd_format).toBe('f04');
  expect(result.changes).toContain('Updated tbd_format: f04');
  expect(result.changes).toContain('Removed deprecated lookup_path (now uses fixed search order)');
  // lookup_path should be removed
  expect(result.config.docs_cache.lookup_path).toBeUndefined();
  // files should be preserved
  expect(result.config.docs_cache.files).toEqual(oldConfig.docs_cache.files);
});

it('should reject f04 config on older tbd version', () => {
  // This test runs against the f03 codebase to verify forward compatibility
  const futureConfig = { tbd_format: 'f04', /* ... */ };
  expect(isCompatibleFormat('f04')).toBe(false);
});
```

### Repo Structure Convention

External repos should follow tbd’s standard structure:

```
repo-root/
  guidelines/
    typescript-rules.md
    python-rules.md
  shortcuts/
    standard/
      my-shortcut.md
  templates/
    my-template.md
```

Front matter is optional but recommended:

```yaml
---
title: My Shortcut
description: Does something useful
category: workflow
# Optional: declares tbd dependency (for validation/documentation)
requires_tbd: true
---
```

### Source Precedence

When the same destination path is specified by multiple sources:

1. Explicit `files:` entries (highest precedence, applied last)
2. Earlier sources in `sources:` array
3. Later sources (lowest precedence)

This allows users to override specific docs while pulling bulk from repos.

**Sync behavior:** During sync, sources are processed in order.
If a file path already exists (from an earlier source), it’s skipped.
This means the first source to provide a file wins.

**Runtime lookup:** Uses a fixed search order for name resolution:
1. `.tbd/docs/shortcuts/system/` (tbd internals)
2. `.tbd/docs/shortcuts/standard/` (standard shortcuts)
3. `.tbd/docs/guidelines/` (guidelines)
4. `.tbd/docs/templates/` (templates)

Since sync already resolved precedence, lookup just finds the first match in these
directories.

### Checkout Strategy

**Why shallow clone (not worktree):**

tbd uses worktrees for the tbd-sync branch because that’s a branch of the **same** repo.
External doc repos are completely separate git repositories - you can’t worktree into a
different remote. Shallow clone is the correct approach for external repos.

**Primary: Git sparse checkout**

```bash
# In repo cache directory (e.g., .tbd/repo-cache/<url-hash>/)
git clone --depth 1 --filter=blob:none --sparse <url>
git sparse-checkout set <paths>
git pull  # on subsequent syncs
```

Advantages:

- Works with any git host (GitHub, GitLab, Bitbucket, self-hosted)
- Minimal storage (only needed paths via sparse checkout)
- Shallow clone (`--depth 1`) minimizes git history overhead
- Works offline after initial sync
- Proper versioning via refs (branch, tag, or commit)

**Fallback: GitHub API (if git unavailable)**

Use `gh api` or raw HTTP to fetch directory listings and files.
Limited to GitHub repos.

### Cache Location

Repo checkouts are stored per-project in `.tbd/repo-cache/` (gitignored):

```
.tbd/
  repo-cache/           # Added to .tbd/.gitignore by setup
    <url-hash>/
      .git/             # shallow clone
      guidelines/       # sparse checkout
      shortcuts/
```

This keeps each project isolated with its own cache.
The `tbd setup` command will add `repo-cache/` to `.tbd/.gitignore`.

### Sync Workflow

`tbd sync --docs` (or auto-sync):

1. For each `type: repo` source: a. Compute cache path from URL hash b. If not cached:
   sparse clone with specified paths c. If cached: `git fetch && git checkout <ref>` d.
   Scan for `.md` files matching path patterns e. Add to sync manifest

2. For `type: internal` source: a. Scan bundled docs (existing behavior) b. Add to sync
   manifest

3. Apply explicit `files:` overrides (URL or internal sources)

4. Sync all files to `.tbd/docs/` (existing DocSync logic)

5. Update config with discovered files (for transparency)

### Changes to Existing Code

**New files:**

- `src/file/repo-cache.ts` - Git sparse checkout operations
- `src/lib/repo-source.ts` - Repo source parsing and validation

**Modified files:**

- `src/lib/tbd-format.ts` - Add f04 format version with migration
- `src/lib/schemas.ts` - Add `DocsSourceSchema`, update `DocsCacheSchema`
- `src/file/doc-sync.ts` - Integrate repo sources
- `src/cli/commands/sync.ts` - Handle repo checkout errors/progress

### Error Handling

- **Network errors during checkout**: Warn and skip source, use cached if available
- **Invalid repo URL**: Error at config parse time
- **Missing ref**: Error with helpful message suggesting valid refs
- **Auth required**: Error with suggestion to use `gh auth login` or SSH

## Alternatives Considered

### Alternative 1: Only URL Sources (No Git)

Enhance URL sources to support directory listing via GitHub API.

**Pros:** No git dependency, simpler implementation **Cons:** GitHub-only, rate limits,
no versioning, requires enumeration

**Verdict:** Too limiting for the stated goals.

### Alternative 2: npm Package Dependencies

Publish guideline packs as npm packages, install as dependencies.

**Pros:** Familiar pattern, versioning via npm **Cons:** Heavy for text files, requires
npm publish workflow, version lag

**Verdict:** Overkill for documentation files.

### Alternative 3: Git Submodules

Use git submodules for external doc repos.

**Pros:** Native git versioning **Cons:** Submodule UX is poor, requires user git
knowledge, complicates tbd’s git usage

**Verdict:** Poor UX, conflicts with tbd’s sync model.

## Implementation Plan

### Phase 1: Core Infrastructure

- [ ] Bump format version f03 → f04 in `tbd-format.ts` (add FORMAT_HISTORY entry, update
  CURRENT_FORMAT, add migration function - no-op since sources is additive)
- [ ] Add `DocsSourceSchema` with repo type support to `schemas.ts`
- [ ] Update `DocsCacheSchema` to include optional `sources` array
- [ ] Implement `RepoCache` class for sparse checkouts (`repo-cache.ts`)
- [ ] Update `DocSync` to handle repo sources
- [ ] Clear `.tbd/docs/` during migration (fresh sync after format or source changes)
- [ ] Add `--repos` flag to `tbd sync` for repo-only sync

### Phase 2: Integration

- [ ] Update `tbd setup` to configure default sources (Speculate)
- [ ] Update `tbd setup` to add `repo-cache/` to `.tbd/.gitignore`
- [ ] Handle source precedence correctly
- [ ] Add progress indicators for repo checkout
- [ ] Error handling and recovery

### Phase 3: Polish and Documentation

- [ ] Add `tbd doctor` checks for repo cache health
- [ ] Document repo structure conventions
- [ ] Create example external guidelines repo
- [ ] Migration guide for moving docs to external repo

### Phase 4: Speculate Migration

Make `jlevy/speculate` the upstream repo for general-purpose docs (guidelines, general
shortcuts, templates).
tbd becomes a consumer of Speculate docs via the external repo mechanism built in Phases
1-3.

#### Current State Comparison

**Speculate structure** (`docs/general/`):

```
docs/general/
  agent-rules/          # typescript-rules.md, python-rules.md, etc.
  agent-guidelines/     # general-tdd-guidelines.md, golden-testing-guidelines.md
  agent-shortcuts/      # shortcut-commit-code.md, shortcut-create-pr-simple.md
  agent-setup/          # github-cli-setup.md
  research/             # research briefs
docs/project/
  specs/                # Templates: template-plan-spec.md, etc.
  architecture/         # template-architecture.md
  research/             # template-research-brief.md
```

**tbd structure** (`packages/tbd/docs/`):

```
guidelines/             # All rules + guidelines merged
shortcuts/
  standard/             # User-invocable shortcuts
  system/               # Internal system shortcuts
templates/              # plan-spec.md, research-brief.md, etc.
```

**Key differences (current state → will be resolved by migration):**

| Aspect | Speculate (current) | tbd | After Migration |
| --- | --- | --- | --- |
| Front matter | Minimal (`description`, `globs`) | Rich (`title`, `description`, `author`, `category`) | Speculate adopts tbd format |
| Shortcut refs | `@shortcut-precommit-process.md` | `tbd shortcut precommit-process` | Speculate uses tbd syntax |
| tbd references | None | "We track work as beads using tbd..." | Speculate uses tbd refs |
| Directory names | `agent-rules/`, `agent-shortcuts/` | `guidelines/`, `shortcuts/standard/` | Speculate adopts tbd structure |

#### Target State

Speculate becomes the canonical source for general docs.
tbd-specific docs remain in tbd.

**Document classification:**

| Category | Location | Examples |
| --- | --- | --- |
| General guidelines | Speculate | typescript-rules, python-rules, general-coding-rules |
| General shortcuts | Speculate | review-code, create-pr-simple, merge-upstream |
| tbd-specific shortcuts | tbd (internal) | code-review-and-commit, implement-beads, agent-handoff |
| Templates | Speculate | plan-spec, research-brief, architecture-doc |
| System shortcuts | tbd (internal) | skill.md, skill-brief.md |

**Speculate repo changes:**

1. **Adopt tbd’s front matter format** - Add `title:`, `author:`, `category:` fields
2. **Rename directories** to match tbd expectations:
   - `agent-rules/` + `agent-guidelines/` → `guidelines/`
   - `agent-shortcuts/` → `shortcuts/standard/`
   - Templates → `templates/`
3. **Remove shortcut prefix** from filenames: `shortcut-commit-code.md` →
   `commit-code.md`
4. **Use tbd-style references**: e.g., `tbd shortcut review-code`,
   `tbd guidelines typescript-rules` (Speculate docs assume tbd is available -
   simplifies implementation, no translation needed)

**tbd changes:**

1. **Remove duplicated general docs** from `packages/tbd/docs/`
2. **Keep tbd-specific docs** that reference `tbd` commands
3. **Configure Speculate as default source** in setup

#### Shortcut Reference Syntax

Speculate docs use tbd-specific syntax directly:

```markdown
Follow the `tbd shortcut precommit-process` steps...
See `tbd guidelines commit-conventions` for details.
```

This simplifies implementation (no translation layer needed) and assumes Speculate docs
are primarily consumed via tbd.
Users who want Speculate without tbd can still read the docs - they just won’t have the
CLI commands available.

#### Migration Tasks

- [ ] Audit all tbd docs: classify as “general” (→ Speculate) or “tbd-specific” (→ keep)
- [ ] Update Speculate repo structure to match tbd’s expected layout
- [ ] Update Speculate front matter to include all required fields
- [ ] Rename Speculate files (remove `shortcut-` prefix, etc.)
- [ ] Update shortcut references to use tbd syntax (`tbd shortcut <name>`)
- [ ] Copy improved docs from tbd back to Speculate
- [ ] Remove duplicated docs from tbd, configure Speculate as source
- [ ] Test round-trip: Speculate → tbd sync → verify all shortcuts/guidelines work
- [ ] Update Speculate README with new structure and tbd integration docs
- [ ] Consider deprecating/simplifying Speculate CLI (users can use tbd instead)

#### Speculate CLI Future

Once tbd can pull docs from Speculate, the Speculate CLI’s main value is diminished.
Options:

1. **Deprecate**: Point users to tbd for full workflow tooling
2. **Simplify**: Keep only copier template functionality, remove doc management
3. **Maintain**: Keep both for users who want Speculate without tbd

**Recommendation:** Option 2 - Speculate CLI becomes a lightweight project scaffolding
tool (`speculate init`), while tbd handles all doc/shortcut/guideline management.

## Testing Strategy

- Unit tests for format migration f03 → f04 (verify no-op behavior, version bump)
- Unit tests for `DocsSourceSchema` validation
- Unit tests for `RepoCache` sparse checkout logic
- Integration tests with mock git repos
- Golden tests for config parsing with sources
- Test older tbd version rejects f04 configs (manual or CI matrix)
- Manual testing with real public repos

## Rollout Plan

**Phases 1-3: External Repo Support**

1. Implement repo source infrastructure (format bump, schema, RepoCache)
2. Test with Speculate repo as pilot
3. Iterate on config format based on real usage

**Phase 4: Speculate Migration**

4. Restructure Speculate repo to match tbd’s expected layout
5. Update Speculate front matter, file naming, and shortcut references (use tbd syntax)
6. Copy improved docs from tbd → Speculate (general guidelines, shortcuts, templates)
7. Test round-trip: Speculate → tbd sync → verify all docs work
8. Configure tbd to use Speculate as default source (automatic in setup)
9. Remove duplicated general docs from tbd bundled set
10. Keep only tbd-specific docs internal (system shortcuts, tbd-enhanced shortcuts)
11. Simplify or deprecate Speculate CLI

## Open Questions

1. ~~**Cache location:**~~ **Decided:** Per-project `.tbd/repo-cache/`, gitignored.

2. ~~**Auth for private repos:**~~ **Decided:** External - users manage git/ssh
   credentials.

3. ~~**Default source:**~~ **Decided:** `jlevy/speculate` is the default,
   auto-configured.

4. **Version pinning UX:** Should `ref` default to `main` (always latest) or require
   explicit pinning? Latest is convenient but less reproducible.

5. **What happens when external docs conflict with internal?** Proposed: explicit
   precedence order. But should we warn on conflicts?

6. **Should external repos be able to declare dependencies on other repos?** (Probably
   not initially - keep it simple.)

7. ~~**Speculate shortcut reference syntax:**~~ **Decided:** Use tbd-specific syntax
   (`tbd shortcut <name>`) directly.
   No translation needed initially.

8. ~~**Speculate directory structure:**~~ **Decided:** Speculate adopts tbd’s exact
   structure (`guidelines/`, `shortcuts/standard/`, `templates/`). Config `paths:`
   selects subpaths to sync.
   Source order in config = precedence (no separate lookup_path needed).

9. **Which docs are “general” vs “tbd-specific”?** Need explicit audit.
   Some shortcuts like `code-review-and-commit` are enhanced for tbd but could have a
   generic version.

## Future Work

**CLI commands for managing sources** (not in initial implementation):

```bash
# Add a repo source (defaults to ref: main, writes explicitly to config)
tbd source add github.com/org/guidelines

# Add with specific ref
tbd source add github.com/org/guidelines --ref v2.0

# List configured sources
tbd source list

# Remove a source
tbd source remove github.com/org/guidelines
```

These commands would:
- Default `ref` to `main` but always write it explicitly to config.yml
- Validate the repo is accessible before adding
- Handle precedence (append to sources array by default, or allow position control)

**Generic shortcut reference syntax** (not in initial implementation):

Support a non-tbd syntax like `@shortcut-<name>` or `{{shortcut:<name>}}` that gets
remapped to `tbd shortcut <name>` during sync.
This would make Speculate docs more tool-agnostic for users who might use them outside
tbd. For now, Speculate uses tbd syntax directly.

## References

- Current doc sync implementation:
  [doc-sync.ts](../../packages/tbd/src/file/doc-sync.ts)
- Config schema: [schemas.ts](../../packages/tbd/src/lib/schemas.ts)
- Related spec: plan-2026-01-26-configurable-doc-cache-sync.md
- Speculate repo: https://github.com/jlevy/speculate
- Local checkout: attic/speculate/ (for comparison during implementation)
