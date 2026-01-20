# Plan Spec: Streamlined Init/Setup Design

## Purpose

Design a cleaner, more intuitive onboarding flow for tbd that works seamlessly for both
humans and AI agents, whether setting up a brand new repo or joining an existing one.

## Background

tbd currently has multiple setup-related commands that overlap in confusing ways:

- `tbd init --prefix=<name>` - Initializes tbd repo (required prefix creates friction)
- `tbd setup` - Parent command that shows subcommands but does nothing by itself
- `tbd setup auto` - Auto-detects and configures editor integrations
- `tbd init` internally calls `tbd setup auto` after initialization

The user wants a streamlined experience where `npx tbd-git@latest` and `tbd setup` guide
users (human or agent) to a fully working setup in one smooth flow.

## Summary of Task

Redesign the init/setup command hierarchy so that:

1. `npx tbd-git@latest` shows help with clear guidance for first-time users
2. `tbd setup` becomes the primary “just make it work” entry point
3. `tbd init` remains available as a surgical option for scripts
4. The flow works for new repos, existing tbd repos, and Beads migration

## Current State Analysis

### Current Command Structure

```
tbd                           # Shows --help
tbd init --prefix=<name>      # Initialize repo (prefix REQUIRED)
  └── auto-calls: tbd setup auto
  └── auto-calls: tbd status
tbd setup                     # Shows subcommands only
  tbd setup auto              # Detect + configure integrations
  tbd setup claude            # Claude Code hooks + skill
  tbd setup cursor            # Cursor IDE rules
  tbd setup codex             # AGENTS.md
  tbd setup beads --disable   # Migrate from Beads
tbd import --from-beads       # Auto-initializes + imports
```

### Current Pain Points

| Issue | Impact |
| --- | --- |
| `tbd init` requires `--prefix` | Friction for new users who don't know what prefix to use |
| `tbd setup` does nothing alone | Confusing - users expect it to "set things up" |
| `init` auto-calls `setup auto` | Confusing hierarchy - init contains setup? |
| No clear first-time guidance | Help page doesn't tell users where to start |
| Agents need multiple commands | No single "install and configure everything" path |

### What Works Well

| Feature | Why It's Good |
| --- | --- |
| `tbd import --from-beads` | Auto-initializes + imports in one step |
| `tbd setup auto` | Smart detection of editors, no manual config needed |
| `tbd setup claude/cursor/codex` | Surgical commands for specific integrations |
| `tbd status` | Good orientation command that works pre-init |

## Stage 1: Planning Stage

### Design Philosophy

**“tbd setup” = “Make tbd work in this repo”**

A single command that:
1. Explains what tbd is (brief prime)
2. Initializes if needed (with smart defaults)
3. Installs agent integrations
4. Shows status and next steps

**“tbd init” = Surgical initialization for scripts/advanced users**

Remains the low-level command that just creates `.tbd/` without extras.

### Proposed Command Structure

```
tbd                           # Shows --help with footer guidance
tbd setup [options]           # PRIMARY ENTRY: Full guided/auto setup
  --auto                      # Non-interactive mode (for agents)
  tbd setup claude            # Just Claude integration
  tbd setup cursor            # Just Cursor integration
  tbd setup codex             # Just AGENTS.md
  tbd setup beads --disable   # Just Beads migration
tbd init [options]            # SURGICAL: Just repo init
  --prefix=<name>             # Optional (auto-derive if not provided)
  --skip-integrations         # Don't prompt about integrations
```

### Detailed Behavior Specifications

#### 1. Help Footer

Add to bottom of `tbd --help`:

```
Getting Started:
  New to tbd? Run:  npm install -g tbd-git && tbd setup

  This will guide you through setup and configure your coding agents.
```

#### 2. `tbd setup` (no args, interactive mode)

```
$ tbd setup

┌─────────────────────────────────────────────────────────────────┐
│ tbd: Git-native issue tracking for AI agents and humans        │
│                                                                 │
│ Key features:                                                   │
│ • Track issues as Markdown files in git                        │
│ • Works in cloud environments (no daemon, no SQLite)           │
│ • Integrates with Claude Code, Cursor, and other AI tools      │
└─────────────────────────────────────────────────────────────────┘

Checking repository...
  ✓ Git repository detected
  ✗ tbd not initialized

? Initialize tbd in this repository? (Y/n)

Detecting project prefix...
  Repository: github.com/jlevy/tbd → prefix "tbd"

? Use prefix "tbd" for issue IDs (e.g., tbd-a7k2)? (Y/n)

Initializing tbd...
  ✓ Created .tbd/config.yml
  ✓ Created .tbd/.gitignore
  ✓ Initialized sync branch

Configuring integrations...
  ✓ Claude Code - Installed hooks and skill
  - Cursor IDE - Not detected (skipped)
  - AGENTS.md - Not detected (skipped)

Setup complete! Next steps:
  1. git add .tbd/ .claude/ && git commit -m "Initialize tbd"
  2. tbd create "My first issue" --type=task
  3. tbd ready   # See available work
```

#### 3. `tbd setup --auto` (non-interactive mode for agents)

```
$ tbd setup --auto

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ✗ tbd not initialized

Initializing with auto-detected prefix "tbd"...
  ✓ Created .tbd/config.yml
  ✓ Initialized sync branch

Configuring integrations...
  ✓ Claude Code - Installed hooks and skill

Setup complete!
  Run: git add .tbd/ .claude/ && git commit -m "Initialize tbd"
```

