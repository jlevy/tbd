# Research Brief: Beads Bootstrapping and Initialization Mechanisms

**Last Updated**: 2026-01-16

**Status**: Complete

> **Archived research, 2026-09-06:** This January initialization study is historical;
> see
> [Bead Watching, Comments, and Cross-Agent Coordination](../current/research-2026-09-06-bead-agent-coordination.md)
> for the current Beads landscape and tbd coordination baseline.
> The SQLite/JSONL architecture and proposed tbd bootstrap are superseded.
> Layered installation, initialization, context injection, and thin hook adapters remain
> useful lessons. The unpinned download/install examples and Go-install advice are not
> current tbd setup instructions; follow the repository’s current setup and supply-chain
> guidance. Local attic links below are historical pointers, not pinned source evidence.

**Related**:

- [attic/beads/](attic/beads/) - Beads source code
- [attic/beads/docs/INSTALLING.md](attic/beads/docs/INSTALLING.md) - Installation
  documentation
- [attic/beads/docs/CLAUDE_INTEGRATION.md](attic/beads/docs/CLAUDE_INTEGRATION.md) -
  Claude Code integration design

* * *

## Executive Summary

This research brief documents all the mechanisms Beads uses to bootstrap and initialize
itself across different environments and agents.
Understanding these patterns is essential for implementing similar functionality in TBD.

Beads uses a **layered approach** to bootstrapping:
1. **Binary installation** - Getting `bd` command available (multiple methods)
2. **Project initialization** - Creating `.beads/` directory and database
3. **Editor/agent integration** - Injecting workflow context automatically
4. **Git integration** - Auto-syncing via hooks

The key insight is that Beads separates “installing the tool” from “setting up a
project” from “integrating with agents” - each layer is independent and optional.

**Research Questions**:

1. How does Beads install itself across different platforms?
2. How does Beads initialize a new project?
3. How does Beads integrate with different AI agents/editors?
4. How does Beads achieve “zero-config” feel while actually requiring configuration?

* * *

## Research Methodology

### Approach

Direct code analysis of the Beads source code in `attic/beads/`, focusing on:
- Installation scripts and npm package
- `bd init` command implementation
- `bd setup` command implementations for each editor
- Hook mechanisms (git hooks and Claude Code hooks)

### Sources

- [attic/beads/cmd/bd/init.go](attic/beads/cmd/bd/init.go) - Project initialization
- [attic/beads/cmd/bd/hooks.go](attic/beads/cmd/bd/hooks.go) - Git hooks
- [attic/beads/cmd/bd/setup/claude.go](attic/beads/cmd/bd/setup/claude.go) - Claude Code
  integration
- [attic/beads/cmd/bd/setup/cursor.go](attic/beads/cmd/bd/setup/cursor.go) - Cursor
  integration
- [attic/beads/cmd/bd/setup/aider.go](attic/beads/cmd/bd/setup/aider.go) - Aider
  integration
- [attic/beads/npm-package/](attic/beads/npm-package/) - npm package for cloud
  environments
- [attic/beads/cmd/bd/prime.go](attic/beads/cmd/bd/prime.go) - Context injection

* * *

## Research Findings

### 1. Binary Installation Methods

**Status**: ✅ Complete

Beads provides **6 different installation methods** to cover all environments:

| Method | Command | Best For | How It Works |
| --- | --- | --- | --- |
| **Homebrew** | `brew install bd` | macOS/Linux users | Pre-built binary from tap |
| **npm** | `npm install -g @beads/bd` | Node.js environments, Claude Code Cloud | Downloads native binary during postinstall |
| **go install** | `go install github.com/.../bd@latest` | Go developers | Builds from source |
| **Install script** | `curl ... \| bash` | Quick setup, CI/CD | Detects platform, uses go install or builds |
| **AUR** | `yay -S beads-git` | Arch Linux | Community-maintained |
| **From source** | `go build` | Contributors | Manual build |

**Key Design Decisions**:
- npm package wraps native binary (not WASM) for full SQLite support
- postinstall.js downloads platform-specific binary from GitHub releases
- Silent fallback when not in beads project (exit 0, no stderr)

