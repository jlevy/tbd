# Plan Spec: Configurable Doc Cache with Auto-Sync

## Purpose

This spec designs a configurable documentation cache system that automatically syncs
documentation files from both internal (bundled) and external (GitHub) sources.
The goal is to ensure that when a user clones a tbd-enabled repository, they get an
up-to-date documentation cache without manual intervention.

## Background

Currently, tbd has a documentation system that stores docs in `.tbd/docs/` (previously
called “cache”). These docs include shortcuts, guidelines, and templates that agents and
users can access via `tbd shortcut`, `tbd guidelines`, and `tbd template` commands.

**Current limitations:**

1. **No auto-sync**: When someone clones a repo with tbd already set up, the
   `.tbd/docs/` directory is gitignored and empty.
   They must explicitly run `tbd setup --auto` to populate it.

2. **Not configurable**: The docs that get installed are hardcoded.
   Users cannot specify custom docs from external sources (like GitHub) or remove
   bundled docs they don’t want.

3. **No refresh mechanism**: There’s no way to update docs from their sources after
   initial setup, or to sync docs across team members.

### Related Work

- [plan-2026-01-22-doc-cache-abstraction.md](done/plan-2026-01-22-doc-cache-abstraction.md)
  \- Implemented the current DocCache system with path-ordered lookups

## Summary of Task

Implement a configurable doc cache system with these capabilities:

1. **Configuration in config.yml**: A `doc_cache:` key that maps cache paths to source
   locations
2. **Multiple source types**: Support internal (bundled) docs and GitHub URLs
3. **Auto-sync on setup**: `tbd setup --auto` creates default config and syncs all docs
4. **Refresh command**: `tbd docs --refresh` to sync docs from config at any time
5. **Clean sync protocol**: Download new docs, update changed docs, remove deleted docs

## Agent Briefing (3-4 Paragraphs)

The tbd documentation system currently installs bundled docs to `.tbd/docs/` during
setup, but this directory is gitignored and doesn’t sync across team members.
When someone clones a repo, they need to manually run `tbd setup --auto` to get the
docs. Additionally, there’s no way to configure which docs are installed or add custom
docs from external sources like GitHub repositories.

The solution is to add a `doc_cache:` configuration section in `.tbd/config.yml` that
maps destination paths (like `shortcuts/precommit-process.md`) to source locations.
Sources can be internal bundled docs (using `internal:` prefix) or GitHub URLs.
The config file IS tracked in git, so team members share the same doc configuration.
When anyone runs `tbd setup --auto` or `tbd docs --refresh`, the system reads this
config and syncs all docs: downloading new ones, updating changed ones, and removing any
that are no longer in the config.

The first time `tbd setup --auto` runs on a fresh project, it creates a default
`doc_cache:` config with all the bundled internal docs.
Users can then edit this config to add their own docs from GitHub, remove docs they
don’t want, or add custom shortcuts from their organization’s repos.
Subsequent runs of `tbd setup --auto` or `tbd docs --refresh` simply sync the cache to
match the current config.
This ensures every team member has consistent documentation without manual coordination.

For GitHub sources, we need to handle URL formats that work with agents (who may be
blocked from certain patterns) and support branch specifications.
Testing should include comprehensive unit tests for the sync protocol (ensuring adds,
updates, and deletes work correctly) and end-to-end tryscript tests that verify the
actual file state after sync operations.

## Backward Compatibility

| Area | Impact | Notes |
| --- | --- | --- |
| Code | Backward compatible | New `doc_cache:` config key is optional; existing repos without it continue to work |
| API | N/A | No API changes |
| File format | Backward compatible | Config schema extended with new optional key |
| Database schema | N/A | No database |

## Stage 1: Planning Stage

### Feature Requirements

1. **Config Structure**
   - New `doc_cache:` key in `.tbd/config.yml`
   - Maps destination paths to source locations
   - Destinations are paths within `.tbd/docs/` (e.g., `shortcuts/my-shortcut.md`)
   - Sources are either `internal:` paths or GitHub URLs

2. **Source Types**
   - `internal:shortcuts/precommit-process.md` - bundled docs from tbd package
   - GitHub URLs - fetch from public repos (need to test agent access)

3. **Default Configuration**
   - First `tbd setup --auto` creates config with all internal docs
   - Explanatory comment in YAML explaining how to customize

4. **Sync Behavior**
   - Compare config against current `.tbd/docs/` state
   - Download new docs not present locally
   - Update docs whose source has changed
   - Remove docs no longer in config
   - Report what changed

5. **Commands**
   - `tbd docs --refresh` - standalone sync command
   - `tbd setup --auto` - includes doc sync as part of setup

6. **Documentation Updates**
   - Update SKILL.md with doc cache configuration instructions
   - Update CLI help for new `tbd docs` command
   - Add explanatory comments in generated config.yml

