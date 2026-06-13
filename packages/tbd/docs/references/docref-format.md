---
title: Docref Format
description: A single-string, URI-like address for any document, the one source-address grammar used across tbd
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Docref Format (v0.1)

A **docref** is a single-string, URI-like address for a document.
It is the one address syntax used everywhere tbd names where a doc comes from or lives:
`docs_cache.files` values, the fork manifest’s `source` field, and future `tbd docs add`
arguments. The grammar is tool-agnostic: any application can adopt it, and the reference
implementation (`src/docref/` in tbd) is standalone and dependency-free.

## Forms

| Form | Example | Meaning |
| --- | --- | --- |
| internal | `internal:guidelines/python-rules.md` | A doc bundled inside the consuming tool. App-relative: each tool resolves it against its own bundled collection. |
| local | `./docs/general/`, `../shared/rules.md`, `/abs/f.md`, `C:/docs/f.md` | A filesystem path. Must be **anchored**: `./`, `../`, `/`, or a Windows drive letter. |
| url | `https://example.com/style.md` | A plain URL, kept verbatim. |
| git | `github:owner/repo@ref//path/to/file.md` | A file in a git host’s repo. `gitlab:` likewise. `@ref` is optional; `//` separates repo from path. |
| git + fragment | `github:o/r@main//f.md#naming` | Optional in-document anchor, preserved verbatim. |

The `//` separator makes refs with slashes unambiguous:
`github:o/r@feature/x//docs/f.md` pins ref `feature/x`. Unlike GitHub blob URLs, where
ref and path cannot be split reliably.

## Strictness

The grammar is deliberately strict; consumers may be lenient at their own boundary:

- **Bare relative strings are not docrefs** (`guidelines/x.md` is invalid).
  A consumer that wants to accept them may prepend `./` before parsing.
  A strict grammar plus lenient consumers composes; the reverse can never be tightened.
- **Home-relative paths (`~/…`) are rejected** in v0.1 (no portable expansion
  semantics).
- **Unknown schemes are rejected** (`mailto:…`, `git:…`). Additional protocols, for
  example a host-bearing git scheme for forges beyond GitHub/GitLab, may be added in
  future versions.

## Normalization

Web URLs that point at a known git host’s file view normalize to the canonical scheme,
so one file has one address:

- `https://github.com/o/r/blob/main/f.md` → `github:o/r@main//f.md`
- `https://raw.githubusercontent.com/o/r/main/f.md` → `github:o/r@main//f.md`
- `https://gitlab.com/o/r/-/blob/main/f.md` → `gitlab:o/r@main//f.md`

URL fragments are preserved through normalization; a normalizer must never silently drop
data.

## Equality

Two docrefs are equal when their canonical forms are identical, except that local paths
compare with a single leading `./` ignored.
Equality is purely syntactic: hosts and owners are not case-normalized, and no network
or filesystem is consulted.

## Prior Art

[purl](https://github.com/package-url/purl-spec) addresses *packages*
(`pkg:type/namespace/name@version`); its identity is the package, with file paths as an
awkward suffix. docref’s identity is the *document*, with in-repo paths and anchored
local files as first-class forms, which is why a separate small grammar exists rather
than a purl profile.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