**npm Package Flow**
([attic/beads/npm-package/scripts/postinstall.js](attic/beads/npm-package/scripts/postinstall.js)):
```
npm install -g @beads/bd
    ↓
postinstall.js runs
    ↓
Detect platform (darwin/linux/windows) and arch (amd64/arm64)
    ↓
Download beads_X.X.X_{platform}_{arch}.tar.gz from GitHub releases
    ↓
Extract native binary to node_modules/@beads/bd/bin/
    ↓
bin/bd.js wrapper spawns native binary
```

**Assessment**: Multiple installation methods ensure broad coverage, but add maintenance
burden. The npm package is clever for cloud environments where Go isn’t available.

* * *

### 2. Project Initialization (`bd init`)

**Status**: ✅ Complete

**Source**: [attic/beads/cmd/bd/init.go](attic/beads/cmd/bd/init.go)

`bd init` creates the `.beads/` directory structure:

```
.beads/
├── beads.db           # SQLite database (or issues.jsonl in --no-db mode)
├── issues.jsonl       # Git-tracked issue export
├── interactions.jsonl # Agent audit log
├── metadata.json      # Project configuration
├── config.yaml        # User-editable config
├── README.md          # Documentation
└── .gitignore         # Ignore local files
```

**Key Features**:

1. **Auto-prefix detection**: Derives issue prefix from directory name or existing JSONL
2. **Git history import**: Imports existing issues from git if JSONL exists
3. **Worktree support**: Creates `.beads/` in main repo root for worktrees
4. **Stealth mode** (`--stealth`): Uses `.git/info/exclude` instead of tracked
   `.gitignore`
5. **No-db mode** (`--no-db`): JSONL-only for simpler workflows
6. **Fork detection**: Prompts to configure git exclude for forks

**Automatic Setup During Init**:
```go
// Install git hooks by default
if !skipHooks && isGitRepo() && !hooksInstalled() {
    installGitHooks()
}

// Install merge driver by default
if !skipMergeDriver && isGitRepo() && !mergeDriverInstalled() {
    installMergeDriver()
}

// Add instructions to AGENTS.md
addLandingThePlaneInstructions(!quiet)
```

**Assessment**: `bd init` is comprehensive but has many flags.
The automatic git hooks installation is key to the “just works” experience.

* * *

### 3. Git Hooks

**Status**: ✅ Complete

**Source**: [attic/beads/cmd/bd/hooks.go](attic/beads/cmd/bd/hooks.go)

Beads installs **5 git hooks** to `.git/hooks/`:

| Hook | Purpose | Behavior |
| --- | --- | --- |
| `pre-commit` | Flush changes before commit | Runs `bd sync --flush-only`, auto-stages JSONL |
| `post-merge` | Import after pull/merge | Runs `bd sync --import-only` |
| `pre-push` | Prevent stale pushes | Blocks push if uncommitted JSONL changes |
| `post-checkout` | Import after branch switch | Runs `bd sync --import-only` |
| `prepare-commit-msg` | Agent identity tracking | Adds `Executed-By:` trailer |

**Hook Architecture**:
- Uses “thin shim” pattern: hooks call `bd hooks run <hook-name>`
- Actual logic is in the `bd` binary (always current version)
- Supports chaining with existing hooks (`--chain` flag)
- Version-agnostic (no hook updates needed when bd upgrades)

**Installation Modes**:
- Default: `.git/hooks/` (local only)
- Shared: `.beads-hooks/` with `core.hooksPath` (committed to repo)

**Assessment**: Thin shim pattern is elegant - hooks never go stale.
The auto-staging of JSONL in pre-commit is convenient but can conflict with other hooks
(env var `BEADS_NO_AUTO_STAGE` disables).

* * *

### 4. Claude Code Integration

**Status**: ✅ Complete

**Source**: [attic/beads/cmd/bd/setup/claude.go](attic/beads/cmd/bd/setup/claude.go)

Claude Code uses **two types of hooks**:

#### A. JSON Settings Hooks (for context injection)

