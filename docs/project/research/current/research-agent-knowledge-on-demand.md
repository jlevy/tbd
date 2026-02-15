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

### 3. Make These Available to Agents via Context-Efficient Tools

For efficient context engineering, agents need content in a variety of formats and
mechanisms for reading it. The most direct way: a CLI that offers all these capabilities,
with skill-style descriptions about when to use each tool.

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
**Example**: "For TypeScript patterns, run `kn get typescript-rules`."

### Modality 2: Exact Retrieval

The agent knows exactly what document it wants and pulls it up by name.

**Token budget**: Full document size (hundreds to thousands of tokens).
**Mechanism**: `kn get <name>` — direct fetch by identifier.
**Example**: Agent runs `kn get typescript-rules` and receives the full guideline.

### Modality 3: Semantic Retrieval (Search)

The agent knows what kind of knowledge it needs but not the exact document. It queries
by keywords, topic, or natural language.

**Token budget**: Variable — search results, then drill-down.
**Mechanism**: `kn search <query>` — keyword/fuzzy/semantic search over the knowledge map.
**Example**: Agent runs `kn search "handling database migrations"` and gets ranked
results with summaries.

### Modality 4: Knowledge Summarization (Progressive Disclosure)

For large documents or multiple search results, the agent needs an overview first and can
drill deeper selectively. This is the pyramid pattern:

