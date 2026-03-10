# Feature: kdex — Knowledge Index CLI

**Date:** 2026-02-16

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

## Overview

`kdex` is a standalone CLI + library for managing curated knowledge documents (guidelines,
shortcuts, templates, references). It subsumes tbd's current `docs_cache` config and
doc-sync system with a cleaner, more general architecture based on the
[knowledge-on-demand research](../../research/current/research-agent-knowledge-on-demand.md).

The core idea: all knowledge items are addressed by **path keys** in a unified local
store. That store may be backed by checked-in files (a `docs/` directory, a
`typescript-rules/` folder — whatever the project uses) or by a gitignored cache
(`.kdex/cache/`) populated from remote sources. The consumer doesn't need to know which.

## Goals

- Provide a single, composable CLI for knowledge discovery, lookup, search, and
  progressive reading
- Subsume tbd's `docs_cache.files`, `docs_cache.sources`, and `lookup_path` config
  with a cleaner source/store model
- Support two store models: checked-in knowledge directories and gitignored cache
- Use docspec format (`github:owner/repo@ref//path`) for remote references
- Pre-compute a knowledge map (doc cards) enabling O(1) lookup from compact metadata
- Integrate into tbd as a library dependency (tbd wraps kdex for its doc commands)
- Work standalone for non-tbd users

## Non-Goals

- Embedding databases, vector stores, or heavyweight search infrastructure (v1)
- Bidirectional sync or upstream contribution workflows (v1 — fork-the-repo via git)
- MCP server mode (can be added later)
- Real-time watch/sync (periodic pull is sufficient)

## Background

### What tbd Has Today

tbd's `docs_cache` in `.tbd/config.yml` has evolved through three format versions to
the current f03 schema:

```yaml
docs_cache:
  files:
    guidelines/typescript-rules.md: internal:guidelines/typescript-rules.md
    shortcuts/standard/code-review.md: internal:shortcuts/standard/code-review.md
    shortcuts/custom/my-doc.md: https://raw.githubusercontent.com/org/repo/main/doc.md
  lookup_path:
    - .tbd/docs/shortcuts/system
    - .tbd/docs/shortcuts/standard
```

The planned f04 format (see
[external-docs-repos spec](plan-2026-02-02-external-docs-repos.md)) adds
prefix-namespaced `sources`:

```yaml
docs_cache:
  sources:
    - type: internal
      prefix: tbd
      paths: [shortcuts/]
    - type: repo
      prefix: spec
      url: github.com/jlevy/speculate
      ref: main
      paths: [shortcuts/, guidelines/, templates/, references/]
```

### Problems kdex Solves

1. **tbd-coupled**: Knowledge management is embedded in tbd's config format and release
   cycle. Non-tbd users can't benefit.
2. **No progressive reading**: Docs are either fully loaded or not — no summary, outline,
   or purpose-level access.
3. **No knowledge map**: Agents must enumerate docs by filename, with no metadata to
   decide relevance without reading the full content.
4. **Rigid directory structure**: The `shortcuts/system`, `shortcuts/standard` split and
   fixed doc types (guidelines, shortcuts, templates) are prescriptive. Real knowledge
   repos have arbitrary structures.
5. **No local-repo sources**: Can't point at a directory in the current repo as a
   knowledge source without going through the sync/cache machinery.

## Design

### The Store: Path-Keyed Knowledge Items

Every knowledge item has a **path key** — a slash-separated string that uniquely
identifies it in the local store. Path keys are the fundamental addressing unit:

```
typescript-rules
guidelines/python-rules
org/runbooks/deploy-checklist
speculate/shortcuts/code-review-and-commit
```

Path keys are derived from the item's filesystem location relative to its source root.
They are stable, human-readable, and work as both CLI arguments and programmatic
identifiers.

### Two Store Backends

kdex supports two backends for materializing knowledge items locally. Both produce the
same path-keyed view — the consumer doesn't need to know which backend provides a given
item.

**1. Checked-in store (versioned with the repo)**

A directory in the repo that contains knowledge documents directly. Checked into git,
versioned with the project. Examples:

```
# A dedicated knowledge directory
docs/knowledge/
  guidelines/
    typescript-rules.md
    python-rules.md
  shortcuts/
    code-review-and-commit.md

# Or a standalone knowledge repo (like speculate)
guidelines/
  typescript-rules.md
templates/
  plan-spec.md
```

Configured as a source with `type: local`:

```yaml
sources:
  - type: local
    path: docs/knowledge     # relative to repo root
    prefix: ""               # items appear at root of key space
```

Items are always fresh (read directly from the working tree). No sync needed. This is
the simplest model — just markdown files in a directory.

**2. Cache store (gitignored, populated from remote sources)**

