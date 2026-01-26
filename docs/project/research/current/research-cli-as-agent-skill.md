# Research Brief: CLI as Agent Skill - Best Practices for TypeScript CLIs in Claude Code

**Last Updated**: 2026-01-25

**Status**: Complete (Revised)

**Related**:

- [tbd Design Doc](../../tbd-design.md)
- [Streamlined Init/Setup Spec](../specs/active/plan-2026-01-20-streamlined-init-setup-design.md)
- [Agent Orientation Experience Spec](../specs/active/plan-2026-01-25-agent-orientation-experience.md)
- [Unix Philosophy for Agents](./research-unix-philosophy-for-agents.md)

* * *

## Executive Summary

This research brief documents best practices for building TypeScript CLI applications
that function as powerful skills within Claude Code and potentially other AI coding
agents. The patterns are derived from the `tbd` CLI implementation, which serves as a
reference architecture for agent-integrated command-line tools.

The core insight is that a CLI can be much more than a command executor—it can be a
**dynamic skill module** that provides context management, self-documentation, and
seamless integration with multiple AI agents through a single npm package.

A second key insight is that CLIs can serve as **knowledge libraries**—bundling
guidelines, shortcuts, and templates that agents can query on-demand to improve the
quality of their work.
This transforms the CLI from a tool the agent tells users about into a resource the
agent uses to better serve users.

**Research Questions**:

1. What architectural patterns make a CLI work well as an agent skill?

2. How should CLIs handle context management for agents with limited context windows?

3. What setup flows work best for both human users and AI agents?

4. How can a single CLI integrate with multiple agent platforms (Claude, Cursor, Codex)?

5. How can CLIs provide reusable knowledge (guidelines, workflows, templates) that
   agents can leverage to improve work quality?

6. What mental model should agents have when using CLI tools—messenger or partner?

* * *

## Research Methodology

### Approach

Analysis of the `tbd` CLI implementation, iterative development through PR review, and
testing with Claude Code in real-world scenarios.
Patterns were validated through CI testing and actual agent usage.

### Sources

- tbd source code (`packages/tbd/src/cli/`)
- Claude Code skill documentation
- Cursor IDE MDC format specification
- OpenAI Codex AGENTS.md convention

* * *

## Research Findings

### 1. CLI as Skill Architecture

#### 1.1 Bundled Documentation Pattern

**Status**: ✅ Complete

**Details**:

- Bundle documentation files (`SKILL.md`, `README.md`, docs) into the CLI distribution
- Use a `dist/docs/` directory alongside the bundled CLI
- Implement fallback loading: bundled → development source → repo-level docs
- This ensures the CLI is self-contained and works in any environment

**Implementation Pattern**:

```typescript
function getDocPath(filename: string): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, 'docs', filename);
}

async function loadDocContent(filename: string): Promise<string> {
  // Try bundled location first
  try {
    return await readFile(getDocPath(filename), 'utf-8');
  } catch {
    // Fallback chain: dev path → repo path → error
  }
}
```

**Assessment**: Essential pattern.
Self-contained CLIs work in sandboxed environments, containers, and CI where external
files may not be accessible.

* * *

#### 1.2 Multi-Agent Integration Files

**Status**: ✅ Complete

**Details**:

Each agent platform has different file format requirements:

| Agent | File | Format | Location |
| --- | --- | --- | --- |
| Claude Code | SKILL.md | YAML frontmatter + Markdown | `.claude/skills/tbd/` |
| Cursor IDE | CURSOR.mdc | MDC frontmatter + Markdown | `.cursor/rules/` |
| Codex | AGENTS.md | HTML markers + Markdown | repo root |

**SKILL.md Format** (Claude Code):
```yaml
---
name: tbd
description: Lightweight, git-native issue tracking...
allowed-tools: Bash(tbd:*), Read, Write
---
# tbd Workflow
...
```

**CURSOR.mdc Format** (Cursor IDE):
```yaml
---
description: tbd workflow rules for git-native issue tracking...
alwaysApply: false
---
# tbd Workflow
...
```