Location: `~/.claude/settings.json` (global) or `.claude/settings.local.json` (project)

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "bd prime" }]
    }],
    "PreCompact": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "bd prime" }]
    }]
  }
}
```

- **SessionStart**: Runs `bd prime` when session starts
- **PreCompact**: Runs `bd prime` before context compaction (preserves workflow)

#### B. Shell Scripts (for Claude Code Cloud)

Claude Code Cloud runs shell scripts from `.claude/scripts/` on SessionStart.
There are two approaches:

**Option 1: npm-based** (simpler, slower)

Location: `.claude/scripts/setup-beads.sh` or `.claude/hooks/session-start.sh`

```bash
#!/bin/bash
npm install -g @beads/bd
bd prime
```

**Option 2: Direct binary download** (faster, more control) - **Custom/Community
Solution**

Location: `.claude/scripts/setup-beads.sh`

> **Note**: This approach is NOT shipped by Beads - it’s a custom solution found in the
> wild. Beads officially documents only the npm-based approach.

```bash
#!/bin/bash
# Direct binary download - no npm dependency
set -e

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

if command -v bd &> /dev/null; then
    echo "[beads] CLI found at $(which bd)"
else
    echo "[beads] CLI not found, installing..."

    # Detect platform
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    [ "$ARCH" = "x86_64" ] && ARCH="amd64"
    [ "$ARCH" = "aarch64" ] && ARCH="arm64"

    # Get latest version from GitHub API
    BD_VERSION=$(curl -sI https://github.com/steveyegge/beads/releases/latest | \
      grep -i "^location:" | sed 's/.*tag\///' | tr -d '\r\n')

    # Download and install to ~/.local/bin
    DOWNLOAD_URL="https://github.com/steveyegge/beads/releases/download/${BD_VERSION}/beads_${BD_VERSION#v}_${OS}_${ARCH}.tar.gz"
    curl -fsSL -o /tmp/beads.tar.gz "$DOWNLOAD_URL"
    tar -xzf /tmp/beads.tar.gz -C /tmp
    mkdir -p ~/.local/bin
    cp /tmp/bd ~/.local/bin/
    chmod +x ~/.local/bin/bd
    rm -f /tmp/beads.tar.gz /tmp/bd
fi

# Run bd prime if in a beads project
if [ -d ".beads" ]; then
    bd prime
