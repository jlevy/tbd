---
title: Release Notes Guidelines
description: Rules for release notes that describe the published delta and exclude defects introduced and corrected before release from separate Fixes entries
category: general
---
# Release Notes Guidelines

Write release notes that are accurate, scannable, and useful to users deciding whether
to upgrade.

## Structure

Use these sections in order (omit empty sections):

```markdown
## What's Changed

### Features
- New capabilities users can now do

### Fixes
- Bug fixes and corrections

### Guidelines and content
- Changes to shipped guidelines, skills, shortcuts, or templates that users invoke

### Refactoring
- Internal improvements (only if user-visible impact)

### Documentation
- Doc improvements (only notable ones)

**Full commit history**: [link to compare]
```

**Releases are not code-only.** If the project ships content—bundled guidelines, skills,
shortcuts, prompts, or templates that users invoke—changes to that content are product
changes. Review those diffs (not just code commits) and give them their own
`### Guidelines and content` section.
Reserve `### Documentation` for docs *about* the project (README, dev/internal docs);
shipped content a user can invoke is never an “internal doc” to skip.

## Core Principle: Describe the Delta

**Think in terms of two points in time:**

1. The state of the application at the previous release
2. The state of the application at this release

Release notes describe the **aggregate difference** between these two states.
Don’t recap individual commits or intermediate changes - describe what’s different now
compared to before.

**Example:** If a feature was added and then bug-fixed before release, don’t list the
bug fix separately.
Describe the feature as it now works (the complete, working version).

### Do Not List Unreleased Regressions as Fixes

Ask: **was this broken for someone running the previous release?**

If no — the defect only ever existed on a development branch, or in code that ships for
the first time in this release — it is **not a fix**. It is part of building the
feature, and it belongs in the feature’s description or nowhere at all.

This is the single most common error in these notes, because the development history is
right there in the commit log and every one of those commits honestly says `fix:`. A
commit message describes a change to the *branch*; a release note describes a change to
the *published product*. They are different subjects, and only the second one has users.

Two concrete cases:

- A feature shipping for the first time this release had six bugs found and fixed while
  building it. Users experienced none of them.
  Describe the feature; mention none of the six.
- A behavior was introduced, refined twice, and renamed before release.
  Users see one new behavior under its final name.
  Describe that, not the path taken to it.

The same rule applies when a refactor creates the defect.
If the regression and its repair both occur before release, neither is a shipped fix;
describe only the user-visible aggregate change.

A useful cross-check: run `git log $PREV..HEAD` and, for each `fix:` commit, find the
published version that carried the bug.
If you cannot name one, cut the entry.

## Writing Principles

### 1. Consolidate Related Changes

Group sub-features, fixes, and improvements with their parent feature rather than
listing them separately.
If a bug fix is for a feature added in the same release, incorporate it into the feature
description.

**Bad:**

```markdown
### Features
- **Workspace sync**: New tbd save command
- **Workspace list**: Show saved workspaces

### Fixes
- **Workspace mappings**: Save now filters mappings correctly
```

**Good:**

```markdown
### Features
- **Workspace sync feature**: New commands for managing local workspace backups:
  - `tbd save` to export issues (filters mappings correctly)
  - `tbd workspace list` to show saved workspaces with counts
```

### 2. Write From the User’s Perspective

Describe capabilities users now have, not implementation details.
A user reading the notes should understand what they can do differently after upgrading.

### 3. Be Specific About Impact

Include the user-facing impact, not just the implementation detail.

**Bad:**

> Increased git maxBuffer

**Good:**

> Git maxBuffer overflow: Increased buffer from 1MB to 50MB to prevent sync failures on
> large repos

### 4. Use Consistent Formatting

- Bold the feature/fix name
- Use bullet points for sub-items
- Include command names in backticks
- Keep descriptions concise (1-2 lines)

### 5. Skip Internal-Only Changes

Don’t include:

- Test-only changes (unless they fix flaky tests users noticed)
- Pure refactoring with no user impact
- CI/tooling changes
- Minor typo fixes in docs *about* the project (README, dev/internal docs)

Do **not** treat shipped content as internal.
Changes to guidelines, skills, shortcuts, or templates that users invoke are product
changes—include them under `Guidelines and content` (see Structure).

## Review Checklist

Before finalizing release notes:

- [ ] Does each item describe the aggregate delta from the previous release?
- [ ] Does every item under Fixes correct behavior broken in the previous release?
- [ ] Are related changes (features and their fixes) consolidated under one heading?
- [ ] Would a user understand what’s different after upgrading?
- [ ] Are feature names/commands in consistent format?
- [ ] Are internal-only changes excluded?
- [ ] Did you review shipped-content diffs (guidelines, skills, shortcuts, templates),
  not just code commits, and give them a section?

## Example

```markdown
## What's Changed

### Features

- **Workspace sync feature**: New commands for managing local workspace backups:
  - `tbd save` to export issues to workspace directories (supports `--updates-only`)
  - `tbd workspace list` to show saved workspaces with issue counts
  - `tbd import --workspace` to restore from workspace backups
- **Child bead ordering**: New `child_order` field allows explicit ordering of child
  beads

### Fixes

- **Git maxBuffer overflow**: Increased buffer from 1MB to 50MB to prevent sync
  failures on large repos

**Full commit history**: https://github.com/org/repo/compare/v0.1.12...v0.1.13
```

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
