---
title: Review Code (TypeScript)
description: TypeScript-focused code review (language-specific rules only)
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut performs a **TypeScript-focused** code review, checking
TypeScript-specific best practices, patterns, and antipatterns.

For a **comprehensive review** that includes general coding rules, error handling,
comment quality, and testing practices, use `tbd shortcut review-code` instead.
For the full PR review lifecycle (publishing and addressing reviews), see
`tbd shortcut pr-review-workflows`.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Identify the code to review:
   - If changes are staged, review `git diff --cached`
   - If changes are unstaged, review `git diff`
   - Or review specific files the user mentions

2. Load the review process and the TypeScript guidelines:
   - Run `tbd guidelines code-review-rules` (severity vocabulary, risk ordering, and
     what makes a finding actionable)
   - Run `tbd guidelines typescript-rules typescript-lint-format-rules`

3. Perform a TypeScript-focused review:
   - Check TypeScript-specific patterns: types, generics, inference, null safety
   - Verify proper use of TypeScript features (interfaces, enums, utility types)
   - Identify TypeScript antipatterns (any abuse, type assertions, missing types)
   - Assess type safety and strictness
   - If lint, format, tsconfig, or hook configs changed, check them against the
     `typescript-lint-format-rules` floor (strict presets, zero-warning verify gates)

4. Summarize findings:
   - List TypeScript-specific issues found (if any) with file:line references
   - Suggest specific fixes
   - Note any TypeScript patterns that should be addressed

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
