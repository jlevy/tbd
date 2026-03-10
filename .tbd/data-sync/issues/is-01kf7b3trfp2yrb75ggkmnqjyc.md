---
type: is
id: is-01kf7b3trfp2yrb75ggkmnqjyc
title: Auto-format markdown with Flowmark instead of ESLint
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-18T01:22:05.198Z
updated_at: 2026-03-09T16:12:31.352Z
closed_at: 2026-01-18T01:46:07.111Z
close_reason: Added pnpm format:md script using Flowmark. ESLint already only processes TypeScript, Prettier already ignores *.md. Ran Flowmark on all docs.
---
Switch markdown formatting from ESLint to Flowmark for better markdown-specific formatting.

## Tasks

- Remove markdown file handling from ESLint configuration
- Add Flowmark formatting script/command
- Update pre-commit hooks or lint scripts to use Flowmark for .md files

## Implementation

Format command:
find README.md docs -name "*.md" -type f | xargs uvx flowmark@latest --auto

ESLint changes:
- Exclude *.md files from ESLint processing
- Remove any markdown-related ESLint plugins if present

## Rationale

Flowmark is purpose-built for markdown formatting and handles line wrapping, reflowing, consistent list formatting, proper spacing around headings, and smart quote handling. ESLint is designed for JavaScript/TypeScript, not prose documents.
