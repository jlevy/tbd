---
title: Docmap Format
description: A minimal, machine-readable inventory of a collection of documents — a sitemap for docs, with docref as its addressing primitive
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Docmap Format (docmap/0.1)

A **docmap** is a machine-readable inventory of a collection of documents: one entry per
doc, each with an identity, a location, and presentation metadata.
It describes a collection; it says nothing about how the collection is assembled,
fetched, or kept fresh.
A docmap is a generated **view** of a collection, never an input to resolution — tools
that serve docs resolve by their own conventions and *emit* a docmap (as
`tbd docs list --json` does); future machinery that consumes docmaps as sources is
defined as operations *over* this format, not as part of it.

## Shape

```yaml
docmap: docmap/0.1
name: tbd-docs                                    # optional collection name
documents:
  - name: python-rules
    type: guideline
    path: guidelines/python-rules.md              # location within the collection
    source: internal:guidelines/python-rules.md   # provenance docref
    title: Python Coding Rules
    description: Type hints, docstrings, exception handling
```

Rules:

- **Identity**: `type` + `name`, unique within the map.
  `type` is an open vocabulary (tbd uses `guideline` / `shortcut` / `template` /
  `reference`).
- **Location**: every entry carries `path` and/or `source` (a
  [docref](docref-format.md)). An inventory whose entries cannot be located is not an
  inventory.
- **Path relativity**: for a docmap committed as a file, `path` is relative to the
  docmap file’s own directory (the sitemap convention); generated docmaps state their
  collection root out of band (tbd’s `--json` paths are repo-relative).
- **Presentation metadata**: `title` and `description` are the core fields.
- **Extension fields**: producers may attach anything else — tbd adds `state` and
  `stale`; size metrics (`word_count`, `size_bytes`, token estimates) are likewise
  extensions, not core.
  **Consumers must ignore unknown fields.**

## Versioning

The `docmap:` value is the format tag.
Readers accept `docmap/0.*` and reject other majors with a clear error: a different
major may change field semantics, and failing fast beats misreading.

## Reference Implementation

`src/docmap/` in tbd: standalone, dependency-free schema, validation, and query helpers,
structured for extraction into its own package.
Producers may generate docmaps (every tbd list/inventory command emits one) or
hand-author them — any repo can commit a docmap to advertise its doc collection.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