### Config Format Design

```yaml
# .tbd/config.yml

# This configures which docs are synced to the .tbd/docs/ directory and available as
# shortcuts, guidelines, and templates via the tbd CLI.
doc_cache:
  shortcuts/system/skill.md: internal:shortcuts/system/skill.md
  shortcuts/system/shortcut-explanation.md: internal:shortcuts/system/shortcut-explanation.md
  shortcuts/standard/commit-code.md: internal:shortcuts/standard/commit-code.md
  shortcuts/standard/precommit-process.md: internal:shortcuts/standard/precommit-process.md
  shortcuts/custom/my-org-shortcut.md: https://raw.githubusercontent.com/myorg/docs/main/shortcuts/my-org-shortcut.md
  guidelines/typescript-rules.md: internal:guidelines/typescript-rules.md
```

**Design decisions:**
- Use raw GitHub URLs (raw.githubusercontent.com) for clarity and direct fetch
- Keys are destination paths relative to `.tbd/docs/`
- Values are source locations with `internal:` prefix for bundled or full URL for
  external
- YAML dict format (not list) allows easy editing and clear key-value mapping
- Only quote strings when YAML requires it (URLs with special chars)

### GitHub URL Format Options

**Option A: Raw GitHub URLs (Recommended)**
```yaml
shortcuts/custom/my-shortcut.md: https://raw.githubusercontent.com/org/repo/main/path/to/file.md
```
- Pros: Standard URLs, clear what’s being fetched, branch in URL
- Cons: Verbose, agents sometimes blocked from github.com domains

**Option B: Custom github: prefix**
```yaml
shortcuts/custom/my-shortcut.md: github:org/repo:main:path/to/file.md
```
- Pros: Compact, easy to parse
- Cons: Non-standard, need to document format

**Option C: GitHub API**
```yaml
shortcuts/custom/my-shortcut.md: https://api.github.com/repos/org/repo/contents/path/to/file.md?ref=main
```
- Pros: Official API
- Cons: Returns base64-encoded content, rate limited

**Recommendation**: Start with Option A (raw URLs) but test agent access.
If blocked, implement Option B as fallback.

### Not in Scope

- Private repository access (requires auth tokens)
- Non-GitHub external sources (could add later)
- Automatic version detection/updates
- Conflict resolution (config wins, local changes overwritten)
- Partial sync (always syncs entire config)

### Acceptance Criteria

1. `tbd setup --auto` on fresh project creates config with all internal docs listed
2. `tbd setup --auto` on existing project syncs docs from config
3. `tbd docs --refresh` syncs docs from config without full setup
4. Adding a doc to config and running refresh downloads it
5. Removing a doc from config and running refresh deletes it
6. GitHub URLs successfully download content (test with public repo)
7. Sync reports what changed (added, updated, removed counts)
8. Config includes explanatory comments for users/agents

## Stage 2: Architecture Stage

### File Structure

```
packages/tbd/src/
├── file/
│   ├── doc-cache.ts       # Existing DocCache class
│   └── doc-sync.ts        # NEW: Sync logic for doc_cache config
├── cli/commands/
│   ├── docs.ts            # NEW: tbd docs command with --refresh
│   └── setup.ts           # Modified: integrate doc sync
└── lib/
    └── schemas.ts         # Modified: add doc_cache schema
```

### Schema Extension

```typescript
// In schemas.ts
export const DocCacheConfigSchema = z.record(
  z.string(),  // destination path (e.g., "shortcuts/my-shortcut.md")
  z.string()   // source location (internal: or URL)
);

export const ConfigSchema = z.object({
  // ... existing fields ...
  doc_cache: DocCacheConfigSchema.optional(),
});
```

### DocSync Class Design

```typescript
// packages/tbd/src/file/doc-sync.ts

export interface SyncResult {
  added: string[];      // Paths of newly downloaded docs
  updated: string[];    // Paths of updated docs
  removed: string[];    // Paths of removed docs
  errors: Array<{ path: string; error: string }>;
}

export interface DocSource {
  type: 'internal' | 'url';
  location: string;  // internal path or URL
}

export class DocSync {
  constructor(
    private readonly tbdRoot: string,
    private readonly config: Record<string, string>
  ) {}

  /**
   * Parse source string into DocSource
   * "internal:shortcuts/foo.md" -> { type: 'internal', location: 'shortcuts/foo.md' }
   * "https://..." -> { type: 'url', location: 'https://...' }
   */
  parseSource(source: string): DocSource;

  /**
   * Fetch content from a source
   */
  async fetchContent(source: DocSource): Promise<string>;

  /**
   * Get current state of .tbd/docs/ directory
   * Returns map of relative paths to content hashes
   */
  async getCurrentState(): Promise<Map<string, string>>;

  /**
   * Sync docs from config to .tbd/docs/
   * - Downloads new docs
   * - Updates changed docs
   * - Removes docs not in config
   */
  async sync(): Promise<SyncResult>;
}
```