1. **Index level**: One-line description per doc (what's available)
2. **Summary level**: Paragraph-level overview (what's in it)
3. **Section level**: Specific sections or key points
4. **Full level**: Complete document content

**Token budget**: Scales from ~50 to full document size.
**Mechanism**: `kn get <name> --depth=summary|outline|full` or similar.

### Modality 5: Tool Documentation

Documentation on how to use the knowledge tools themselves. Referenced in the persistent
awareness layer. This is meta-knowledge — the agent's understanding of how to navigate
the knowledge system.

**Mechanism**: Built into the skill description and `kn --help`.

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
called something like `kn` (knowledge), `kb` (knowledge base), or `know`.

Reasons for separation:
- **Single responsibility**: Knowledge retrieval is orthogonal to issue tracking
- **Composability**: Any tool (tbd, custom CLIs, scripts) can invoke it
- **Portability**: Works with any agent platform (Claude, Cursor, Copilot)
- **Extensibility**: Anyone can add knowledge sources without modifying tbd
- **Library + CLI**: Can be both a library (imported by tbd) and a standalone CLI

### CLI Interface Sketch

```bash
# Setup and configuration
kn init                          # Initialize in a project
kn source add <url> [--prefix=X] # Add a knowledge source (git repo)
kn source list                   # List configured sources
kn source remove <prefix>        # Remove a source

# Building the knowledge map
kn build                         # (Re)build knowledge map from sources
kn build --source=<prefix>       # Rebuild for specific source
kn status                        # Show map freshness, source status

# Retrieval (the five modalities)
kn list                          # List all available knowledge (Modality 1)
kn list --category=<cat>         # Filter by category
kn get <name>                    # Exact retrieval (Modality 2)
kn get <name> --summary          # Summary only (Modality 4)
kn get <name> --outline          # Outline level (Modality 4)
kn search <query>                # Semantic search (Modality 3)
kn search <query> --top=5        # Limit results

# Context-optimized output
kn prime                         # Output persistent awareness block
kn prime --budget=500            # With token budget constraint
kn recommend --context="..."     # Given current context, recommend relevant docs
```

### Integration with tbd

tbd would integrate with `kn` as a consumer:

```typescript
// In tbd's guidelines command
import { getDocument, searchDocuments } from 'kn';

// Or simply shell out
const result = execSync('kn get typescript-rules');
```

The `tbd guidelines` and `tbd shortcut` commands would become thin wrappers around `kn`
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

### Proposed Knowledge Registry Model

A hybrid approach that takes the best of copier's merge intelligence and shadcn's
simplicity:

#### Pull Model (shadcn-style)

```bash
# Add a knowledge source — clones/caches the repo
kn source add github.com/org/knowledge-base --prefix=org

# Knowledge is now available
kn get org:typescript-rules     # Reads from cache
kn list --source=org            # List what's available from this source
```

#### Fork Model (for customization)

```bash
# Fork a specific doc for local customization
kn fork org:typescript-rules    # Copies to local/ prefix
# Edit local/guidelines/typescript-rules.md freely

# Local version takes precedence
kn get typescript-rules         # Returns local version (shadows org version)
```

#### Upstream Sync Model

```bash
# Check for upstream changes
kn source update org            # Git pull on the cached repo
kn diff org:typescript-rules    # Compare local fork vs upstream

# Merge upstream changes into local fork
kn merge org:typescript-rules   # Interactive merge if conflicts
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
`kn build` generates one locally.

#### Minimal Viable Forkable Registry for Knowledge

Based on the registry research, the minimum implementation needs:

1. **A schema for knowledge items** — YAML front matter in markdown files
   (title, description, category, tags)
2. **A registry index** — The knowledge map (`map.yml`) listing all items with metadata.
   Hostable as a static file in the repo.
3. **A CLI that fetches and writes** — `kn source add <url>` fetches and caches
4. **A baseline record** — Track what version of each source is cached
   (git commit SHA in `.knowledge/sources.yml`)
5. **Convention for custom registries** — Namespace-prefixed sources, standard directory
   structure

**v1 (manual diff)**: Like shadcn — pull, fork, customize, but review upstream changes
manually via `kn diff`. Simple, low friction.

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

**RAGex**: MCP server combining semantic (RAG), symbolic (tree-sitter), and regex
(ripgrep) search. Automatically detects best search mode per query — powerful abstraction
for agents that shouldn't need to choose a search strategy.

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

**Description**: A separate npm package (e.g., `@jlevy/kn` or similar) that provides
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
- Coordination between tbd and kn for releases
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

The front matter is optional — `kn build` can infer everything from content if needed.
But front matter makes the map more accurate and faster to build.

### The Knowledge Map Format

The `.knowledge/map.yml` file is the compiled index:

```yaml
# Generated by kn build — do not edit manually
version: 1
built: 2026-02-15T10:00:00Z
builder: kn/0.1.0

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

## Progressive Disclosure in Practice

### Example Flow: Agent Needs TypeScript Guidance

**Step 1: Persistent awareness** (always in context, ~200 tokens)

```
Available knowledge via `kn`:
- typescript-rules: TypeScript coding best practices
  (Use when writing/reviewing TypeScript)
- python-rules: Python coding best practices
  (Use when writing/reviewing Python)
- general-tdd-guidelines: Test-driven development methodology
  (Use when writing tests or doing TDD)
[... 20 more one-liners ...]
```

**Step 2: Agent recognizes need** → runs `kn get typescript-rules --summary`

```
TypeScript Rules: Comprehensive coding rules covering strict configuration,
type patterns (discriminated unions, branded types, narrowing), error handling
with Result types, naming conventions, and import organization. 3200 tokens.
```

**Step 3: Agent wants details** → runs `kn get typescript-rules --outline`

```
1. Strict Configuration: tsconfig requirements
2. Type Patterns: unions, branding, narrowing
3. Error Handling: Result types, boundaries
4. Naming: types, interfaces, enums
5. Imports: organization, barrel files
```

**Step 4: Agent needs full content** → runs `kn get typescript-rules`

```
[Full 3200-token document]
```

**Step 5: Agent needs related knowledge** → runs `kn search "error handling patterns"`

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
optional `kn build --enrich` step for source repos that want richer metadata.

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
~/.kn/cache/
  github.com-jlevy-speculate/       # Sparse git checkout
    guidelines/
    shortcuts/
    .knowledge/map.yml
  github.com-org-knowledge-base/
    guidelines/
    .knowledge/map.yml
```

**Sync behavior**: `kn source update` does `git pull` on cached repos, then checks if
the map needs rebuilding (by comparing file hashes).

---

## Alignment with Human Incentives and Workflow Friction

### Adding Knowledge (Low Friction)

Within a repo, adding knowledge should be as simple as:
1. Write a markdown file in the appropriate directory
2. Optionally add front matter for richer metadata
3. Run `kn build` to update the map (or have CI do it)
4. Commit and push

The system should not require special tools, formats, or processes beyond writing
markdown. Front matter is encouraged but not required.

### Editing Knowledge (Low Friction)

Documents are plain markdown files in git repos. Edit with any tool, review via
standard PR process, version via git history. No special editing workflow.

### Consuming Knowledge (Zero Friction for Agents)

Agents interact with `kn` commands. The persistent awareness block tells them what's
available. The CLI handles all retrieval. No configuration beyond `kn source add`.

### Contributing Back (the Shadcn Challenge)

The hardest workflow: using knowledge locally, improving it, and pushing improvements
upstream. The fork/merge model enables this:

1. `kn fork org:typescript-rules` → creates local copy
2. Edit the local copy
3. `kn diff org:typescript-rules` → see what changed vs upstream
4. Create PR on upstream repo with the changes

This requires tracking provenance (where did this file come from, which version) but
doesn't require complex merge infrastructure — it's just git operations on known files.

---

## Potential Names and Identity

The standalone tool needs a name. Considerations:
- Short (2-3 chars is ideal for CLI usage)
- Memorable and suggestive of purpose
- Not taken on npm

Candidates:
- `kn` — "know" / "knowledge" — short, Unix-style
- `kb` — "knowledge base" — familiar abbreviation
- `know` — obvious meaning, slightly longer
- `lore` — "project lore" — evocative, memorable
- `ctx` — "context" — connects to context engineering
- `dok` — "docs + knowledge" — unique, short

---

## Open Questions

1. **Map format**: YAML vs JSON vs TOML for the knowledge map? YAML is more readable,
   JSON is more portable, TOML is simpler. Need to decide.

2. **LLM dependency for build**: Should `kn build` require an LLM API for enrichment,
   or should pure extraction be the default? Likely: pure extraction as default,
   LLM enrichment as opt-in.

3. **Versioning strategy**: How to handle breaking changes in knowledge documents? Pin
   to git refs (like tbd source already does) or always track HEAD?

4. **Multi-agent coordination**: If multiple agents share a knowledge base, how do
   concurrent `kn fork` / `kn merge` operations interact?

5. **Integration depth with tbd**: Should tbd shell out to `kn` or import it as a
   library? Library import is cleaner but creates a dependency. Shell-out is more
   Unix-style but adds process overhead.

6. **Scope of the first version**: What's the minimal viable `kn` that validates the
   architecture? Probably: `kn source add`, `kn build`, `kn get`, `kn search`,
   `kn list`.

7. **How to handle very large documents**: Some references might be 10K+ tokens. Should
   `kn get` support section-level retrieval (e.g., `kn get typescript-rules#error-handling`)?

8. **Relationship to MCP resources**: Could `kn` also serve as an MCP resource provider?
   This would give agents two access paths (CLI and MCP).

---

## Next Steps

- [ ] Validate the knowledge map format with 2-3 real document repos
- [ ] Prototype `kn build` for pure-extraction map generation
- [ ] Prototype `kn get` with summary/outline/full depth levels
- [ ] Prototype `kn search` with ripgrep-based keyword search
- [ ] Design the persistent awareness block format for SKILL.md integration
- [ ] Decide on tool name and npm package scope
- [ ] Plan the integration boundary between kn and tbd
- [ ] Evaluate whether the fork/merge workflow is worth building in v1
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
- [SemTools](https://github.com/run-llama/semtools) — Rust CLI semantic search for agents
- [sqlite-vec](https://github.com/asg017/sqlite-vec) — SQLite extension for vector search
- [Simon Willison's llm](https://github.com/simonw/llm) — CLI for LLM operations with
  embedding support
- [Datasette](https://github.com/simonw/datasette) — SQLite data exploration platform
- [RAGex](https://github.com/jbenshetler/mcp-ragex) — MCP server with hybrid search
  routing
- [mgrep](https://github.com/mixedbread-ai/mgrep) — Semantic grep for code and docs

### Knowledge Standards and Formats
- [llms.txt](https://llmstxt.org/) — Standard for LLM-readable site index
- [library-mcp](https://github.com/lethain/library-mcp) — MCP server over markdown
  with datapacks
- [Agent Skills Standard](https://agentskills.io) — Open standard for agent skills
- [skills.sh](https://skills.sh) — Vercel's agent skill ecosystem
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io) — Anthropic's tool
  integration protocol

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
- Four Core Operations — Write, Select, Compress, Isolate (LangChain/Anthropic)
- DITA (Darwin Information Typing Architecture) — Topic-based documentation standard
- Zettelkasten — Atomic, linked note methodology
- RAG (Retrieval-Augmented Generation) — Knowledge injection via embedding retrieval
- llms.txt — Emerging standard for LLM-navigable site indices
- ACE — Agentic Context Engineering with delta updates to prevent context collapse