**AGENTS.md Format** (Codex):
```markdown
<!-- BEGIN TBD INTEGRATION -->
# tbd Workflow
...
<!-- END TBD INTEGRATION -->
```

**Assessment**: Use markers/frontmatter appropriate to each platform.
Store source files in `src/docs/` and bundle them for distribution.

* * *

### 2. Context Management Commands

#### 2.1 Prime Command Pattern

**Status**: ✅ Complete

**Details**:

The `prime` command is the key context management primitive.
It outputs contextual information appropriate to the current state:

- **Initialized repo**: Dashboard with status, rules, quick reference
- **Not initialized**: Setup instructions
- **Beads detected**: Migration warning

**Key Features**:

- Called automatically via hooks at session start and before context compaction
- `--brief` flag for constrained contexts (~200 tokens)
- `--full` flag for complete skill documentation
- Custom override via `.tbd/PRIME.md` file
- Default when running CLI with no command (`tbd` runs `tbd prime`)

**Dashboard Output Structure**:
```
tbd v0.1.4

--- INSTALLATION ---
✓ tbd installed (v0.1.4)
✓ Initialized in this repo
✓ Hooks installed

--- PROJECT STATUS ---
Repository: proj
Issues: 3 open (1 in_progress) | 1 blocked

--- WORKFLOW RULES ---
- Track all task work as issues using tbd
- Check `tbd ready` for available work
- Run `tbd sync` at session end

--- QUICK REFERENCE ---
tbd ready              Show issues ready to work
tbd show <id>          View issue details
...
```

**Assessment**: The prime pattern is highly effective.
Agents get context-appropriate information without overwhelming their context window.

* * *

#### 2.2 Skill Command Pattern

**Status**: ✅ Complete

**Details**:

The `skill` command outputs the full SKILL.md content for agents that need complete
documentation. Separate from `prime` to allow different context strategies:

- `tbd prime` → Dashboard (default, compact)
- `tbd skill` → Full documentation
- `tbd skill --brief` → Condensed rules only

**Assessment**: Separating dashboard from full skill content allows agents to request
the appropriate level of detail based on their needs.

* * *

#### 2.3 Context Recovery Pattern

**Status**: ✅ Complete

**Details**:

Include explicit context recovery instructions in all documentation:

```markdown
> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session.
> Hooks auto-call this in Claude Code when .tbd/ detected.
```

This ensures agents know how to restore context after context window events.

* * *

### 3. Self-Documenting CLI Pattern

#### 3.1 Documentation Commands

**Status**: ✅ Complete

**Details**:

Implement multiple documentation access points:

| Command | Purpose | Source |
| --- | --- | --- |
| `tbd readme` | GitHub landing page | README.md |
| `tbd docs [topic]` | CLI reference | tbd-docs.md |
| `tbd design [topic]` | Architecture docs | tbd-design.md |
| `tbd skill` | Agent skill file | SKILL.md |
| `tbd closing` | Session protocol | tbd-closing.md |

**Features**:

- `--list` flag to show available sections
- Section filtering by topic/slug
- Markdown rendering with terminal colorization
- Same content accessible in CLI as on GitHub

**Assessment**: Self-documenting CLIs reduce dependency on external documentation and
work better in sandboxed environments.

* * *

#### 3.2 Help Epilog Pattern

**Status**: ✅ Complete

**Details**:

The help output should include a “Getting Started” section:

```
Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

For more on tbd, see: https://github.com/jlevy/tbd
```

**Implementation**:

```typescript
export function createHelpEpilog(colorOption: ColorOption = 'auto'): string {
  const colors = pc.createColors(shouldColorize(colorOption));
  const lines = [
    colors.bold('Getting Started:'),
    `  ${colors.green('npm install -g tbd-git@latest && tbd setup --auto')}`,
    '',
    '  This initializes tbd and configures your coding agents automatically.',
    `  For interactive setup: ${colors.dim('tbd setup --interactive')}`,
    `  For manual control: ${colors.dim('tbd init --help')}`,
    '',
    colors.blue('For more on tbd, see: https://github.com/jlevy/tbd'),
  ];
  return lines.join('\n');
}
```