### Internal Doc Resolution

Internal docs are bundled with the tbd package.
Resolution:

1. Check `dist/docs/` (production build)
2. Fall back to `../../docs/` (development)
3. Use same `getDocsBasePath()` logic from existing setup.ts

### URL Fetching

For external URLs:
1. Use native `fetch()` (Node 18+)
2. Timeout after 30 seconds
3. Validate response is text/markdown
4. Handle redirects (follow up to 3)
5. Report clear errors for failures

### Docs Command Design

```typescript
// packages/tbd/src/cli/commands/docs.ts

export function registerDocsCommand(program: Command): void {
  program
    .command('docs')
    .description('Manage documentation cache')
    .option('--refresh', 'Sync docs from config')
    .option('--status', 'Show sync status without changing files')
    .option('--json', 'Output as JSON')
    .action(async (options, command) => {
      // Implementation
    });
}
```

### Setup Integration

Modify `tbd setup --auto` to:

1. If no `doc_cache:` in config, generate default with all internal docs
2. Run doc sync (same as `tbd docs --refresh`)
3. Continue with rest of setup (hooks, skill files, etc.)

## Stage 3: Refine Architecture

### Existing Components to Reuse

1. **`getDocsBasePath()`** in setup.ts - finds bundled docs location
2. **`atomically.writeFile()`** - safe file writes
3. **`ensureDir()`** - directory creation
4. **Config read/write** in file/config.ts
5. **OutputManager** for consistent CLI output

### Simplification Decisions

1. **No content hashing** for v1 - just compare existence, always overwrite on sync
2. **No incremental sync** - always process entire config
3. **No caching of remote content** - fetch fresh each time
4. **Config is source of truth** - local changes to docs will be overwritten

### Error Handling

| Error | Handling |
| --- | --- |
| Network failure | Report error, continue with other docs |
| Invalid URL | Report error, skip this doc |
| Internal doc not found | Report error, this is a bug |
| Permission denied | Report error, continue with others |
| Parse error | Report error, skip this doc |

## Stage 4: Implementation

### Phase 1: Schema and Config

- [ ] Add `doc_cache` field to ConfigSchema in schemas.ts
- [ ] Add config migration to add doc_cache to existing configs
- [ ] Add helper to generate default doc_cache config from bundled docs

### Phase 2: DocSync Core

- [ ] Create `file/doc-sync.ts` with DocSync class
- [ ] Implement `parseSource()` for internal: and URL sources
- [ ] Implement `fetchContent()` for both source types
- [ ] Implement `getCurrentState()` to scan .tbd/docs/
- [ ] Implement `sync()` with add/update/remove logic
- [ ] Unit tests for DocSync class

### Phase 3: Docs Command

- [ ] Create `cli/commands/docs.ts`
- [ ] Implement `--refresh` flag
- [ ] Implement `--status` flag for dry-run
- [ ] Register command in cli.ts
- [ ] Unit tests for command

### Phase 4: Setup Integration

- [ ] Modify setup.ts to generate default doc_cache config
- [ ] Call DocSync.sync() during setup
- [ ] Update setup output to report sync results

### Phase 5: Documentation

- [ ] Add explanatory comments to generated config.yml
- [ ] Update SKILL.md with doc_cache usage instructions
- [ ] Update CLI help text
- [ ] Document GitHub URL format and limitations

### Phase 6: Testing

- [ ] Unit tests for DocSync with mock file system
- [ ] Unit tests for URL fetching with mock responses
- [ ] Integration test: fresh setup creates default config
- [ ] Integration test: setup with existing config syncs correctly
- [ ] Integration test: docs --refresh syncs correctly
- [ ] Tryscript test: end-to-end sync verification
- [ ] Test GitHub URL access from agent environment

## Open Questions

1. **GitHub URL access**: Do agents get blocked from raw.githubusercontent.com?
   Need to test and potentially implement fallback.

2. **Branch handling**: Should we support branch in config separately, or require full
   URLs with branch?

   **Leaning toward**: Full URLs with branch included - simpler, more explicit.

3. **Auth for private repos**: Out of scope for v1, but how would we add it later?

   **Future option**: Support `GITHUB_TOKEN` env var or config credential.

4. **Conflict handling**: What if user modifies a synced doc locally?

   **Decision**: Config wins.
   Local changes are overwritten.
   Document this clearly.

5. **Sync triggers**: Should we auto-sync on every tbd command, or only explicit
   refresh?

   **Decision**: Only on `tbd setup --auto` and `tbd docs --refresh`. Auto-sync on every
   command would be too slow and surprising.