A gitignored directory (`.kdex/cache/`) that materializes documents from remote
sources. Populated by `kdex sync`, refreshed periodically or on demand.

```
.kdex/
  cache/
    github.com-jlevy-speculate/    # sparse checkout or downloaded files
      guidelines/
        typescript-rules.md
      shortcuts/
        code-review-and-commit.md
    github.com-org-standards/
      guidelines/
        security-rules.md
```

Configured as a source with `type: repo`:

```yaml
sources:
  - type: repo
    url: github.com/jlevy/speculate
    ref: main
    prefix: speculate
    paths: [guidelines/, shortcuts/, templates/]
```

Items are synced via shallow git clone or sparse checkout. The cache is gitignored —
it's a local materialization of remote content, regenerable from config.

### Source Configuration

The `kdex.yml` config file (or the `kdex` section of tbd's config) declares sources
in precedence order:

```yaml
# kdex.yml
sources:
  # Local docs in this repo (highest precedence)
  - type: local
    path: docs/guidelines
    prefix: ""

  # Shared org knowledge (git repo, cached)
  - type: repo
    url: github.com/jlevy/speculate
    ref: main
    prefix: speculate
    paths: [guidelines/, shortcuts/, templates/, references/]

  # Additional org-specific repo
  - type: repo
    url: github.com/myorg/standards
    ref: main
    prefix: org
    paths: [guidelines/]
```

**Precedence**: Earlier sources win when path keys collide after prefix stripping. A
local `typescript-rules.md` shadows `speculate/typescript-rules.md` if both exist and
both resolve to the same unqualified name.

**Prefix semantics**:
- Required for repo sources (namespaces remote content)
- Optional for local sources (empty string = root of key space)
- Items are addressable both qualified (`speculate/typescript-rules`) and unqualified
  (`typescript-rules`) — unqualified resolves via precedence order

### Docspecs

Remote sources use the docspec format for references:

```
github:owner/repo@ref//path
```

This follows GitHub Actions (`@ref`), Nix flakes (`github:` prefix), and Terraform
(`//path`) conventions, avoiding the slash-in-branch-name ambiguity of GitHub web URLs.
See [research doc, Docspecs section](../../research/current/research-agent-knowledge-on-demand.md#docspecs-referencing-documents)
for the full rationale.

In config, docspecs decompose into `url` + `ref` + `paths` fields for readability:

```yaml
# These are equivalent:
# docspec: github:jlevy/speculate@main//guidelines/
- type: repo
  url: github.com/jlevy/speculate
  ref: main
  paths: [guidelines/]
```

### The Knowledge Map

The map is a pre-compiled index enabling all five access modalities (Awareness, Lookup,
Search, Progressive Reading, Meta Documentation). Generated by `kdex build`:

```yaml
# .kdex/map.yml (generated — do not edit manually)
version: 1
built: 2026-02-16T10:00:00Z

documents:
  - id: typescript-rules
    path: guidelines/typescript-rules.md
    source: speculate
    title: "TypeScript Rules and Best Practices"
    description: "Comprehensive TypeScript coding rules"
    when: "Writing, reviewing, or refactoring TypeScript code"
    signals: [typescript, ts, .tsx, type safety, strict mode]
    summary: |
      Rules covering strict configuration, type patterns, error handling
      with Result types, naming conventions, and import organization.
    outline:
      - "Strict Configuration: tsconfig requirements"
      - "Type Patterns: unions, branding, narrowing"
      - "Error Handling: Result types, boundaries"
    tokens: 3200
```

The map is small enough (~50-100 tokens per item) to include in CLAUDE.md, SKILL.md,
or `tbd prime` output as an always-on directory.

### CLI Interface

```bash
# Source management
kdex init                              # Initialize kdex.yml
kdex source add <docspec> [--prefix=X] # Add a source
kdex source list                       # List configured sources
kdex sync [<prefix>]                   # Sync remote sources to cache

# Build the knowledge map
kdex build                             # (Re)build map from all sources
kdex status                            # Show map freshness, source status

# Lookup and retrieval
kdex list [--source=<prefix>]          # List available items
kdex get <key>                         # Full document
kdex get <key> --level=purpose         # When-to-use metadata (~30 tokens)
kdex get <key> --level=summary         # Paragraph overview (~80 tokens)
kdex get <key> --level=outline         # Heading structure
kdex get <key> --section=<heading>     # Specific section

# Search
kdex search <query>                    # Search map metadata + content
kdex search <query> --top=5            # Limit results

# Context routing
kdex route --files=<paths>             # Suggest relevant docs for files
kdex map [--budget=<tokens>]           # Print compact map for injection
```

### Subsumption of tbd's Doc System

tbd integrates kdex as a library dependency. The migration path:

| tbd concept | kdex equivalent |
| --- | --- |
| `docs_cache.files` | `kdex.sources` with `type: local` or `type: repo` |
| `docs_cache.lookup_path` | Source precedence order (earlier wins) |
| `docs_cache.sources` (f04) | `kdex.sources` directly |
| `internal:` source type | `type: local` pointing at tbd's bundled docs |
| `DocCache.get(name)` | `kdex.get(key)` |
| `DocCache.search(query)` | `kdex.search(query)` |
| `DocSync.sync()` | `kdex.sync()` |
| `tbd guidelines <name>` | Thin wrapper around `kdex get <key>` |
| `tbd shortcut <name>` | Thin wrapper around `kdex get <key>` |

tbd retains ownership of its CLI commands and tbd-specific workflows. kdex handles all
document resolution, caching, and retrieval.

### Directory Layout

```
project/
├── kdex.yml                    # Source configuration (checked in)
├── docs/knowledge/             # Checked-in store (optional, checked in)
│   ├── guidelines/
│   │   └── typescript-rules.md
│   └── shortcuts/
│       └── code-review.md
├── .kdex/                      # Generated artifacts
│   ├── map.yml                 # Knowledge map (checked in or gitignored — user choice)
│   └── cache/                  # Gitignored — remote source materializations
│       ├── .gitignore          # Contains "*"
│       └── github.com-jlevy-speculate/
│           └── guidelines/
│               └── typescript-rules.md
```

For tbd integration, `kdex.yml` could be embedded in `.tbd/config.yml` as a `kdex:`
section, or tbd could read a standalone `kdex.yml` — the library supports both.

## Implementation Plan

### Phase 1: Core Store + Source Resolution

- [ ] Create `@jlevy/kdex` package in the monorepo
- [ ] Implement source config schema (Zod): `local` and `repo` source types
- [ ] Implement path-key resolution from local sources (direct filesystem read)
- [ ] Implement cache store: shallow clone / sparse checkout for repo sources
- [ ] Implement `kdex sync` for remote sources
- [ ] Implement `kdex list` and `kdex get <key>` (full content retrieval)
- [ ] Implement precedence-based shadowing across sources
- [ ] Implement `kdex init` and `kdex source add/list`
- [ ] Unit tests for source resolution, path keys, shadowing, sync

### Phase 2: Knowledge Map + Progressive Reading

- [ ] Implement `kdex build` — front-matter extraction + heading outline generation
- [ ] Define map schema (YAML): id, path, source, title, description, when, signals,
  summary, outline, tokens
- [ ] Implement `kdex get <key> --level=purpose|summary|outline|content`
- [ ] Implement `kdex map` — emit compact awareness block for CLAUDE.md injection
- [ ] Implement `kdex search` — keyword matching over map metadata fields
- [ ] Optional: `kdex build --enrich` with LLM-generated summaries and signals
- [ ] Tests for map generation, progressive reading levels, search

### Phase 3: tbd Integration

- [ ] Add `@jlevy/kdex` as tbd dependency
- [ ] Migrate tbd's `DocCache` to use kdex's store as its backend
- [ ] Migrate tbd's `DocSync` to use kdex's sync
- [ ] Config migration: `docs_cache` → kdex source config (f04 or f05)
- [ ] Ensure `tbd guidelines`, `tbd shortcut`, `tbd template` work via kdex
- [ ] Backward compatibility: existing `.tbd/config.yml` files migrate cleanly
- [ ] Integration tests: tbd commands resolve docs through kdex

## Testing Strategy

- Unit tests for each module (source resolution, path keys, sync, map build, search)
- Integration tests: multi-source scenarios with precedence, shadowing, sync
- Golden tests: map generation output stability
- tbd integration tests: existing doc commands work identically after migration

## Open Questions

- Should `kdex.yml` be standalone or embedded in `.tbd/config.yml` for tbd users?
  Leaning toward standalone with tbd reading it — keeps kdex independent.
- Should the knowledge map (`.kdex/map.yml`) be checked in or gitignored? Checking it
  in makes it available without a build step; gitignoring keeps the repo cleaner.
  Likely user's choice.
- How to handle the `internal:` source type from tbd's bundled docs? Probably a
  `type: local` source pointing at the installed package's `dist/docs/` directory,
  configured automatically by tbd.

## References

- [Research: Agent Knowledge-on-Demand](../../research/current/research-agent-knowledge-on-demand.md)
  — Full research brief with prior art, architecture analysis, and design rationale
- [External Docs Repos Spec](plan-2026-02-02-external-docs-repos.md)
  — Current tbd spec for prefix-namespaced multi-source docs (f04)
- [CLI as Agent Skill Research](../../research/current/research-cli-as-agent-skill.md)
  — Patterns for CLIs that function as agent skills