**Assessment**: The one-liner installation command is critical for agent usability.
Agents can copy-paste directly from help output.

* * *

### 4. Setup Flow Patterns

#### 4.1 Two-Tier Command Structure

**Status**: ✅ Complete

**Details**:

Implement two levels of setup commands:

| Command | Purpose | Audience |
| --- | --- | --- |
| `tbd setup --auto` | Full setup with auto-detection | Agents, scripts |
| `tbd setup --interactive` | Prompted setup | Humans |
| `tbd init --prefix=X` | Surgical initialization only | Advanced users |

**Decision Tree**:

```
setup --auto:
  1. Not in git repo → Error with guidance
  2. Has .tbd/ → Check/update integrations
  3. Has .beads/ → Migration flow
  4. Fresh repo → Initialize + configure integrations
```

**Assessment**: The two-tier structure allows both “just make it work” (setup) and “I
know what I’m doing” (init) approaches.

* * *

#### 4.2 Mode Flags Pattern

**Status**: ✅ Complete

**Details**:

Always require explicit mode selection for setup commands:

```bash
tbd setup              # Shows help, requires mode flag
tbd setup --auto       # Non-interactive (for agents)
tbd setup --interactive # Interactive (for humans)
```

**Why This Matters**:

- Prevents agents from getting stuck in interactive prompts
- Ensures humans get guided experience when they want it
- Explicit is better than implicit for setup operations

**Agent Instructions**:

```markdown
**IMPORTANT FOR AGENTS:** Always use `--auto` flag.
The command `tbd setup` without flags shows help and requires a mode flag.
Use `--interactive` for humans, `--auto` for agents.
Agents should ALWAYS run `tbd setup --auto`.
```

* * *

#### 4.3 Auto-Detection Pattern

**Status**: ✅ Complete

**Details**:

Implement automatic detection for common configuration:

1. **Prefix Detection**: Extract from git remote URL
   ```typescript
   function extractRepoNameFromRemote(url: string): string | null {
     // git@github.com:user/repo-name.git → repo-name
     // https://github.com/user/repo-name → repo-name
   }
   ```

2. **Agent Detection**: Check for agent indicators
   ```typescript
   // Claude Code: ~/.claude/ directory or CLAUDE_* env vars
   const hasClaudeDir = await pathExists(join(homedir(), '.claude'));
   const hasClaudeEnv = Object.keys(process.env).some(k => k.startsWith('CLAUDE_'));
   
   // Cursor IDE: .cursor/ directory in project
   const cursorDir = join(cwd, '.cursor');
   
   // Codex: existing AGENTS.md or CODEX_* env vars
   const hasAgentsMd = await pathExists(join(cwd, 'AGENTS.md'));
   ```

**Assessment**: Auto-detection eliminates configuration burden for the common case while
still allowing explicit overrides (`--prefix=X`).

* * *

### 5. Agent Integration Patterns

#### 5.1 Claude Code Hooks

**Status**: ✅ Complete

**Details**:

Configure Claude Code hooks for automatic context management:

**Global Hooks** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "tbd prime" }]
    }],
    "PreCompact": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "tbd prime" }]
    }]
  }
}
```

**Project Hooks** (`.claude/settings.json`):
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/tbd-closing-reminder.sh"
      }]
    }]
  }
}
```

**Hook Script** (`.claude/hooks/tbd-closing-reminder.sh`):
```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

if [[ "$command" == git\ push* ]] || [[ "$command" == *"&& git push"* ]]; then
  if [ -d ".tbd" ]; then
    tbd closing
  fi
fi
exit 0
```

**Assessment**: Hooks ensure agents always have context without manual intervention.
The PostToolUse hook prevents premature session completion.

* * *

#### 5.2 Skill File Installation

