# Research: Agent Knowledge-on-Demand — Dynamic, Progressive Knowledge Discovery for LLM Agents

**Date:** 2026-02-15

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** In Progress

**Related:**

- [External Docs Repos Spec](../../specs/active/plan-2026-02-02-external-docs-repos.md)
- [CLI as Agent Skill Research](./research-cli-as-agent-skill.md)
- [Skills vs Meta-Skill Architecture](./research-skills-vs-meta-skill-architecture.md)
- [Unix Philosophy for Agents](./research-unix-philosophy-for-agents.md)

---

## Executive Summary

This research brief explores the problem of **dynamic, progressive knowledge discovery
and injection for LLM coding agents**. The core challenge: agents need access to large
bodies of curated knowledge (guidelines, references, patterns, docs) spread across
multiple repositories, but context windows are finite, and the right knowledge depends
heavily on the current task.

We need a system that is simultaneously:

- A **directory** (browsable hierarchy of trusted knowledge)
- A **search engine** (keyword and semantic retrieval)
- A **context engineer** (knows what to inject when, in what form)
- A **progressive summarizer** (pyramid of detail levels: keywords → outline → full doc)
- A **forkable registry** (pull, customize, contribute back — the shadcn model)

The surprising finding is that this entire problem can likely be solved with a small,
Unix-style CLI tool that pre-computes knowledge maps from markdown document sets and
provides multiple retrieval modalities — all without requiring embedding databases,
vector stores, or complex infrastructure. The key insight is that LLMs themselves are
powerful enough to pre-compute sophisticated indices (relevance descriptors, hierarchical
summaries, keyword maps) that make subsequent retrieval both context-efficient and
reliable.

---

## Guiding Principles

These principles frame the design space and constrain solutions:

### 1. Organize a Trusted Set of Documents

By human manual or automated means, decide which documents we trust. These should be
cleaned and curated, but the system shouldn't be excessively prescriptive about their
formats — they may live in various places, typically GitHub repos as markdown. Some repos
may be custom-organized for agent reuse; others may simply have useful documentation for
an existing software project.

### 2. Pre-compute Efficient Knowledge Formats

We can pre-compute how an agent would know a document is relevant, plus context-efficient
summaries for progressive consumption. Because LLMs are so powerful, we can do
sophisticated equivalents of indexing by pre-computing relevance descriptors and
summarizations in a pyramid structure:

- **Minimal**: keyword summary of when to look at the doc, like a skill description
- **Outline**: structural overview, key sections, scope
- **Full document**: the complete content

More broadly, this extends to dynamic or hierarchical pyramid summaries for very large
doc sets.

### 3. Separate Authoring Format from Compiled Format

A key architectural insight: the format humans use to *write* docs should be completely
decoupled from the format agents use to *consume* them.

- **Authoring format**: "Whatever markdown exists in repos" — optionally with light
  metadata (YAML front matter), but no special tooling required. Humans write docs in
  their preferred editors, organize them naturally, and commit to git. The system should
  not be prescriptive about how humans write or structure their documents.

- **Compiled format**: Machine-optimized artifacts generated locally from the authoring
  sources. These include:
  - **Doc cards**: Compact descriptors ("when to use / what it contains / how to fetch")
  - **Outline**: Structural overview, key sections, heading hierarchy
  - **Summary ladder**: Multiple fidelity levels (card → S → M → L → full)
  - **Chunks**: Stable section-level fragments with anchors for partial retrieval
  - **Search indexes**: Lexical (BM25) + optional embedding vectors
  - **Provenance**: Source repo + ref + commit SHA + path for every artifact

This separation means: "don't be prescriptive about how humans write docs; be very smart
about compiling them for agent consumption."

### 4. Make These Available to Agents via Context-Efficient Tools

For efficient context engineering, agents need content in a variety of formats and
mechanisms for reading it. The most direct way: a CLI that offers all these capabilities,
with skill-style descriptions about when to use each tool.

### 5. Conserve Context by Reference, Not by Value

A critical design principle: **never put content into context when you can put a reference
instead**. This applies at every level of the system:

- **CLI inputs**: Don't pass long strings as arguments. Instead, accept file paths, doc
  IDs, or globs. An agent should say `kdex route --files=src/auth.ts,src/db.ts` rather than
  piping file contents into the command.
- **CLI outputs**: Return references (doc IDs, file paths, section anchors) that the agent
  can follow up on, not full content by default.
- **Context descriptions**: When describing "what I'm working on" to the router, reference
  files and docs by name rather than inlining their content.

This is the same principle that makes Unix pipes efficient: commands pass file handles and
short messages, not entire file contents. For agents, the principle is even more important
because every token of inline content competes with the agent's reasoning space.

The corollary: the system should make it trivially easy to *produce* references (doc IDs,
file paths, summary depth markers) and trivially easy to *dereference* them (fetch the
actual content at any depth level).

---

## Agent Access Modalities

There are five distinct modalities for how agents access knowledge. A complete solution
must support all five:

### Modality 1: Persistent Awareness (Skill-Style Descriptions)

Brief descriptions always in the context window, so an agent can "remember" knowledge
exists at any time. This is the SKILL.md / CLAUDE.md pattern — a compact directory of
what's available with trigger phrases for when to look.

**Token budget**: ~100-500 tokens per knowledge area.
**Mechanism**: Installed in skill files or CLAUDE.md during setup.
**Example**: "For TypeScript patterns, run `kdex get typescript-rules`."

### Modality 2: Exact Retrieval

The agent knows exactly what document it wants and pulls it up by name.

**Token budget**: Full document size (hundreds to thousands of tokens).
**Mechanism**: `kdex get <name>` — direct fetch by identifier.
**Example**: Agent runs `kdex get typescript-rules` and receives the full guideline.

### Modality 3: Semantic Retrieval (Search)

The agent knows what kind of knowledge it needs but not the exact document. It queries
by keywords, topic, or natural language.

**Token budget**: Variable — search results, then drill-down.
**Mechanism**: `kdex search <query>` — keyword/fuzzy/semantic search over the knowledge map.
**Example**: Agent runs `kdex search "handling database migrations"` and gets ranked
results with summaries.

### Modality 4: Knowledge Summarization (Progressive Disclosure)

For large documents or multiple search results, the agent needs an overview first and can
drill deeper selectively. This is the pyramid pattern:

1. **Index level**: One-line description per doc (what's available)
2. **Summary level**: Paragraph-level overview (what's in it)
3. **Section level**: Specific sections or key points
4. **Full level**: Complete document content

**Token budget**: Scales from ~50 to full document size.
**Mechanism**: `kdex get <name> --depth=summary|outline|full` or similar.

### Modality 5: Tool Documentation

Documentation on how to use the knowledge tools themselves. Referenced in the persistent
awareness layer. This is meta-knowledge — the agent's understanding of how to navigate
the knowledge system.

**Mechanism**: Built into the skill description and `kdex --help`.

---

## The Pre-Compiled Knowledge Map

The central technical idea: a **knowledge map** is a pre-compiled index of a document
corpus that enables all five access modalities efficiently.

### What a Knowledge Map Contains

For each document in the corpus:

```yaml
# .knowledge/map.yml (or similar)
documents:
  - id: typescript-rules
    path: guidelines/typescript-rules.md
    source: github.com/jlevy/speculate
    title: "TypeScript Rules and Best Practices"
    description: "Comprehensive TypeScript coding rules..."

    # Pre-computed for Modality 1 (persistent awareness)
    triggers:
      - "typescript"
      - "ts"
      - "type safety"
      - "TypeScript project"
    when_to_use: "When writing, reviewing, or refactoring TypeScript code"

    # Pre-computed for Modality 3 (semantic retrieval)
    keywords:
      - typescript
      - strict mode
      - type narrowing
      - discriminated unions
      - error handling
    topics:
      - language-rules
      - code-quality

    # Pre-computed for Modality 4 (progressive disclosure)
    summary: |
      Rules for TypeScript projects: strict mode, proper typing,
      error handling patterns, naming conventions, import organization.
    outline:
      - "1. Strict Configuration: tsconfig strictness requirements"
      - "2. Type Patterns: discriminated unions, branded types, narrowing"
      - "3. Error Handling: Result types, error boundaries"
      - "4. Naming: conventions for types, interfaces, enums"
      - "5. Imports: organization and barrel file patterns"

    # Metadata
    size_tokens: 3200
    last_updated: 2026-02-10
    category: language-rules
    tags: [typescript, coding-rules]
```

### How the Map is Built

The map is generated by an LLM pass over all documents:

1. **Scan**: Walk the document corpus, reading each markdown file
2. **Analyze**: For each doc, extract/generate:
   - Title, description, keywords (from content + front matter)
   - Trigger phrases (when an agent should consult this doc)
   - Summary at multiple levels (one-line, paragraph, outline)
   - Category and topic classification
   - Token count estimate
3. **Index**: Write the compiled map to a standard location
4. **Validate**: Check for naming conflicts, missing metadata, broken references

This is analogous to building a search index, but instead of inverted word indices,
we're computing **semantic relevance descriptors** that an LLM can use efficiently.

### Why Pre-Computation Matters

Without pre-computation, an agent must:
1. List available docs (reading file names)
2. Read each doc to understand what it contains
3. Decide which is relevant
4. Read the relevant one in full

This wastes enormous context. With a pre-computed map:
1. The map summary is already in context (persistent awareness)
2. Agent identifies relevant doc instantly from triggers/keywords
3. Agent requests exactly the right doc at the right depth

**The map turns O(n) document discovery into O(1) lookup.**

---

## Architecture: A Standalone Knowledge CLI

### Design Philosophy

Following the Unix philosophy for agents, knowledge management should be a **standalone
CLI tool** — not monolithically integrated into tbd or any other tool. This tool could be
called something like `kdex` (knowledge), `kb` (knowledge base), or `know`.

Reasons for separation:
- **Single responsibility**: Knowledge retrieval is orthogonal to issue tracking
- **Composability**: Any tool (tbd, custom CLIs, scripts) can invoke it
- **Portability**: Works with any agent platform (Claude, Cursor, Copilot)
- **Extensibility**: Anyone can add knowledge sources without modifying tbd
- **Library + CLI**: Can be both a library (imported by tbd) and a standalone CLI

### CLI Interface Sketch

```bash
# Setup and configuration
kdex init                          # Initialize in a project
kdex source add <url> [--prefix=X] # Add a knowledge source (git repo)
kdex source list                   # List configured sources
kdex source remove <prefix>        # Remove a source

# Building the knowledge map
kdex build                         # (Re)build knowledge map from sources
kdex build --source=<prefix>       # Rebuild for specific source
kdex status                        # Show map freshness, source status

# The always-on knowledge map
kdex map                           # Print the compact always-on map (for CLAUDE.md/SKILL.md)
kdex map --budget=500              # With token budget constraint

# Retrieval (the five modalities)
kdex list                          # List all available knowledge (Modality 1)
kdex list --category=<cat>         # Filter by category
kdex get <name>                    # Exact retrieval — full document (Modality 2)
kdex get <name> --summary          # Summary only (Modality 4)
kdex get <name> --outline          # Outline level (Modality 4)
kdex search <query>                # Semantic search (Modality 3)
kdex search <query> --top=5        # Limit results

# Progressive summarization
kdex summarize <name> --level=card   # One-liner doc card
kdex summarize <name> --level=S      # Short summary (1 paragraph)
kdex summarize <name> --level=M      # Medium summary (key points)
kdex summarize <name> --level=L      # Long summary (section-level detail)

# Context routing and injection (references, not inline content)
kdex route --files=<paths>         # Suggest relevant docs based on file references
kdex route --files=<paths> --query="..." # Combine file refs with short query
kdex inject --refs=<ref>,<ref> --budget=1200  # Assemble context block from depth-annotated refs
kdex prime                         # Output persistent awareness block (alias for map)

# All commands support:
# --json        (structured output for agents)
# stdin/stdout  (piping for humans + agents)
# Deterministic outputs where possible
```

### Integration with tbd

tbd would integrate with `kdex` as a consumer:

```typescript
// In tbd's guidelines command
import { getDocument, searchDocuments } from 'kdex';

// Or simply shell out
const result = execSync('kdex get typescript-rules');
```

The `tbd guidelines` and `tbd shortcut` commands would become thin wrappers around `kdex`
for documents that are knowledge-type content, while tbd retains ownership of
tbd-specific workflows (issue tracking, sync, setup).

---

## The Forkable Registry Model

### The Problem

Knowledge documents live in various repos. Teams need to:
1. **Pull** knowledge from trusted sources
2. **Customize** for their project (fork/override)
3. **Contribute back** improvements upstream

This is the **shadcn model** applied to documentation.

### Prior Art: Detailed Analysis

Research across six major registry systems reveals core patterns:

#### shadcn/ui — The Code Ownership Registry

shadcn/ui pioneered the "not a library, not a framework" pattern:
- A `registry.json` + per-item JSON schema describes every component
- `npx shadcn add button` copies component source into your project
- **You own the code entirely** — modify freely, no runtime dependency
- Namespaced registries (`@acme/button`) enable custom/private registries
- CLI 3.0 (August 2025) added cross-registry dependency resolution
- Anyone can host a custom registry as static JSON files

Key insight: **no update mechanism**. shadcn deliberately does not auto-merge upstream
changes. Users manually diff and review. This is simple but loses track of
customizations.

#### copier — Three-Way Merge for Template Evolution

Python's copier framework has the most sophisticated update mechanism:
- Templates are git repos with Jinja2 templating
- `copier copy <template-repo> <dest>` instantiates a template
- `.copier-answers.yml` tracks the template source, version, and all user answers
- `copier update` implements a **three-way merge**:
  1. Regenerate baseline from old template version + saved answers
  2. Compute user diff (baseline vs current project)
  3. Generate new from latest template
  4. Apply user diff to new generation
  5. Surface conflicts with inline markers

Key insight: **baseline tracking enables smart merges**. By recording what the original
looked like, the system can distinguish user changes from upstream changes.

#### Homebrew Taps — Git-Based Extension Points

Homebrew taps are Git repos following convention (`homebrew-<name>`):
- `brew tap user/repo` clones the repo to a local directory
- Formulae from the tap become available as if built-in
- `brew update` performs `git rebase` on each tap
- Custom taps allow anyone to distribute formulae without modifying core

Key insight: **decentralization through convention**. The naming convention
(`homebrew-*`) and directory structure (`Formula/`, `Casks/`) are the contract.
Anyone who follows it gets full integration.

#### MCP Registry — Federated Metadata

The MCP Registry (September 2025) is a **metaregistry** — it stores metadata about
MCP servers, not the servers themselves:
- REST API with standardized OpenAPI 3.1.0 spec
- Supports sub-registries and federation
- Server discovery via `.well-known/mcp` self-advertisement
- Namespaced identifiers (`io.github.username/server-name`)

Key insight: **separate the index from the content**. The registry is lightweight
metadata; actual artifacts live elsewhere.

### Core Principles Extracted

From studying all six systems (shadcn, copier, cookiecutter, Homebrew, npm/cargo, MCP):

1. **Code ownership over dependency**: Give users the source, not a black box
2. **Metadata-driven distribution**: A declarative schema describes each item
3. **Separation of registry from content**: The index is lightweight, content lives
   elsewhere
4. **Decentralization through convention**: Standard naming + directory structure = the
   contract
5. **Progressive complexity for updates**: Manual diff → automated three-way merge
6. **Baseline tracking**: Record what the original looked like to enable smart merges
7. **Schema-first, static-hostable**: No server needed — just files following a schema

### Two Forkability Models

From the prior art, two viable low-friction models emerge. Both can be supported without
building a platform:

**Model 1: Fork-the-Repo (Git-native, first-class)**

The "registry" is just a list of git repos in config. If someone wants to customize, they
fork the repo and point their config at the fork. Upstream contribution is standard PR
flow. This is the simplest model and should be first-class from day one:
- Zero new concepts — just git repos and config pointers
- Customization = fork + change config URL
- Contributing back = PR on the upstream repo
- Update = `git pull` on the fork, merge upstream changes

**Model 2: Vendor/Copy-In (shadcn-style, add later)**

A CLI "adopts" individual docs into a local `vendor/` area, records `_upstream` metadata
(source repo, commit SHA, path), and optionally helps update later. This mirrors shadcn's
"copy it into your project, you own it" philosophy, and also parallels copier-style
"templates evolve and projects update" patterns:
- Fine-grained: adopt individual docs, not entire repos
- Full ownership: modify freely after copy-in
- Upgrade path: `kdex diff` shows upstream changes, `kdex merge` applies them
- More complex but more flexible than fork-the-repo

**Recommendation**: Make fork-the-repo first-class immediately. Add vendor/copy-in later
when real-world usage reveals whether per-doc customization is needed.

### Proposed Knowledge Registry Model

A hybrid approach that takes the best of copier's merge intelligence and shadcn's
simplicity:

#### Pull Model (shadcn-style)

```bash
# Add a knowledge source — clones/caches the repo
kdex source add github.com/org/knowledge-base --prefix=org

# Knowledge is now available
kdex get org:typescript-rules     # Reads from cache
kdex list --source=org            # List what's available from this source
```

#### Fork Model (for customization)

```bash
# Fork a specific doc for local customization
kdex fork org:typescript-rules    # Copies to local/ prefix
# Edit local/guidelines/typescript-rules.md freely

# Local version takes precedence
kdex get typescript-rules         # Returns local version (shadows org version)
```

#### Upstream Sync Model

```bash
# Check for upstream changes
kdex source update org            # Git pull on the cached repo
kdex diff org:typescript-rules    # Compare local fork vs upstream

# Merge upstream changes into local fork
kdex merge org:typescript-rules   # Interactive merge if conflicts
```

#### The Registry Index

Each knowledge source repo contains a `knowledge.yml` (or similar) at its root:

```yaml
# knowledge.yml — registry manifest
name: speculate-knowledge
description: General coding guidelines and development shortcuts
version: "1.0"

documents:
  guidelines:
    - typescript-rules.md
    - python-rules.md
    - general-tdd-guidelines.md
  shortcuts:
    - code-review-and-commit.md
    - new-plan-spec.md
  templates:
    - plan-spec.md
    - research-brief.md
  references:
    - convex-limits.md

# Optional: pre-computed summaries (avoids LLM pass on consumer side)
map: .knowledge/map.yml
```

If the source repo includes a pre-computed map, consumers can use it directly. If not,
`kdex build` generates one locally.

#### Minimal Viable Forkable Registry for Knowledge

Based on the registry research, the minimum implementation needs:

1. **A schema for knowledge items** — YAML front matter in markdown files
   (title, description, category, tags)
2. **A registry index** — The knowledge map (`map.yml`) listing all items with metadata.
   Hostable as a static file in the repo.
3. **A CLI that fetches and writes** — `kdex source add <url>` fetches and caches
4. **A baseline record** — Track what version of each source is cached
   (git commit SHA in `.knowledge/sources.yml`)
5. **Convention for custom registries** — Namespace-prefixed sources, standard directory
   structure

**v1 (manual diff)**: Like shadcn — pull, fork, customize, but review upstream changes
manually via `kdex diff`. Simple, low friction.

**v2 (three-way merge)**: Like copier — track baseline, compute user diff, apply to
upstream changes automatically. Higher value, more complexity.

Starting with v1 is pragmatic: it validates the workflow before investing in
merge infrastructure.

---

## Related Work and Prior Art

### Agent Knowledge and Context Engineering

The field has undergone a paradigm shift from "prompt engineering" to **context
engineering** — managing the full information environment around an LLM, not just the
prompt text. A focused 300-token context often outperforms an unfocused 113,000-token
context due to attention degradation and the "lost in the middle" phenomenon.

#### How Current Coding Agents Handle Knowledge Injection

Every major agent has converged on a root-level markdown file for persistent context:

| Agent | File | Key Feature |
| --- | --- | --- |
| Claude Code | `CLAUDE.md` | Hierarchical (user > project > local) |
| Cursor | `.cursor/rules/*.mdc` | Path-scoped with glob patterns |
| Copilot | `.github/copilot-instructions.md` | Plus `.instructions.md` for file-scope |
| Windsurf | `.windsurf/rules/` | Also imports Cursor rules |
| Devin | Knowledge system | Auto-generates from repo + user-defined |
| OpenAI Codex | `AGENTS.md` + `SKILL.md` | Progressive disclosure via skills |

All use markdown. All version-control alongside code. The architecture converges on a
**three-tier model**:

1. **Persistent (always loaded)**: CLAUDE.md / .cursorrules — coding standards,
   architecture overview. Budget: <10-15% of window (~2-5K tokens).
2. **Conditional (triggered by relevance)**: Cursor's path-scoped rules, Claude's
   Skills (loaded when LLM judges relevant). Only metadata loaded initially.
3. **Just-in-time (agent-driven)**: Filesystem exploration via grep/glob/read, MCP
   resource fetching, RAG retrieval. Agent decides what to load.

#### The Four Core Operations (Write, Select, Compress, Isolate)

These operations form the lifecycle of context management:

- **Write**: Externalize state — scratchpads, progress files, memory MCPs
- **Select**: Retrieve relevant context — episodic, procedural, semantic memories
- **Compress**: Summarize aging context — auto-compact at ~95% window capacity
- **Isolate**: Sub-agents with clean windows — explore internally, return summaries

#### ACE Framework (Stanford/SambaNova/Berkeley)

Key insight: **delta updates over full rewrites** prevent context collapse. Instead of
rewriting entire contexts, perform localized delta updates that accumulate new insights
while preserving prior knowledge. Achieved +10.6% on agent benchmarks while reducing
adaptation latency by 86.9%.

#### Agent Skills Open Standard (agentskills.io)

Standardizes the SKILL.md format with progressive disclosure (Level 1: metadata, Level 2:
skill body, Level 3: resources). Now an **open standard** adopted by Anthropic, OpenAI,
Microsoft, GitHub, Cursor, and others.

#### skills.sh (Vercel)

"npm for agent skills" — discovery and installation of SKILL.md files. 47K+
installations. Distributes *capabilities* (what an agent can do), not *knowledge*
(what an agent should know). Complementary to the knowledge system we're designing.

#### Skills Ecosystem and Progressive Disclosure Standards

The skills ecosystem is converging on the exact same "inventory → load when needed"
pattern we propose for knowledge, just applied to action scripts:

- **anthropics/skills**: Documents the simple "folder with SKILL.md + YAML frontmatter"
  packaging model. The reference implementation.
- **vercel-labs/skills**: CLI-driven install/sync of skills to multiple agents. Universal
  installer approach.
- **OpenSkills**: Universal loader for the Claude skills format. Emphasizes progressive
  disclosure and AGENTS.md integration.
- **VS Code Agent Skills**: Frames Agent Skills as an open standard that works across
  multiple agents (Copilot in VS Code, CLI, etc.).

The insight: our "doc cards always in context; load details later" is exactly the same
pattern, just applied to *knowledge* instead of *action scripts*. The convergence across
independent ecosystems validates the progressive disclosure architecture.

#### Context Budgeting Guidelines

Token budgeting has become an engineering discipline:

| Component | Budget |
| --- | --- |
| System instructions | 10-15% of window |
| Persistent context (CLAUDE.md) | <12K tokens (~50KB) |
| Skill metadata (startup) | ~100 tokens per skill |
| Activated skill content | <5,000 tokens per skill |
| Sub-agent return summaries | 1,000-2,000 tokens each |
| Working space | Remainder |

Progressive context loading reduced one deployment from **$4.50/session to $0.06**
(98% cost reduction, 150K → 2K tokens). Multi-agent RAG research confirms task-specific
context retrieval outperforms universal loading by **15-40%**.

### Search and Retrieval Tools

#### Tier 1: Text Search (Foundation)

**ripgrep**: Gold standard for fast text search. Zero setup, already in every coding
agent. Handles the "I know the exact term" case perfectly. Necessary but not sufficient
for knowledge retrieval — cannot find "retry logic" when code says `attemptWithBackoff`.

**fzf**: Fuzzy finder — the `--preview` pattern (search with live preview) maps well to
progressive knowledge disclosure. Primarily human-interactive, but the fuzzy matching
algorithm and composable pipeline patterns are architecturally instructive.

#### Tier 2: Full-Text Search Engines

**SQLite FTS5 + sqlite-vec**: The most promising backend. Universal availability, single
portable `.db` file, BM25 ranking via FTS5, vector search via sqlite-vec extension (KNN
with SIMD acceleration). Combined, you get hybrid keyword + semantic search in one file.
No server needed. This is the approach used by QMD's Go reimplementation.

**Tantivy**: Lucene-inspired Rust library. Fast (indexes all Wikipedia in ~9 minutes) but
requires preprocessing pipeline for markdown. Better as an embedded library than
standalone.

#### Tier 3: Hybrid Search Systems

**QMD** (Tobi Lutke / Shopify CEO): The most sophisticated local-only solution found.
Combines BM25 + vector search + LLM re-ranking, all local. Three search modes:
`qmd search` (BM25, fast), `qmd vsearch` (vector), `qmd query` (full hybrid pipeline
with query expansion, reciprocal rank fusion, LLM re-ranking). Built-in MCP server.
Collection-based abstraction maps well to knowledge domains.

**SemTools** (LlamaIndex): Rust CLI tools using static embeddings. "Unix already gives
you grep, find, awk — but those only work with exact text. SemTools fills that gap."
Built for coding agents (tested with Claude Code on 1000 ArXiv papers). 1,600+ stars.

**BeaconBay/ck** ("semantic grep"): Hybrid semantic + regex + BM25 search with MCP
server integration. Gives grep-like workflows but semantic; includes indexing and
pagination patterns that map well to context-efficient retrieval. The router can delegate
"find candidate snippets" to something like this.

**RAGex**: MCP server combining semantic (RAG), symbolic (tree-sitter), and regex
(ripgrep) search. Automatically detects best search mode per query — powerful abstraction
for agents that shouldn't need to choose a search strategy.

**mcp-local-rag** (shinpr): Lightweight local document search (PDF/DOCX/TXT/Markdown)
with minimal setup. If the system broadens beyond markdown later, this shows a "simple
ingestion + search" MCP server pattern.

#### Tier 4: LLM Infrastructure Tools

**Simon Willison's llm CLI**: Swiss-army-knife for LLM operations. `llm embed-multi`
batch embeds files into SQLite, `llm similar` finds similar items. The SQLite-backed
embedding storage is portable and composable. Plugin ecosystem supports OpenAI, Anthropic,
Ollama, and local models. Excellent as infrastructure for knowledge map generation.

**Datasette**: SQLite-powered data exploration with full-text search, FAISS vector search
plugin, and a pattern of "put everything in SQLite, then query it."

#### Knowledge Format Standards

**llms.txt**: Emerging standard — a curated markdown index file at website root serving
as a table of contents for LLMs. H1 project name, blockquote summary, H2-delimited
resource sections. Embodies the progressive disclosure principle. Directly applicable to
the knowledge map concept.

**library-mcp** (Will Larson): MCP server over markdown files with YAML front matter.
"Datapacks" — curated content packages loaded into context windows. Demonstrates
metadata-first retrieval: agent sees tags and summaries first, fetches full content on
demand. Simple, effective, purpose-built for exactly our use case.

#### Repo Map / Progressive Expansion Tools

These tools solve the same problem for *code* that we're solving for *docs* — keeping a
compact map in context and expanding on demand:

**llm-context.py**: Rule-based context selection + outlines + MCP integration. Frames the
exact pain: "finding and copying relevant files is friction-heavy," then solves it with
composable rules and commands like `outlines`, `preview`, `context`. Their "rules as
YAML+Markdown, composable filters/excerpters" is a very strong blueprint for a docs
router that stays Unix-y.

**Aider repo map**: The canonical example of the "compact map in context, expand on
demand" pattern. Aider maintains a concise map of the entire repository in context so the
agent always knows what exists, then loads specific files when needed. Our "knowledge map
of docs" is the docs-analogue of this exact approach.

#### Repo Packing Tools

Sometimes you just want "make me a digest I can paste into an LLM" — these are not
routers, but they're useful as "break glass" context exporters and show the appetite for
the problem:

**repomix**: Packs repo into an AI-friendly single file. Supports remote repos, token
counting, and even MCP / skills generation options.

**repopack**: Similar "pack repo, token counts, git-aware" approach.

**gitingest**: Generates consolidated text prompts from repos/paths. Supports
tokens/private repos, stdout piping.

### Forkable Registries

See the detailed analysis in "The Forkable Registry Model" section above. Key systems:

- **shadcn/ui**: Code ownership + JSON registry + namespaced custom registries. No
  auto-update (manual diff). The "copy-paste component" movement it inspired (Aceternity
  UI, Magic UI, Tremor, Origin UI) validates the pattern's appeal.
- **copier**: Three-way merge for template updates. The gold standard for tracking
  baseline + user changes + upstream changes.
- **Homebrew Taps**: Git-based extension registries. Decentralized through naming
  convention. `brew update` rebases local changes.
- **MCP Registry**: Federated metaregistry with OpenAPI spec. Separates metadata from
  content. Sub-registries enable organizational customization.
- **Nix Flakes**: Content-addressed package registry with deterministic resolution.
  Lock files track exact versions. Very powerful but high complexity.
- **Cruft/Retrocookie**: Tools that bolt update capability onto Cookiecutter. Cruft
  tracks baseline via `.cruft.json`; Retrocookie pushes changes *back upstream* using
  git-filter-repo.

**Industry trend (2025-2026)**: Clear movement from "install a dependency you cannot
modify" toward "pull source code you own, from a registry you can extend." The
"copy-paste" distribution model is gaining traction across UI components, documentation,
templates, and agent skills.

### GitHub Ecosystem: Context Engineering and Agent Knowledge (2025-2026)

The space has exploded. Key projects by category:

**Context engineering frameworks** (most stars):
- [agents.md](https://github.com/agentsmd/agents.md) (17K stars) — Standard format
  for agent-consumable project documentation. The emerging equivalent of llms.txt for
  code projects.
- [GSD / get-shit-done](https://github.com/gsd-build/get-shit-done) (14K stars) —
  Spec-driven development system using CONTEXT.md progressive capture and fresh-context
  sub-agents. Solves "context rot" by running each plan in a clean 200K window.
- [context-engineering-intro](https://github.com/coleam00/context-engineering-intro)
  (12K stars) — "Context engineering is the new vibe coding."
- [Awesome-Context-Engineering](https://github.com/Meirtz/Awesome-Context-Engineering)
  (2.9K stars) — Survey of papers, frameworks, and implementation guides.

**Agent instruction formats**:
- [microsoft/skills](https://github.com/microsoft/skills) (1.3K stars) — Official
  Microsoft collection of skills for Codex and coding agents.
- [claude-reflect](https://github.com/BayramAnnakov/claude-reflect) (684 stars) —
  Self-learning system that captures corrections and syncs to CLAUDE.md. A feedback
  loop for progressive knowledge refinement.
- [mdflow](https://github.com/johnlindquist/mdflow) (559 stars) — Multi-backend CLI
  for executable markdown prompts.
- [fenic](https://github.com/typedef-ai/fenic) (439 stars) — "Declarative context
  engineering for agents" — define what context should be available declaratively.

**Context-aware tools**:
- [kit](https://github.com/cased/kit) (1.2K stars) — Codebase mapping and symbol
  extraction for building the context layer for coding agents.
- [mcpdoc](https://github.com/langchain-ai/mcpdoc) (929 stars) — Bridge between
  llms.txt and MCP for IDE-based agents.

**Industry case study**: Spotify built a background coding agent (Honk) that merges
650+ PRs/month. Key lesson: *context engineering became more important than model
selection*. Overly broad file inclusion overwhelms the window. They built custom
verification tools that activate depending on component contents (context routing).

### Agent-Oriented Knowledge Systems

#### RAPTOR — Recursive Hierarchical Retrieval
[RAPTOR](https://github.com/parthsarthi03/raptor) (1.5K stars) builds a tree of
summaries bottom-up: chunks → clusters → summaries → meta-summaries. Retrieves at
different abstraction levels. 20% absolute accuracy improvement on the QuALITY
benchmark. **This is the academic validation of the pyramid pattern** — the same
structure we propose in the knowledge map (keywords → summary → outline → full doc).

#### RAG (Retrieval-Augmented Generation)
The dominant paradigm for knowledge injection. Typically uses embedding databases
(Pinecone, Chroma, etc.). Heavy infrastructure. For our use case, pre-computed knowledge
maps may achieve similar quality without the infrastructure, because:
- Our corpus is curated (hundreds, not millions of docs)
- Documents have natural structure (markdown with headings)
- LLMs can generate high-quality summaries and keyword indices
- Exact retrieval is more common than fuzzy discovery

#### MCP (Model Context Protocol)
Anthropic's protocol for tool integration. MCP "resources" provide a way to serve
documents to agents. Relevant as a potential alternative interface, but adds server
infrastructure. CLI-based approach is simpler for the static knowledge use case.

### Knowledge Organization Systems

#### DITA (Darwin Information Typing Architecture)
XML-based technical documentation standard. Key concept: **topic-based authoring** where
content is organized into small, self-contained topics that can be assembled into
different documents. Maps well to our "small markdown files with metadata" approach.

#### Zettelkasten / Digital Gardens
Note-taking methodology based on atomic, linked notes. Key principle: **small,
self-contained units** connected by links and tags. The knowledge map is essentially a
Zettelkasten index computed over markdown files.

---

## Design Options

### Option A: Extension of tbd's Existing Doc System

**Description**: Evolve tbd's current `source add` / `guidelines` / `shortcut` commands
to support all five modalities. Add knowledge map generation, search, and progressive
disclosure directly to tbd.

**Pros:**
- No new tool to install or maintain
- Leverages existing tbd infrastructure (config, sync, setup)
- Users already familiar with `tbd guidelines` pattern

**Cons:**
- Makes tbd responsible for too many things (issue tracking + knowledge management)
- Harder for non-tbd users to adopt the knowledge system
- Monolithic — violates Unix philosophy of small, composable tools
- Knowledge management changes coupled to tbd release cycle

### Option B: Standalone CLI + Library (Recommended)

**Description**: A separate npm package (e.g., `@jlevy/kdex` or similar) that provides
both a CLI and a library. tbd imports it as a dependency and wraps specific commands.
Other tools can use it independently.

**Pros:**
- Clean separation of concerns
- Usable by any agent platform, not just tbd users
- Can iterate independently on knowledge management
- Library mode enables programmatic integration
- Follows Unix philosophy — small tool that does one thing well
- Could be used in CLAUDE.md, Cursor rules, or any agent context

**Cons:**
- Another package to maintain
- Coordination between tbd and kdex for releases
- Users install two tools instead of one

### Option C: Pure Convention + Scripts (Minimal Viable)

**Description**: Define conventions for knowledge repos (directory structure, front matter
format, map file format) and provide a small set of shell scripts or a single-file CLI
that implements the core operations. No npm package, just conventions.

**Pros:**
- Maximally simple — anyone can participate
- No dependency management
- Works with any language ecosystem
- Easy to understand and extend

**Cons:**
- Less polished user experience
- No library integration
- Harder to maintain cross-platform compatibility
- Limited ability to do sophisticated indexing

### Option D: MCP Server

**Description**: Implement the knowledge system as an MCP server that agents connect to
via the Model Context Protocol. Knowledge retrieval becomes tool calls.

**Pros:**
- Native agent integration (MCP is the standard)
- Supports streaming and stateful sessions
- Future-proof for multi-agent scenarios

**Cons:**
- Requires running a server process
- More complex setup than CLI
- Not all agent platforms support MCP equally
- Overkill for static document serving

### Recommendation: Option B (Standalone CLI + Library)

Option B provides the best balance of power, simplicity, and composability. The tool
should be:
- A small TypeScript CLI (following the patterns in the CLI as Agent Skill research)
- Published as an npm package with both CLI and library exports
- Integrated into tbd as a dependency
- Operable independently for non-tbd users
- Designed with the same progressive disclosure architecture as tbd

---

## Proposed Document Conventions

### Repository Structure for Knowledge Sources

```
knowledge-repo/
├── knowledge.yml          # Registry manifest (optional but recommended)
├── .knowledge/
│   └── map.yml            # Pre-computed knowledge map (generated)
├── guidelines/
│   ├── typescript-rules.md
│   ├── python-rules.md
│   └── general-tdd-guidelines.md
├── shortcuts/
│   ├── code-review-and-commit.md
│   └── new-plan-spec.md
├── templates/
│   ├── plan-spec.md
│   └── research-brief.md
└── references/
    ├── convex-limits.md
    └── api-patterns.md
```

### Document Front Matter Convention

```yaml
---
title: TypeScript Rules              # Human-readable title
description: Best practices for TS   # One-line description
category: language-rules             # Primary category
tags: [typescript, coding-rules]     # Additional tags
triggers:                            # When agents should consult this
  - "writing typescript"
  - "ts project setup"
  - "type safety"
author: org-name                     # Optional
version: "1.0"                       # Optional
---
```

The front matter is optional — `kdex build` can infer everything from content if needed.
But front matter makes the map more accurate and faster to build.

### The Knowledge Map Format

The `.knowledge/map.yml` file is the compiled index:

```yaml
# Generated by kdex build — do not edit manually
version: 1
built: 2026-02-15T10:00:00Z
builder: kdex/0.1.0

documents:
  - id: typescript-rules
    path: guidelines/typescript-rules.md
    title: "TypeScript Rules and Best Practices"
    description: "Comprehensive coding rules for TypeScript projects"
    when: "Writing, reviewing, or refactoring TypeScript code"
    keywords: [typescript, strict mode, type narrowing, discriminated unions]
    category: language-rules
    tags: [typescript, coding-rules]
    summary: >
      TypeScript coding rules covering strict configuration, type patterns
      (discriminated unions, branded types, narrowing), error handling with
      Result types, naming conventions, and import organization.
    outline:
      - "Strict Configuration: tsconfig requirements"
      - "Type Patterns: unions, branding, narrowing"
      - "Error Handling: Result types, boundaries"
      - "Naming: types, interfaces, enums"
      - "Imports: organization, barrel files"
    tokens: 3200
    hash: sha256:abc123...

# Aggregate metadata for persistent awareness
categories:
  language-rules:
    description: "Language-specific coding rules and best practices"
    documents: [typescript-rules, python-rules]
  testing:
    description: "Testing methodologies and patterns"
    documents: [general-tdd-guidelines, golden-testing-guidelines]
  workflow:
    description: "Development workflow shortcuts and processes"
    documents: [code-review-and-commit, new-plan-spec]
```

---

## Key Insight: The Knowledge Map is the "Unreasonably Effective" Primitive

The knowledge map is the single artifact that enables everything:

1. **Persistent awareness**: Generate a compact directory from the map's descriptions
   and triggers → inject into SKILL.md or CLAUDE.md
2. **Exact retrieval**: Map `id` → file path → read file
3. **Semantic search**: Search over `keywords`, `description`, `summary` fields using
   ripgrep, fzf, or simple substring matching
4. **Progressive disclosure**: Map stores `summary` → `outline` → full file path at
   increasing detail levels
5. **Tool documentation**: Map structure is self-describing

The map is a **static JSON/YAML file**. No database. No server. No embeddings (unless
you want them). It's just a file that makes markdown documents navigable by LLMs.

This is why the approach is "oddly unreasonably effective but kind of oddly simple" — it
leverages the fact that LLMs are excellent at:
- Generating keyword indices from content
- Writing concise summaries
- Classifying documents into categories
- Deciding when a document is relevant to a query

We pre-compute all of this once, then serve it as static data.

---

## Pyramid Summaries as a Universal Primitive

### The Generalization

The summary ladder (card → S → M → L → full) described above for knowledge docs is
actually a much more general primitive. The same structure applies to **anything that has
text content**:

- A single knowledge document → pyramid summary at any depth
- A set of knowledge documents → pyramid summary of the collection
- An arbitrary file (source code, config, logs) → pyramid summary
- A directory of files → pyramid summary
- A user's current working context (open files, recent edits) → pyramid summary
- A conversation or prompt → pyramid summary

The insight: **a pyramid summary is a content-addressed, depth-parameterized
representation of any textual content**. If the system can produce and consume these
uniformly, then "context" becomes a first-class, composable, referenceable object — not
an opaque string you paste into a prompt.

### Reference Syntax for Depth-Parameterized Content

If pyramid summaries are the universal primitive, we need a compact syntax for referencing
content at a specific depth. The syntax should be:

1. **Short enough for CLI use** — agents type these in tool calls
2. **Uniform across content types** — same syntax for knowledge docs, files, directories
3. **Depth is optional** — sensible default (usually "card" or "full" depending on context)

A natural syntax combines a content reference with a depth specifier:

```
# Knowledge docs (by ID)
kdex:typescript-rules              # card-level summary (default for routing)
kdex:typescript-rules:S            # short summary (1 paragraph)
kdex:typescript-rules:M            # medium summary (key sections)
kdex:typescript-rules:L            # long summary (detailed)
kdex:typescript-rules:full         # full document
kdex:typescript-rules:outline      # structural outline

# Arbitrary files (by path)
@src/auth/login.ts               # reference to a file (full by default)
@src/auth/login.ts:S             # short summary of the file
@src/auth/login.ts:outline       # structural outline (functions, classes)
@src/auth/login.ts:card          # one-line description of what this file does

# Directories / globs
@src/auth/:S                     # summary of the auth directory
@src/auth/**/*.ts:card           # card-level summary of each TS file
@src/auth/:outline               # structural outline of the directory

# Knowledge categories
kdex:category:language-rules:S     # summary of all language rule docs
kdex:category:testing:card         # card-level list of all testing docs
```

### How This Works in Practice

**Routing with file references instead of inline context:**

```bash
# WRONG: puts content into context during the CLI call
kdex route "I'm working on auth and need to handle token refresh errors"

# RIGHT: reference files, let the router read them at appropriate depth
kdex route --files=src/auth/token.ts,src/auth/refresh.ts
kdex route --files=src/auth/ --query="error handling"

# ALSO RIGHT: combine file references with a short query
kdex route --files=src/auth/token.ts --query="retry patterns"
```

The router reads the referenced files at card/S depth internally, matches against doc
card signals, and returns relevant knowledge doc references. The agent never had to put
file contents into the CLI call.

**Composing context from references:**

```bash
# Build a context block from references at specified depths
kdex inject --refs=kdex:typescript-rules:S,@src/auth/:outline --budget=1500

# The inject command:
# 1. Resolves each reference at the specified depth
# 2. Assembles them into a coherent context block
# 3. Stays within the token budget (truncating lower-priority refs if needed)
# 4. Outputs a ready-to-use text block
```

**Progressive exploration via depth escalation:**

```bash
# Agent starts broad
kdex get typescript-rules:card    →  "TS coding rules: strict config, types, errors" (15 tokens)

# Decides it's relevant, goes deeper
kdex get typescript-rules:S       →  One paragraph overview (80 tokens)

# Needs the error handling section specifically
kdex get typescript-rules:outline →  Section list with anchors
kdex get typescript-rules#error-handling  →  Just that section (400 tokens)

# Or goes to full
kdex get typescript-rules:full    →  Complete document (3200 tokens)
```

### The Pyramid Summary as a Build Artifact

For knowledge docs in the corpus, pyramid summaries are **pre-computed at build time**:

```yaml
# In map.yml, each doc has pre-computed summaries at every level
- id: typescript-rules
  path: guidelines/typescript-rules.md
  card: "TypeScript coding rules: strict config, type patterns, error handling"
  summary_S: |
    Comprehensive TypeScript rules covering strict tsconfig, type patterns
    (discriminated unions, branded types), Result-type error handling, naming
    conventions, and import organization.
  summary_M: |
    [~200 token summary with key points from each section]
  outline:
    - "1. Strict Configuration: tsconfig requirements"
    - "2. Type Patterns: unions, branding, narrowing"
    - "3. Error Handling: Result types, boundaries"
    - "4. Naming: types, interfaces, enums"
    - "5. Imports: organization, barrel files"
  tokens: 3200
```

For arbitrary files (source code, etc.), pyramid summaries are **generated on demand**
and optionally cached:

```bash
kdex summarize @src/auth/login.ts --level=S
# → Generates a short summary of the file (via LLM or heuristic extraction)
# → Caches the result for subsequent requests
```

### Why This Matters: Context as Composable References

This framing transforms "context engineering" from "figure out what text to paste" into
"compose references at appropriate depths." The agent's workflow becomes:

1. **Always have the map** — card-level references for all knowledge docs (~500 tokens)
2. **Route by reference** — give the router file paths, not content
3. **Escalate by depth** — go from card → S → M → full as needed
4. **Compose by reference** — `kdex inject` assembles context blocks from depth-annotated
   references within a token budget

The key property: **at no point does the agent need to put large content blocks into CLI
arguments**. Everything is referenced by path/ID, and depth is a parameter. The system
handles all content resolution internally.

This is also the bridge between the knowledge system and the broader "repo context"
problem (Aider repo map, llm-context.py, repomix). All of these tools are essentially
generating pyramid summaries of code — our system generalizes the primitive and makes it
uniformly addressable.

---

## Practical Architecture: A Surprisingly Simple Direction

Given all the research above, here is the simplest concrete architecture that still
achieves the broader goal. It follows a principle of deferring complexity: start with the
cheapest possible primitives, and only layer in sophistication when simpler approaches
prove insufficient.

### The Doc Card as Primary Compiled Artifact

The **doc card** is the atomic unit of the compiled knowledge system. Each doc card
answers three questions an agent needs: *What is this? When should I read it? How do I
get it?*

A doc card is small enough to always be in context (50-100 tokens), yet informative
enough for an agent to self-route without any search infrastructure:

```yaml
- id: typescript-rules
  description: "TypeScript coding rules: strict config, type patterns, error handling"
  when: "Writing, reviewing, or refactoring TypeScript code"
  signals: [typescript, ts, .tsx, type safety, discriminated union]
  read: "kdex get typescript-rules"
  tokens: 3200
```

The **knowledge map** (`MAP.md` or `.knowledge/map.yml`) is simply the collection of all
doc cards, small enough to include in `tbd prime`, CLAUDE.md, or an `AGENTS.md`
`available_docs` block. This file is the "always-on directory" that replaces expensive
runtime discovery.

### Step 1: Make Doc Cards + Map the Primary Artifact

Add a build step that generates the map from source docs:

```
kdex build →
  For each doc:
    1. Extract/generate: name, description, when-to-use, signal keywords
    2. Generate heading outline
    3. Optionally: generate summary ladder (S/M/L)
  Emit: MAP.md (human-readable) + map.yml (machine-readable)
```

The map is tiny enough to always be present in agent context. This alone converts O(n)
document discovery into O(1) lookup.

### Step 2: Router Returns Cards First, Full Docs Only on Demand

The routing function is dead simple — not a giant schema, just a tool. Critically,
context is passed as **file references**, not inline content (see "Conserve Context by
Reference" principle and "Pyramid Summaries as Universal Primitive"):

```
kdex route --files=src/auth/token.ts,src/auth/refresh.ts →
  1. Reads referenced files at card/S depth internally
  2. Matches file signals against doc card signals
  3. Output: ranked doc cards + "read this section first" suggestions + summary level
```

Start with lexical + heuristic scoring (surprisingly effective when doc cards include
rich "signals" fields). The flow:

1. `kdex route --files=...` returns ranked doc cards (references, not content)
2. Agent chooses to read or summarize based on the cards
3. Agent requests `kdex get <id>:S` or `kdex get <id>:full`

This gives agents a directory-hierarchy feel (if cards are grouped by category), a
search-engine feel (if router ranks by relevance), and progressive disclosure (cards →
summaries → full) — all from the same primitive.

### Step 3: Treat External Doc Repos as Sources for the Compiler

The existing `docs_cache.sources` design in the external docs spec is already the right
primitive. Sources (git repos with prefix-based namespacing, path filtering, precedence
ordering) feed into the compiler. The compiler doesn't care whether sources are local
directories, remote repos, or a mix — it just walks markdown files and builds the map.

This means the "external docs" problem and the "knowledge map" problem are the same
problem: ingest sources → compile map → serve via CLI.

### Step 4: Only Then Add Hybrid Search / Embeddings

The embedding/vector search layer can be deferred until the "map + route + summarize"
loop is working and validated. For a curated corpus of hundreds of documents, card-based
routing with lexical matching handles the vast majority of queries.

When you do want to add hybrid search, QMD and ck (BeaconBay) are extremely aligned
with this architecture — they provide BM25 + vector search + re-ranking that can augment
the card-based router for large or unfamiliar corpora.

### Why This Works

This architecture is effective because it leverages several compounding insights:

1. **LLMs are excellent compilers** — they generate better keyword indices, summaries,
   and relevance descriptors than any heuristic, and this can be done once at build time
2. **Small corpora don't need embeddings** — for hundreds of curated docs, metadata
   search over doc cards handles 95%+ of queries
3. **Agents are good at self-routing** — given a compact inventory of doc cards, agents
   reliably choose the right document without sophisticated retrieval infrastructure
4. **The same primitive serves all modalities** — doc cards power persistent awareness
   (always in context), exact retrieval (card → id → file), search (match over card
   fields), and progressive disclosure (card → summary → outline → full)

---

## Progressive Disclosure in Practice

### Example Flow: Agent Needs TypeScript Guidance

**Step 1: Persistent awareness** (always in context, ~200 tokens)

```
Available knowledge via `kdex`:
- typescript-rules: TypeScript coding best practices
  (Use when writing/reviewing TypeScript)
- python-rules: Python coding best practices
  (Use when writing/reviewing Python)
- general-tdd-guidelines: Test-driven development methodology
  (Use when writing tests or doing TDD)
[... 20 more one-liners ...]
```

**Step 2: Agent recognizes need** → runs `kdex get typescript-rules --summary`

```
TypeScript Rules: Comprehensive coding rules covering strict configuration,
type patterns (discriminated unions, branded types, narrowing), error handling
with Result types, naming conventions, and import organization. 3200 tokens.
```

**Step 3: Agent wants details** → runs `kdex get typescript-rules --outline`

```
1. Strict Configuration: tsconfig requirements
2. Type Patterns: unions, branding, narrowing
3. Error Handling: Result types, boundaries
4. Naming: types, interfaces, enums
5. Imports: organization, barrel files
```

**Step 4: Agent needs full content** → runs `kdex get typescript-rules`

```
[Full 3200-token document]
```

**Step 5: Agent needs related knowledge** → runs `kdex search "error handling patterns"`

```
Results:
1. typescript-rules (section: Error Handling) — 95% relevant
2. error-handling-rules — 90% relevant
3. python-rules (section: Exception Handling) — 60% relevant
```

### Token Budget Comparison

| Approach | Tokens Used |
| --- | --- |
| Load all docs upfront | ~50,000+ |
| Load map + one doc on demand | ~500 + 3,200 = 3,700 |
| With progressive disclosure | ~500 + 50 + 100 + 3,200 = 3,850 |
| Traditional (read all file names, then guess) | ~200 + 3,200+ (often wrong doc) |

The progressive approach uses ~13x fewer tokens than loading everything, with equal or
better accuracy.

### External Validation: Claude-Mem Metrics

Independent research on progressive disclosure for agent knowledge systems (Claude-Mem,
Gemini CLI) shows even more dramatic results:

| Approach | Tokens Consumed | Efficiency |
| --- | --- | --- |
| Load everything at session start | ~25,000 tokens | 0.8% |
| Progressive disclosure (3-layer) | ~955 tokens | ~100% |

This represents a **~26x improvement** in token efficiency. The 3-layer pattern
(index → context → details) is converging as a standard across agent platforms.

---

## Implementation Considerations

### Search Architecture: The SQLite Stack

Research reveals a surprisingly powerful single-file architecture for search:

**SQLite FTS5 + sqlite-vec** in a single `.db` file provides:
- **BM25 keyword search** via FTS5 (built into SQLite, no extensions needed)
- **Vector semantic search** via sqlite-vec (SIMD-accelerated KNN)
- **Metadata queries** via standard SQL
- **Portability**: One file, works everywhere SQLite works
- **No server**: Unlike Meilisearch, Typesense, or ChromaDB

This is the approach validated by QMD (Tobi Lutke's hybrid search tool) and Simon
Willison's llm/Datasette ecosystem. For a curated corpus of hundreds of documents, this
eliminates the need for separate vector databases entirely.

**Build-time flow**:
1. Parse markdown files, extract front matter metadata
2. Build SQLite database with FTS5 index on content
3. Generate embeddings, store via sqlite-vec in same database
4. Generate compact knowledge map (YAML) with titles, tags, summaries

**Runtime flow**:
1. Agent loads knowledge map (~800 tokens) from YAML
2. Agent reasons about which docs are relevant from metadata
3. For explicit search: BM25 or vector search via SQLite
4. Full documents loaded only when specifically needed

However, for v1, the SQLite/embedding layer may be unnecessary. Simple ripgrep over the
knowledge map YAML handles most queries. The SQLite stack becomes valuable as the corpus
grows beyond hundreds of documents.

### Map Generation Strategy

Two approaches for building the knowledge map:

**1. Front-Matter-First (low-cost, deterministic)**

If documents have good front matter, extract metadata directly:
```typescript
for (const file of markdownFiles) {
  const { frontMatter, content } = parseMarkdown(file);
  map.add({
    id: path.basename(file, '.md'),
    title: frontMatter.title,
    description: frontMatter.description,
    keywords: frontMatter.tags,
    // Generate summary from first paragraph or heading structure
    summary: extractSummary(content),
    outline: extractHeadings(content),
  });
}
```

**2. LLM-Augmented (rich, semantic)**

Use an LLM to analyze each document and generate rich metadata:
```typescript
for (const file of markdownFiles) {
  const content = await readFile(file);
  const analysis = await llm.analyze(content, {
    prompt: "For this document, generate: title, description, keywords, " +
            "trigger phrases, one-paragraph summary, and heading outline."
  });
  map.add({ ...analysis, path: file });
}
```

**Recommendation**: Start with approach 1 (pure extraction), add LLM augmentation as an
optional `kdex build --enrich` step for source repos that want richer metadata.

### Search Implementation: Tiered Approach

**Tier 1 — Metadata search (v1, no dependencies)**:
1. Keyword search over map.yml fields (triggers, keywords, description)
2. Fuzzy matching over document names and descriptions
3. ripgrep over the actual markdown files for content-level queries
4. This covers 95%+ of agent knowledge queries for small corpora (<500 docs)

**Tier 2 — Indexed search (v2, SQLite)**:
1. SQLite FTS5 for ranked keyword search with BM25 scoring
2. sqlite-vec for semantic similarity queries
3. Single portable `.db` file alongside the YAML map
4. Needed when corpus grows or semantic understanding matters

**Tier 3 — Hybrid search (v3, QMD-style)**:
1. BM25 + vector search + LLM re-ranking pipeline
2. Query expansion (LLM generates alternative phrasings)
3. Reciprocal rank fusion across retrieval methods
4. For large, diverse corpora with complex queries

Start with Tier 1. Graduate to Tier 2 when simple search proves insufficient. Tier 3
is aspirational — QMD shows it works but it's heavyweight.

### Caching and Sync

Knowledge sources are git repos. Caching follows the same pattern as tbd's RepoCache:

```
~/.kdex/cache/
  github.com-jlevy-speculate/       # Sparse git checkout
    guidelines/
    shortcuts/
    .knowledge/map.yml
  github.com-org-knowledge-base/
    guidelines/
    .knowledge/map.yml
```

**Sync behavior**: `kdex source update` does `git pull` on cached repos, then checks if
the map needs rebuilding (by comparing file hashes).

---

## Alignment with Human Incentives and Workflow Friction

### Adding Knowledge (Low Friction)

Within a repo, adding knowledge should be as simple as:
1. Write a markdown file in the appropriate directory
2. Optionally add front matter for richer metadata
3. Run `kdex build` to update the map (or have CI do it)
4. Commit and push

The system should not require special tools, formats, or processes beyond writing
markdown. Front matter is encouraged but not required.

### Editing Knowledge (Low Friction)

Documents are plain markdown files in git repos. Edit with any tool, review via
standard PR process, version via git history. No special editing workflow.

### Consuming Knowledge (Zero Friction for Agents)

Agents interact with `kdex` commands. The persistent awareness block tells them what's
available. The CLI handles all retrieval. No configuration beyond `kdex source add`.

### Contributing Back (the Shadcn Challenge)

The hardest workflow: using knowledge locally, improving it, and pushing improvements
upstream. The fork/merge model enables this:

1. `kdex fork org:typescript-rules` → creates local copy
2. Edit the local copy
3. `kdex diff org:typescript-rules` → see what changed vs upstream
4. Create PR on upstream repo with the changes

This requires tracking provenance (where did this file come from, which version) but
doesn't require complex merge infrastructure — it's just git operations on known files.

---

## Name: `kdex`

The tool is called **`kdex`** — short for "knowledge index." The name is:

- **Unique** — not taken on npm, no collisions with common Unix tools
- **Short enough for CLI use** — 4 chars, easy to type
- **Works as a universal prefix** — `kdex` serves as the consistent namespace everywhere
  it appears: CLI command (`kdex build`), reference syntax (`kdex:typescript-rules:S`),
  config directory (`~/.kdex/`), package name (`@jlevy/kdex`), cache paths, source
  prefixes, and any other context where a unique identifier is needed
- **Suggestive of purpose** — "k" for knowledge, "dex" evokes index/directory

---

## Open Questions

1. **Map format**: YAML vs JSON vs TOML for the knowledge map? YAML is more readable,
   JSON is more portable, TOML is simpler. Need to decide.

2. **LLM dependency for build**: Should `kdex build` require an LLM API for enrichment,
   or should pure extraction be the default? Likely: pure extraction as default,
   LLM enrichment as opt-in.

3. **Versioning strategy**: How to handle breaking changes in knowledge documents? Pin
   to git refs (like tbd source already does) or always track HEAD?

4. **Multi-agent coordination**: If multiple agents share a knowledge base, how do
   concurrent `kdex fork` / `kdex merge` operations interact?

5. **Integration depth with tbd**: Should tbd shell out to `kdex` or import it as a
   library? Library import is cleaner but creates a dependency. Shell-out is more
   Unix-style but adds process overhead.

6. **Scope of the first version**: What's the minimal viable `kdex` that validates the
   architecture? Probably: `kdex source add`, `kdex build`, `kdex get`, `kdex search`,
   `kdex list`.

7. **How to handle very large documents**: Some references might be 10K+ tokens. Should
   `kdex get` support section-level retrieval (e.g., `kdex get typescript-rules#error-handling`)?

8. **Relationship to MCP resources**: Could `kdex` also serve as an MCP resource provider?
   This would give agents two access paths (CLI and MCP).

9. **Flat doc types vs arbitrary hierarchies**: The current tbd spec assumes syncing
   fixed top-level directories (`shortcuts/`, `guidelines/`, `templates/`, `references/`)
   and prefers them flat. But the broader knowledge problem involves ingesting arbitrary
   repo docs (README.md, `docs/**/*.md`, ADRs, RFCs, runbooks) with nested taxonomies.
   Should the existing typed directories remain as a curated "pack format" while also
   allowing `paths` to be globs or nested subdirectories? This tension between "structured
   knowledge packs" and "arbitrary doc corpora" needs a clear resolution.

10. **Router sophistication curve**: When does simple keyword/heuristic routing over doc
    card signals become insufficient, requiring BM25 or embedding-based search? Need
    empirical data on failure modes — likely when the corpus exceeds a few hundred docs
    or when queries are semantically distant from signal keywords.

---

## Next Steps

### Recommended Experiments (High Learning, Low Commitment)

These experiments validate the architecture before committing to full implementation:

1. **Create one "knowledge pack" repo as a reference implementation**
   - Include both: `guidelines/`, `shortcuts/`, `templates/` and a `docs/` tree
   - Hand-curate a small `MAP.md` at the top as the always-on directory
   - Test whether agents can self-route from the map alone (no search infra)

2. **Auto-generate doc cards for that pack**
   - Build a simple script that extracts front matter + first paragraph + headings
   - Measure: how well does a compact card inventory let an agent self-route without
     semantic search? (Hypothesis: >90% accuracy for curated corpora <200 docs)

3. **Test summary ladders for 5-10 large docs**
   - Generate card → S → M → L summaries for substantial documents
   - Test progressive disclosure: agent reads card, decides whether to go deeper
   - Measure token savings vs accuracy compared to always loading full docs

4. **Build a trivial router first**
   - Regex/keyword scoring over doc card `signals` fields
   - No embeddings, no BM25, just string matching on card metadata
   - Validate: does this handle 95%+ of real agent queries for a curated corpus?
   - Only graduate to BM25/embeddings when the trivial router demonstrably fails

5. **Pick the forkability story now** (design decision, not code)
   - Fork-the-repo should be first-class from day one
   - Vendor/copy-in can be added later if per-doc customization proves needed
   - This decision affects config schema design, so decide early

### Implementation Milestones

- [ ] Prototype `kdex build` for pure-extraction map generation (experiment 2)
- [ ] Prototype `kdex get` with summary/outline/full depth levels (experiment 3)
- [ ] Prototype `kdex route` with trivial keyword-based scoring (experiment 4)
- [ ] Prototype `kdex search` with ripgrep-based keyword search
- [ ] Design the persistent awareness block format for SKILL.md integration
- [ ] Decide on tool name and npm package scope
- [ ] Plan the integration boundary between kdex and tbd
- [ ] Write a spec for the first implementation phase

---

## References

### Existing Project Research
- [CLI as Agent Skill Research](./research-cli-as-agent-skill.md) — Patterns for
  building CLIs that function as agent skills, including progressive disclosure
  architecture
- [Skills vs Meta-Skill Architecture](./research-skills-vs-meta-skill-architecture.md)
  — Analysis of individual skills vs CLI resource library approaches
- [Unix Philosophy for Agents](./research-unix-philosophy-for-agents.md) — Fundamental
  primitives for composable agent systems
- [External Docs Repos Spec](../../specs/active/plan-2026-02-02-external-docs-repos.md)
  — Current implementation of multi-source doc architecture in tbd

### Forkable Registries
- [shadcn/ui](https://github.com/shadcn-ui/ui) — Forkable component registry pattern
- [copier](https://github.com/copier-org/copier) — Template forking with three-way merge
- [Cruft](https://cruft.github.io/cruft/) — Update tracking for Cookiecutter templates
- [Retrocookie](https://github.com/cjolowicz/retrocookie) — Push changes back upstream
- [MCP Registry](https://github.com/modelcontextprotocol/registry) — Federated
  metaregistry with OpenAPI spec

### Search and Retrieval Tools
- [ripgrep](https://github.com/BurntSushi/ripgrep) — Fast text search (foundation tier)
- [fzf](https://github.com/junegunn/fzf) — Fuzzy finder
- [QMD](https://github.com/tobi/qmd) — Hybrid BM25 + vector + LLM re-ranking search
- [ck](https://github.com/BeaconBay/ck) — Semantic grep: hybrid semantic + regex + BM25
  with MCP server integration
- [SemTools](https://github.com/run-llama/semtools) — Rust CLI semantic search for agents
- [sqlite-vec](https://github.com/asg017/sqlite-vec) — SQLite extension for vector search
- [Simon Willison's llm](https://github.com/simonw/llm) — CLI for LLM operations with
  embedding support
- [Datasette](https://github.com/simonw/datasette) — SQLite data exploration platform
- [RAGex](https://github.com/jbenshetler/mcp-ragex) — MCP server with hybrid search
  routing
- [mgrep](https://github.com/mixedbread-ai/mgrep) — Semantic grep for code and docs
- [mcp-local-rag](https://github.com/shinpr/mcp-local-rag) — Lightweight local doc
  search (PDF/DOCX/TXT/Markdown)

### Repo Map and Context Selection Tools
- [llm-context.py](https://github.com/cyberchitta/llm-context.py) — Rule-based context
  selection + outlines + MCP; composable YAML+Markdown rules for filtering/excerpting
- [Aider repo map](https://aider.chat/docs/repomap.html) — Canonical example of "compact
  map in context, expand on demand" for code repositories
- [repomix](https://github.com/yamadashy/repomix) — Pack repo into AI-friendly single
  file, token counting, MCP/skills generation
- [repopack](https://github.com/kirill-markin/repopack) — Pack repo with token counts,
  git-aware
- [gitingest](https://github.com/cyclotruc/gitingest) — Consolidated text prompts from
  repos/paths, stdout piping

### Knowledge Standards and Formats
- [llms.txt](https://llmstxt.org/) — Standard for LLM-readable site index
- [library-mcp](https://github.com/lethain/library-mcp) — MCP server over markdown
  with datapacks
- [Agent Skills Standard](https://agentskills.io) — Open standard for agent skills
- [skills.sh](https://skills.sh) — Vercel's agent skill ecosystem
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io) — Anthropic's tool
  integration protocol

### Skills Ecosystem
- [anthropics/skills](https://github.com/anthropics/skills) — Reference implementation:
  folder with SKILL.md + YAML frontmatter
- [vercel-labs/skills](https://github.com/vercel-labs/skills) — CLI-driven install/sync
  of skills to multiple agents
- [OpenSkills](https://github.com/nicholasq/openskills) — Universal loader for Claude
  skills format with AGENTS.md integration
- [VS Code Agent Skills](https://code.visualstudio.com/docs/copilot/agent-skills) —
  Open standard across multiple agents (Copilot in VS Code, CLI, etc.)

### Context Engineering Ecosystem (GitHub)
- [agents.md](https://github.com/agentsmd/agents.md) — Standard agent-consumable
  project documentation (17K stars)
- [GSD](https://github.com/gsd-build/get-shit-done) — Spec-driven development with
  CONTEXT.md and fresh-context sub-agents (14K stars)
- [RAPTOR](https://github.com/parthsarthi03/raptor) — Recursive hierarchical retrieval
  tree (1.5K stars)
- [kit](https://github.com/cased/kit) — Codebase mapping for coding agent context (1.2K
  stars)
- [mcpdoc](https://github.com/langchain-ai/mcpdoc) — llms.txt → MCP bridge (929 stars)
- [claude-reflect](https://github.com/BayramAnnakov/claude-reflect) — Self-learning
  feedback loop for agent docs (684 stars)
- [fenic](https://github.com/typedef-ai/fenic) — Declarative context engineering (439
  stars)

### Context Engineering Research
- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Martin Fowler / Birgitta Boeckeler: Context Engineering for Coding Agents](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
- [LangChain: Context Engineering for Agents](https://blog.langchain.com/context-engineering-for-agents/)
- [ACE: Agentic Context Engineering (arXiv 2510.04618)](https://arxiv.org/abs/2510.04618)
  — Delta updates over full rewrites; +10.6% benchmarks, -86.9% latency
- [Progressive Context Loading](https://williamzujkowski.github.io/posts/from-150k-to-2k-tokens-how-progressive-context-loading-revolutionizes-llm-development-workflows/)
  — 150K→2K tokens, $4.50→$0.06/session
- [Pieces: Hierarchical Summarization for Long-Term Memories](https://pieces.app/blog/hierarchical-summarization)
- [Devin Docs: Knowledge Onboarding](https://docs.devin.ai/onboard-devin/knowledge-onboarding)

### Concepts
- Progressive Disclosure — UI pattern of revealing information in layers; ~26x token
  efficiency improvement measured in Claude-Mem
- Context Engineering — Managing the full information environment around an LLM; the
  dominant paradigm as of 2025-2026
- Authoring vs Compiled Format — Separate human writing format (markdown) from
  machine-optimized consumption format (doc cards, summaries, indexes)
- Doc Card — Compact descriptor (~50-100 tokens) answering "what is this, when to use it,
  how to get it" — the atomic unit of the compiled knowledge system
- Context Conservation — Design principle: reference content by path/ID instead of
  inlining it; never put content into context when a reference suffices
- Pyramid Summary — Depth-parameterized representation of any textual content
  (card → S → M → L → full); a universal primitive applicable to docs, files,
  directories, collections, or any content
- Four Core Operations — Write, Select, Compress, Isolate (LangChain/Anthropic)
- DITA (Darwin Information Typing Architecture) — Topic-based documentation standard
- Zettelkasten — Atomic, linked note methodology
- RAG (Retrieval-Augmented Generation) — Knowledge injection via embedding retrieval
- llms.txt — Emerging standard for LLM-navigable site indices
- ACE — Agentic Context Engineering with delta updates to prevent context collapse
- Fork-the-Repo — Git-native forkability model: fork repo, change config URL, PR back
- Vendor/Copy-In — shadcn-style model: adopt individual docs locally, track upstream
  provenance for optional merge