fi
```

**Key differences**:
- **npm approach**: Simpler script, relies on npm being available and fast
- **Direct download**: No npm dependency, fetches latest version from GitHub API,
  installs to `~/.local/bin/`

Both approaches:
- Check if `bd` is already installed (avoid reinstalling each session)
- Run `bd prime` at the end to inject workflow context
- Work in fresh Claude Code Cloud VMs

#### Recommended Minimal Approach for Cloud Auto-Initialization

**For most projects, npm is the best choice:**

```bash
#!/bin/bash
# .claude/hooks/session-start.sh - MINIMAL VERSION
command -v bd &>/dev/null || npm install -g @beads/bd --quiet
[ -d ".beads" ] && bd prime
```

**Why npm wins:**

| Criterion | npm | Direct Download | go install |
| --- | --- | --- | --- |
| Lines of code | 2 | 25+ | 3 |
| Dependencies | npm (always present in cloud) | curl, tar | Go (not always present) |
| Speed | ~5-10 sec | ~3-5 sec | ~30+ sec |
| Maintenance | Package version pinned | Must parse GitHub API | Source may break |
| Error handling | Built-in | Must handle manually | Built-in |
| Cross-platform | Handled by postinstall.js | Must detect OS/arch | Automatic |

**When to use direct download instead:**
- Environment has unreliable npm (rare in Claude Code Cloud)
- Need absolute fastest startup time
- npm network restrictions (some corporate environments)

**Bottom line**: Start with the 2-line npm approach.
Only switch to direct download if you hit specific issues with npm in your environment.

**The `bd prime` Command** ([attic/beads/cmd/bd/prime.go](attic/beads/cmd/bd/prime.go)):

- Detects if MCP server is active (adjusts output verbosity)
- Outputs workflow context in markdown (~~1-2k tokens CLI, ~~50 tokens MCP)
- Exits silently (code 0, no stderr) if not in beads project
- Supports custom override via `.beads/PRIME.md`
- Adapts close protocol based on branch type and daemon status

**Key Design Insight**: The hooks are global, but `bd prime` is project-aware.
This creates the “auto-initialization” feel - hooks run everywhere, but only output
context when `.beads/` exists.

**Assessment**: The separation of JSON hooks (context injection) and shell hooks
(installation) is smart.
The silent exit when not in a beads project is crucial for not breaking other projects.

* * *

### 5. Other Editor Integrations

**Status**: ✅ Complete

#### Cursor IDE

**Source**: [attic/beads/cmd/bd/setup/cursor.go](attic/beads/cmd/bd/setup/cursor.go)

Creates `.cursor/rules/beads.mdc` with workflow instructions.

#### Aider

**Source**: [attic/beads/cmd/bd/setup/aider.go](attic/beads/cmd/bd/setup/aider.go)

Creates:
- `.aider.conf.yml` - Config pointing to instructions
- `.aider/BEADS.md` - AI instructions (suggest `/run bd` commands)
- `.aider/README.md` - Human documentation

#### Gemini (Google AI Studio)

**Source**: [attic/beads/cmd/bd/setup/gemini.go](attic/beads/cmd/bd/setup/gemini.go)

Similar pattern to Aider - creates instruction files.

**Assessment**: Each editor has different conventions.
Beads adapts by creating the appropriate files for each.
No runtime hooks - just static instruction files.

* * *

### 6. MCP Server (Alternative Integration)

**Status**: ✅ Complete

**Source**: [attic/beads/integrations/beads-mcp/](attic/beads/integrations/beads-mcp/)

For MCP-only environments (Claude Desktop without shell):

```bash
# Install
uv tool install beads-mcp
# or
pip install beads-mcp
```

Configuration in `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "beads": {
      "command": "beads-mcp"
    }
  }
}
```

**Trade-offs vs CLI**:
- ❌ Higher context overhead (MCP schemas add 10-50k tokens)
- ❌ Additional latency from MCP protocol
- ✅ Works without shell access

**Assessment**: MCP is positioned as fallback, not primary integration.
The ~1-2k tokens for `bd prime` vs 10-50k for MCP schemas is a significant difference.

* * *

### 7. Project Detection (`FindBeadsDir`)

**Status**: ✅ Complete

**Source**: [attic/beads/internal/beads/beads.go](attic/beads/internal/beads/beads.go)

`FindBeadsDir()` searches for `.beads/` in this order:
1. `$BEADS_DIR` environment variable
2. Main repo root (for git worktrees)
3. Walk up directory tree from cwd

**Validation**: Directory must contain actual project files:
- `metadata.json` or `config.yaml`
- Any `*.db` file (excluding backups)
- Any `*.jsonl` file

This prevents matching `~/.beads/` (daemon registry only).

**Assessment**: The validation is important - without it, `bd prime` would output
context in every directory on machines with global beads config.

* * *

## Comparative Analysis

| Aspect | Claude Code | Cursor | Aider | MCP |
| --- | --- | --- | --- | --- |
| Context injection | SessionStart hook | Static .mdc file | Static .conf.yml | Tool schemas |
| Context size | ~1-2k tokens | ~500 tokens | ~500 tokens | 10-50k tokens |
| Refresh mechanism | PreCompact hook | Manual | Manual | Always present |
| Binary required | Yes (bd) | Yes (bd) | Yes (bd) | Yes (beads-mcp) |
| Works in cloud | Yes (npm + shell hook) | N/A | N/A | N/A |

* * *

## Best Practices from Beads

1. **Silent fallback**: Exit 0 with no stderr when not applicable
2. **Multiple installation methods**: Cover all environments
3. **Thin shim pattern**: Hooks delegate to binary (never stale)
4. **Global hooks, project-aware logic**: Install once, works everywhere
5. **Layered architecture**: Installation → Init → Editor setup (independent layers)
6. **npm as cloud bootstrap**: Use npm postinstall for environments without Go
7. **Auto-staging convenience**: Stage files automatically but provide escape hatch

* * *

## Open Research Questions

1. **Multi-repo support**: How does TBD handle multiple repos with shared tracking?
   - Beads uses redirect files for shared `.beads/` directories

2. **Daemon mode**: Is daemon-based auto-sync worth the complexity?
   - Beads daemon handles auto-commit/push but adds worktree complications

3. **Plugin vs CLI**: Should TBD have a Claude Code plugin?
   - Beads explicitly chose CLI + hooks over skills/plugin as primary

* * *

## Recommendations for TBD

### Summary

Follow Beads’ layered architecture but simplify where possible:

1. **Binary installation**: Start with npm package (covers cloud) + go install
2. **Project init**: Create `.tbd/` with similar structure
3. **Claude hooks**: Copy `bd prime` pattern (SessionStart + PreCompact)
4. **Git hooks**: Use thin shim pattern for auto-sync
5. **Other editors**: Add as needed (static instruction files)

### Recommended Approach

**Minimum Viable Cloud Bootstrap** (commit this to your repo):

```bash
# .claude/hooks/session-start.sh (2 lines!)
command -v tbd &>/dev/null || npm install -g @tbd/tbd --quiet
[ -d ".tbd" ] && tbd prime
```

**Full Layered Architecture**:

```
Layer 1: Installation
├── npm install -g @tbd/tbd (primary - works in cloud)
├── go install (for Go users)
└── brew install tbd (later)