**Status**: ✅ Complete

**Details**:

Install skill file to Claude Code’s skill directory:

```typescript
const skillPath = join(cwd, '.claude', 'skills', 'tbd', 'SKILL.md');
await mkdir(dirname(skillPath), { recursive: true });
const skillContent = await loadSkillContent();
await writeFile(skillPath, skillContent);
```

The skill file includes:
- YAML frontmatter with `name`, `description`, `allowed-tools`
- Complete workflow documentation
- Session closing protocol
- Command reference

**Assessment**: Skills become available to Claude Code automatically when the directory
structure is correct.

* * *

### 6. Output Modes Pattern

#### 6.1 Machine-Readable Output

**Status**: ✅ Complete

**Details**:

Implement consistent output mode flags:

| Flag | Purpose | Example |
| --- | --- | --- |
| `--json` | JSON output for parsing | `tbd list --json \| jq '.issues'` |
| `--quiet` | Suppress non-essential output | `tbd init --quiet` |
| `--verbose` | Debug information | `tbd sync --verbose` |
| `--color <when>` | Color control | `--color never` for CI |

**Implementation Pattern**:

```typescript
this.output.data(
  { installed: true, path: settingsPath },  // JSON structure
  () => {
    // Human-readable rendering
    console.log('✓ Installed successfully');
  }
);
```

**Assessment**: The `output.data()` pattern allows single code path for both modes.

* * *

### 7. Agent-Friendly Design Principles

#### 7.1 Clear Error Messages with Next Steps

**Status**: ✅ Complete

**Details**:

Always provide actionable guidance in error messages:

```typescript
throw new ValidationError(
  'The --prefix option is required\n\n' +
  'Usage: tbd init --prefix=<name>\n\n' +
  'The prefix is used for display IDs (e.g., proj-a7k2, myapp-b3m9)\n' +
  'Choose a short, memorable prefix for your project.\n\n' +
  'For automatic prefix detection, use: tbd setup --auto'
);
```

* * *

#### 7.2 Deprecation with Migration Guidance

**Status**: ✅ Complete

**Details**:

When deprecating commands, keep them functional but add clear migration guidance:

```typescript
console.log('Note: --from-beads is deprecated.');
console.log('Use: tbd setup --from-beads');
console.log('');
// Continue executing the deprecated path
```

* * *

#### 7.3 Session Closing Protocol

**Status**: ✅ Complete

**Details**:

Define explicit session completion requirements:

```markdown
# SESSION CLOSING PROTOCOL

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

[ ] 1. Stage and commit: git add + git commit
[ ] 2. Push to remote: git push
[ ] 3. Start CI watch (BLOCKS until done): gh pr checks <PR> --watch 2>&1
[ ] 4. While CI runs: tbd close/update <id> for issues worked on
[ ] 5. While CI runs: tbd sync
[ ] 6. Return to step 3 and CONFIRM CI passed
[ ] 7. If CI failed: fix, re-push, restart from step 3
```

**Assessment**: Explicit checklists prevent agents from prematurely declaring
completion.

* * *

### 8. Agent Mental Model Patterns

#### 8.1 Agent as Partner, Not Messenger

**Status**: ✅ Complete

**Details**:

The fundamental mental model shift for agent-integrated CLIs is from:
> “Here are commands you can tell the user about”

To:
> “Here’s how this tool helps you (the agent) serve the user better”

This means the CLI should explain its **value proposition** in terms of what problems it
solves, not just command syntax.
The agent should understand *why* to use the tool and *when* to reach for it
proactively.

**Implementation Pattern**:

Structure skill file orientation around capabilities, not commands:

```markdown
## What This Tool Does

1. **Issue Tracking**: Track tasks, bugs, features. Never lose discovered work.
2. **Coding Guidelines**: Best practices the agent can pull in when relevant.
3. **Workflow Shortcuts**: Pre-built processes for common tasks.
4. **Templates**: Starting points for common document types.

## How to Use It to Help Users

- User describes a bug → create an issue
- User wants a feature → create a plan spec, then break into issues
- Starting a session → check for available work
- Completing work → close issues with clear reasons
```