#### 4. `tbd setup` on already-initialized repo

```
$ tbd setup

Checking repository...
  ✓ Git repository detected
  ✓ tbd initialized (prefix: tbd)

Checking integrations...
  ✓ Claude Code - Already configured
  - Cursor IDE - Not detected
  - AGENTS.md - Not detected

Everything is set up! Use `tbd status` for details.
```

#### 5. `tbd init` behavior changes

Remove auto-calling of `setup auto`. Keep it surgical:

```
$ tbd init --prefix=proj

Initialized tbd repository
Created sync branch: tbd-sync

To complete setup:
  git add .tbd/ && git commit -m "Initialize tbd"
  tbd setup   # Configure agent integrations (optional)
```

If prefix not provided, auto-derive:

```
$ tbd init

Detecting project prefix...
  Using "myapp" (from directory name)

Initialized tbd repository
...
```

### Prefix Auto-Detection Algorithm

```typescript
function autoDetectPrefix(): string {
  // 1. Try git remote URL
  const remote = getGitRemoteUrl();
  if (remote) {
    // github.com/jlevy/tbd → "tbd"
    const repoName = extractRepoName(remote);
    if (isValidPrefix(repoName)) return repoName;
  }

  // 2. Fall back to directory name
  const dirName = path.basename(process.cwd());
  if (isValidPrefix(dirName)) return dirName;

  // 3. Ultimate fallback
  return "proj";
}

function isValidPrefix(s: string): boolean {
  // 2-8 lowercase alphanumeric chars
  return /^[a-z][a-z0-9]{1,7}$/.test(s);
}
```

### Edge Cases

| Scenario | `tbd setup` Behavior |
| --- | --- |
| Not a git repo | Error: "Not a git repository. Run `git init` first." |
| Already initialized | Check/update integrations, show status |
| Beads detected | Suggest: "Beads detected. Run `tbd import --from-beads`" |
| Non-interactive + no prefix derivable | Use "proj" as default |
| Remote push fails | Warn but continue (local setup complete) |

### Backward Compatibility

| Command | Before | After |
| --- | --- | --- |
| `tbd init --prefix=x` | Works | Works (unchanged) |
| `tbd init` (no prefix) | Error | Auto-derives prefix |
| `tbd setup auto` | Works | Deprecated but still works |
| `tbd setup` | Shows subcommands | Interactive full setup |
| `tbd setup claude` | Works | Works (unchanged) |

## Not Included (Explicit Non-Goals)

- Removing `tbd init` - Keep for scripts/advanced use
- Removing `tbd setup auto` - Deprecate but keep working
- Interactive prefix prompts in `tbd init` - Keep init non-interactive
- Automatic git commit - Users should review before committing

## Questions for Review

1. **Should `tbd setup --auto` prompt even in non-interactive mode if prefix can’t be
   auto-detected?** Recommendation: No, use “proj” as fallback.

2. **Should we rename `tbd setup auto` to `tbd setup integrations`?** More descriptive,
   but breaks existing scripts.

3. **Should `tbd setup` also run `tbd sync` at the end?** Probably not - user should
   commit first.

4. **For existing tbd repos, should `tbd setup` update the skill file if outdated?**
   Probably yes - check version and offer update.

## Stage 2: Architecture Stage

### Files to Modify

| File | Changes |
| --- | --- |
| `packages/tbd/src/cli/commands/init.ts` | Remove `setup auto` call, add prefix auto-detection |
| `packages/tbd/src/cli/commands/setup.ts` | Add default action handler, integrate init logic |
| `packages/tbd/src/cli/cli.ts` | Update help footer |
| `packages/tbd/SKILL.md` | Update to mention `tbd setup` as entry point |
| `docs/tbd-design.md` | Update §6.4 Installation section |

### New Utilities Needed

```typescript
// packages/tbd/src/cli/lib/prefix-detection.ts
export function autoDetectPrefix(): string;
export function isValidPrefix(s: string): boolean;
export function extractRepoNameFromRemote(url: string): string | null;
```

### Integration Points

The new `tbd setup` default handler will:
1. Call existing `tbd status` logic to detect state
2. Call new prefix auto-detection
3. Call existing `initConfig()` from init.ts
4. Call existing `SetupAutoHandler` from setup.ts

## Stage 3: Implementation (Pending)

Implementation will be done in phases:

### Phase 1: Help Footer + Prefix Auto-Detection

- [ ] Add help footer guidance
- [ ] Implement prefix auto-detection utility
- [ ] Update `tbd init` to use auto-detection when --prefix not provided

### Phase 2: `tbd setup` Default Handler

- [ ] Create SetupDefaultHandler class
- [ ] Implement interactive mode with prompts
- [ ] Implement `--auto` non-interactive mode
- [ ] Integrate with existing init and setup-auto logic

### Phase 3: Cleanup

- [ ] Remove `setup auto` call from `init.ts`
- [ ] Add deprecation notice for `tbd setup auto` (still works)
- [ ] Update documentation and SKILL.md
- [ ] Update design doc §6.4

### Phase 4: Testing

- [ ] Unit tests for prefix auto-detection
- [ ] Integration tests for setup flows
- [ ] Golden tests for new output formats

## Open Questions

1. Should `tbd setup` on an already-initialized repo offer to update outdated skill
   files?

2. What should the brief “prime” banner at the start of `tbd setup` contain?
   Currently thinking just the tagline and 3 bullet points.

3. Should we add `tbd setup --check` as alias for checking all integrations at once?