Layer 2: Project Init (tbd init)
├── Create .tbd/ directory
├── Create database/JSONL
├── Install git hooks (thin shims)
└── Add instructions to AGENTS.md

Layer 3: Editor Integration (tbd setup claude)
├── Install SessionStart hook (runs tbd prime)
├── Install PreCompact hook (preserves context)
└── Shell hook for cloud (.claude/hooks/session-start.sh)

Layer 4: Runtime (automatic)
├── tbd prime outputs context when .tbd/ exists
├── Git hooks sync on commit/merge/checkout
└── Silent exit when not in tbd project
```

**Rationale**:
- **npm package is critical**: Enables cloud environments with minimal code
- Thin shim hooks never go stale
- Global hooks + project-aware logic creates “just works” experience
- Silent fallback prevents breaking non-TBD projects
- The 2-line shell hook is all you need to commit to make a project “cloud-ready”

### Alternative Approaches

**Simpler Alternative**: Skip npm package initially, require local bd/go install
- Pro: Less maintenance
- Con: Doesn’t work in Claude Code Cloud

**More Complex Alternative**: Add MCP server
- Pro: Works without shell
- Con: High context overhead, separate codebase to maintain

* * *

## References

- [attic/beads/docs/INSTALLING.md](attic/beads/docs/INSTALLING.md) - Complete
  installation guide
- [attic/beads/docs/CLAUDE_INTEGRATION.md](attic/beads/docs/CLAUDE_INTEGRATION.md) -
  Design rationale for CLI + hooks
- [attic/beads/npm-package/CLAUDE_CODE_WEB.md](attic/beads/npm-package/CLAUDE_CODE_WEB.md)
  \- Cloud environment guide
- [attic/beads/docs/GIT_INTEGRATION.md](attic/beads/docs/GIT_INTEGRATION.md) - Git hooks
  documentation

* * *

## Appendices

### Appendix A: Complete Hook Flow Diagram

```
User opens Claude Code
    ↓
SessionStart hook fires (from ~/.claude/settings.json)
    ↓
Runs: bd prime
    ↓
bd prime calls FindBeadsDir()
    ├── .beads/ found → Output workflow context
    └── Not found → Exit 0 (silent, no error)
    ↓
Context appears as "SessionStart:startup hook success: ..."
    ↓
User makes changes
    ↓
User runs: git commit
    ↓
pre-commit hook fires (thin shim in .git/hooks/)
    ↓
Runs: bd hooks run pre-commit
    ↓
Flushes database to JSONL, auto-stages .beads/*.jsonl
    ↓
Commit proceeds with JSONL changes included
```

### Appendix B: File Locations Summary

| File | Purpose | Created By |
| --- | --- | --- |
| `~/.claude/settings.json` | Global Claude Code hooks | `bd setup claude` |
| `.claude/settings.local.json` | Project-specific hooks/permissions | Manual or `bd setup claude --project` |
| `.claude/hooks/session-start.sh` | Cloud bootstrap script (official) | Manual (documented by beads) |
| `.claude/scripts/*.sh` | Cloud bootstrap scripts (alternative) | Manual (custom/community) |
| `.beads/` | Project data directory | `bd init` |
| `.git/hooks/pre-commit` | Thin shim calling `bd hooks run` | `bd init` or `bd hooks install` |
| `.cursor/rules/beads.mdc` | Cursor workflow instructions | `bd setup cursor` |
| `.aider.conf.yml` | Aider config | `bd setup aider` |

**Note**: Claude Code runs scripts from both `.claude/hooks/` and `.claude/scripts/` on
SessionStart. The `.claude/scripts/` location appears to be used by some community
solutions but is not documented by Beads itself.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