**Assessment**: When agents understand the tool’s value proposition, they use it
proactively rather than just relaying commands to users.
The tool becomes a capability amplifier rather than a command reference.

* * *

#### 8.2 Informational Commands Pattern

**Status**: ✅ Complete

**Details**:

A key architectural pattern is the distinction between **action commands** and
**informational commands**:

| Type | Purpose | Example |
| --- | --- | --- |
| Action commands | Perform operations | `create`, `close`, `sync` |
| Informational commands | Output guidance for the agent to follow | `shortcut`, `guidelines`, `template` |

Informational commands don’t perform actions—they display instructions, best practices,
or templates that tell the agent *how* to do something well.
The agent reads the output and follows the guidance.

**Key Principle**: When unsure how to best accomplish a task, agents should run the
relevant informational command first.
These commands provide:

- Quality guidelines that improve outcomes
- Time-saving tips and patterns
- Step-by-step processes that avoid mistakes
- Best practices specific to the task

**Example Flow**:

```
User: "Build a TypeScript CLI tool"

Agent thinks: "I should check for relevant guidelines"
Agent runs: tbd guidelines typescript-cli-tool-rules
Agent receives: Comprehensive guidance on Commander.js patterns, color handling,
                output formatting, error handling...
Agent uses: This guidance while implementing the CLI
```

**Assessment**: This pattern lets CLIs serve as on-demand knowledge bases.
The CLI bundles hard-won knowledge that agents can query contextually, dramatically
improving output quality without increasing the agent’s base training.

* * *

#### 8.3 Resource Library Pattern

**Status**: ✅ Complete

**Details**:

Beyond core functionality, agent-integrated CLIs can bundle **resource libraries**—
collections of guidelines, shortcuts, and templates that agents access on-demand.

**Resource Types**:

| Resource | Purpose | Access Pattern |
| --- | --- | --- |
| Guidelines | Best practices for specific domains | `cli guidelines <name>` |
| Shortcuts | Step-by-step workflow instructions | `cli shortcut <name>` |
| Templates | Document starting points | `cli template <name>` |

**Guidelines** encode domain expertise:
- Language-specific rules (TypeScript, Python)
- Testing patterns (TDD, golden testing)
- Architecture patterns (monorepos, CLI tools)

**Shortcuts** encode workflows:
- Planning processes (write spec → break into issues → implement)
- Shipping processes (commit → PR → validate)
- Review processes (code review checklists)

**Templates** provide structure:
- Planning specs for features
- Research briefs for investigations
- Architecture docs for designs

**Implementation Pattern**:

```typescript
// Resource loading with bundled fallback
async function loadResource(type: 'guideline' | 'shortcut' | 'template', name: string) {
  const bundledPath = join(__dirname, 'resources', type, `${name}.md`);
  const content = await readFile(bundledPath, 'utf-8');
  return content;
}

// List available resources
async function listResources(type: string) {
  const dir = join(__dirname, 'resources', type);
  const files = await readdir(dir);
  return files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
}
```

**Benefits**:

1. **Self-contained**: Resources ship with the CLI, no external dependencies
2. **Versionable**: Resource improvements ship with CLI updates
3. **Discoverable**: `--list` flags help agents find available resources
4. **Contextual**: Agents query relevant resources just-in-time

**Assessment**: Resource libraries transform CLIs from single-purpose tools into
comprehensive development assistants.
The CLI becomes a curated knowledge base that agents leverage to produce higher-quality
work.

* * *

#### 8.4 Resource Directory Pattern

**Status**: ✅ Complete

**Details**:

When documenting available resources (shortcuts, guidelines, templates), show the **full
command to run**, not just the resource name.
This removes friction for agents.

**Anti-pattern** (name only):
```markdown
## Available Shortcuts
- commit-code
- create-or-update-pr-simple
- new-plan-spec
```

**Preferred pattern** (full command):
```markdown
## Available Shortcuts

| Command | Purpose | Description |
|---------|---------|-------------|
| `tbd shortcut commit-code` | Commit Code | How to run pre-commit checks and commit |
| `tbd shortcut create-or-update-pr-simple` | Create PR | How to create a pull request |
| `tbd shortcut new-plan-spec` | Plan Feature | How to create a planning specification |
```

**Why This Matters**:

- Agents can copy/run commands directly
- No ambiguity about command syntax
- Self-documenting—clear what each command does
- Reduces cognitive load for agents parsing documentation

**Assessment**: Small formatting changes in documentation significantly impact agent
usability. Always optimize for copy-paste execution.

* * *

#### 8.5 Category Organization Pattern

**Status**: ✅ Complete

**Details**:

Organize resources by **purpose or workflow phase**, not alphabetically.
This helps agents find relevant resources based on what they’re trying to accomplish.

**Shortcut Categories** (by workflow phase):

| Category | Resources | When to Use |
| --- | --- | --- |
| Planning | `new-plan-spec`, `new-research-brief`, `new-architecture-doc` | Starting new work |
| Implementation | `implement-beads`, `new-implementation-beads-from-spec` | Building features |
| Quality | `new-validation-plan`, `precommit-process`, `review-code-*` | Ensuring quality |
| Shipping | `commit-code`, `create-pr-*` | Delivering work |

**Guideline Categories** (by domain):

| Category | Resources | When to Use |
| --- | --- | --- |
| TypeScript | `typescript-rules`, `typescript-cli-tool-rules`, `typescript-monorepo-patterns` | TS development |
| Python | `python-rules`, `python-cli-patterns` | Python development |
| Testing | `general-tdd-guidelines`, `general-testing-rules`, `golden-testing-guidelines` | Writing tests |
| General | `general-coding-rules`, `general-comment-rules`, `backward-compatibility-rules` | Any development |

**Implementation**:

```bash
# Category filtering
tbd shortcut --category planning
tbd guidelines --category typescript
```

**Assessment**: Category organization transforms flat resource lists into navigable
knowledge structures.
Agents can quickly locate resources relevant to their current task phase.

* * *

#### 8.6 Value-First Orientation Pattern

**Status**: ✅ Complete

**Details**:

Skill files should lead with **value proposition**, not installation instructions.
Agents need to understand *why* to use a tool before *how*.

**Anti-pattern** (installation-first):
```markdown
# mytool

## Installation
npm install -g mytool

## Commands
mytool init
mytool do-thing
...
```

**Preferred pattern** (value-first):
```markdown
# mytool Agent Orientation

## What mytool Is

mytool helps you (the agent) help users by providing:

1. **Capability A**: Description of what it enables
2. **Capability B**: Description of what it enables
3. **Capability C**: Description of what it enables

## How to Use mytool to Help Users

- User wants X → use capability A
- User wants Y → use capability B
- User mentions Z → proactively suggest capability C

## Installation (if needed)

...
```

**Assessment**: Value-first orientation enables agents to make intelligent decisions
about when and how to use tools.
Installation is only relevant if the tool isn’t already set up.

* * *

### 9. Setup Flow Refinements

#### 9.1 Never Guess User Preferences

**Status**: ✅ Complete

**Details**:

For configuration values that are matters of user taste (not technical requirements),
**never guess or auto-detect**. Always ask the user.

**Examples of preference values**:
- Project prefixes/abbreviations (e.g., “myapp” vs “ma” vs “cool”)
- Naming conventions
- Style choices

**Why This Matters**:

The prefix appears in every issue ID and becomes part of the project’s vocabulary.
Auto-detecting from repo name might produce something the user dislikes.
Better to ask once than to have wrong values everywhere.

**Agent Prompt Template**:
```
"I'll set up [tool] for this project.
What prefix would you like for issue IDs?
This is typically a short name (2-4 letters) derived from your project name.
For example, a project called 'my-cool-app' might use 'mca' or 'cool'.
Issues will appear as `<prefix>-a1b2`."
```

**Implementation**:
- `setup --interactive`: Prompts for preferences
- `setup --auto --prefix=X`: Requires explicit preference values
- Never silently infer preference values

**Assessment**: Respecting user preferences builds trust.
A tool that imposes choices feels presumptuous; a tool that asks feels collaborative.

* * *

#### 9.2 Multi-Contributor Setup Flow

**Status**: ✅ Complete

**Details**:

CLI setup must handle both **initial setup** and **joining existing projects**
gracefully. This is critical for team workflows.

**States to detect**:

| State | Detection | Setup Behavior |
| --- | --- | --- |
| Fresh project | No `.tbd/`, no `.beads/` | Full init, `--prefix` required |
| Migration | Has `.beads/`, no `.tbd/` | Migrate, use existing prefix |
| Joining project | Has `.tbd/` | Configure local hooks only, no prefix needed |

**First contributor flow**:
```bash
npm install -g tbd-git@latest
tbd setup --auto --prefix=myproject
git add .tbd/ .claude/ && git commit -m "Initialize tbd"
git push
```

**Subsequent contributor flow**:
```bash
git clone <repo>  # .tbd/ comes with repo
npm install -g tbd-git@latest
tbd setup --auto  # Detects existing config, just sets up hooks
```

**Key Behaviors**:
- `setup --auto` on initialized project should NOT require `--prefix`
- Should skip initialization, just configure local integrations
- Should output status showing project is ready

**Assessment**: Smooth multi-contributor onboarding is essential for team adoption.
The second contributor’s experience should be nearly instant.

* * *

### 10. Orientation Hierarchy Pattern

#### 10.1 Two-Level Orientation

**Status**: ✅ Complete

**Details**:

Provide exactly two levels of orientation: **full** (default) and **brief**. Avoid three
or more levels which create confusion about which to use.

| Command | Lines | When to Use |
| --- | --- | --- |
| `cli prime` | ~200 | Session start, full orientation needed |
| `cli prime --brief` | ~35 | Context recovery, constrained situations |

**Full orientation includes**:
- Dynamic status (installation state, project state, issue counts)
- Static content (value proposition, workflow rules, all commands)
- Resource directory (shortcuts, guidelines, templates)

**Brief orientation includes**:
- Condensed status
- Core workflow rules only
- Quick reference (most common commands)
- Session closing checklist

**Relationship to skill file**:
- `cli skill` outputs static content only (for file installation)
- `cli prime` = dynamic status + skill content
- `cli prime --brief` = condensed status + `cli skill --brief`

**Assessment**: Two levels is the right granularity.
Full for comprehensive understanding, brief for context recovery.
More levels create decision paralysis.

* * *

## Best Practices Summary

### Architecture

1. **Bundle documentation with CLI**: Self-contained packages work in all environments
2. **Implement fallback loading**: Support both bundled and development modes
3. **Use platform-appropriate formats**: SKILL.md for Claude, MDC for Cursor, markers
   for AGENTS.md

### Context Management

4. **Implement a `prime` command**: Dashboard at session start, brief mode for
   constrained contexts
5. **Separate skill from dashboard**: Different verbosity levels for different needs
6. **Include context recovery instructions**: Agents need to know how to restore context

### Self-Documentation

7. **Provide documentation commands**: `readme`, `docs`, `design` as built-in commands
8. **Include Getting Started in help epilog**: One-liner must be easily accessible
9. **Use Markdown with terminal rendering**: Same content works in CLI and GitHub

### Setup Flows

10. **Two-tier command structure**: High-level (`setup`) and surgical (`init`)
11. **Require explicit mode flags**: `--auto` for agents, `--interactive` for humans
12. **Auto-detect when possible**: Prefix from git remote, agents from environment

### Agent Integration

13. **Install hooks programmatically**: SessionStart, PreCompact, PostToolUse
14. **Use skill directories**: `.claude/skills/`, `.cursor/rules/`
15. **Support multiple agents**: Single CLI, multiple integration points

### Output

16. **Implement `--json` for all commands**: Machine-readable output is essential
17. **Use `output.data()` pattern**: Single code path for JSON and human output
18. **Provide `--quiet` mode**: For scripted usage without noise

### Error Handling

19. **Include next steps in errors**: Actionable guidance, not just error messages
20. **Graceful deprecation**: Keep old commands working with migration guidance
21. **Explicit completion protocols**: Checklists prevent premature completion

* * *

## Open Research Questions

1. **Cross-agent skill synchronization**: How to keep skills in sync across Claude,
   Cursor, Codex when formats differ?

2. **Context budget optimization**: What’s the optimal token budget for different
   context window sizes?

3. **Hook composition**: How should multiple CLIs with hooks interact?

* * *

## Recommendations

### Summary

Build CLIs as self-contained skill modules that can be installed via npm and
automatically integrate with multiple AI coding agents.
The key patterns are: bundled documentation, prime-first context management, two-tier
setup flows, and multi-agent integration files.

### Recommended Approach

1. **Start with SKILL.md**: Define the agent-facing documentation first
2. **Implement `prime` and `skill` commands**: Context management is foundational
3. **Build two-tier setup**: `setup --auto` for agents, surgical `init` for advanced
   users
4. **Add hooks installation**: Automatic context injection via SessionStart/PreCompact
5. **Support JSON output**: Every command should have `--json` mode

### Alternative Approaches

- **MCP-based integration**: For deeper agent integration, consider MCP protocol
- **Remote skill hosting**: For frequently updated skills, consider remote loading
- **Agent-specific packages**: For platforms with unique requirements, separate packages

* * *

## References

- Claude Code Skills Documentation: https://docs.anthropic.com/claude-code/skills
- Cursor IDE MDC Format: https://cursor.sh/docs/rules
- Commander.js: https://github.com/tj/commander.js
- tbd Source Code: https://github.com/jlevy/tbd

* * *

## Appendices

### Appendix A: File Structure for Agent-Integrated CLI

```
packages/tbd/
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── prime.ts      # Context management
│   │   │   ├── skill.ts      # Skill output
│   │   │   ├── setup.ts      # Agent integration
│   │   │   ├── init.ts       # Surgical init
│   │   │   ├── docs.ts       # Documentation
│   │   │   ├── readme.ts     # README display
│   │   │   └── closing.ts    # Session protocol
│   │   ├── lib/
│   │   │   ├── output.ts     # Output modes, colors, help epilog
│   │   │   └── base-command.ts
│   │   └── cli.ts            # Program setup, default command
│   └── docs/
│       ├── SKILL.md          # Claude Code skill
│       ├── CURSOR.mdc        # Cursor IDE rules
│       ├── tbd-docs.md       # CLI reference
│       └── tbd-closing.md    # Session protocol
├── dist/
│   ├── bin.mjs               # Bundled CLI
│   └── docs/                 # Bundled documentation
│       ├── SKILL.md
│       ├── CURSOR.mdc
│       ├── README.md
│       └── ...
└── package.json
```

### Appendix B: Integration Checklist for New CLIs

- [ ] SKILL.md with YAML frontmatter (name, description, allowed-tools)
- [ ] CURSOR.mdc with MDC frontmatter (description, alwaysApply)
- [ ] AGENTS.md section with HTML markers
- [ ] `prime` command with dashboard and brief modes
- [ ] `skill` command for full documentation output
- [ ] `setup --auto` for agent-friendly installation
- [ ] `init --prefix` for surgical initialization
- [ ] SessionStart hook to call `prime`
- [ ] PreCompact hook to call `prime`
- [ ] PostToolUse hook for session completion reminders
- [ ] `--json` flag on all commands
- [ ] Help epilog with one-liner installation command
- [ ] Documentation commands (`readme`, `docs`)
- [ ] Context recovery instructions in all docs
- [ ] Session closing protocol checklist
