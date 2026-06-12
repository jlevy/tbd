---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd
  tbd init --prefix=bd --quiet
---
# tbd CLI: Doc Output Formatting

This tryscript validates that documentation commands properly handle color and output
modes.

When piped or with `--color=never`, output should be plain text without ANSI codes.
When in `--json` mode, raw content should be returned.

Note: We run with NO_COLOR=1 set in env, so all output is plain text in tests.

* * *

## Guidelines Output

# Test: Guidelines --list produces clean output

Note: Output includes size/token info like “(2.99 kB, ~847 tok)”

```console
$ tbd --color=never guidelines --list | head -3
backward-compatibility-rules [..]
   Backward Compatibility[..] Guidelines for maintaining backward
[..]
? 0
```

# Test: Guidelines --list --json emits a docmap (one model across all doc surfaces)

```console
$ tbd guidelines --list --json | head -6
{
  "docmap": "docmap/0.1",
  "documents": [
    {
      "name": "backward-compatibility-rules",
[..]
? 0
```

# Test: Guidelines query with --color=never produces plain output

```console
$ tbd --color=never guidelines commit-conventions | head -8
Agent instructions: You have activated a guidelines document. If a user has asked you to apply these rules, read them carefully and apply them. Use beads to track each step.

---
title: [..]Commit[..]
description: Conventional Commits format with extensions for agentic workflows
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
? 0
```

# Test: Guidelines query with --json returns the docmap entry plus content

```console
$ tbd guidelines commit-conventions --json | head -5
{
  "name": "commit-conventions",
  "type": "guideline",
  "source": "internal:guidelines/commit-conventions.md",
  "title": "[..]Commit[..]",
? 0
```

* * *

## Shortcut Output

# Test: Shortcut --list produces clean output

Note: List shows system shortcuts first when no standard shortcuts available.

```console
$ tbd --color=never shortcut --list | head -3
[..] [..]
   [..]
[..]
? 0
```

# Test: Shortcut query with --color=never produces plain output

```console
$ tbd --color=never shortcut welcome-user | head -5
Agent instructions: You have activated a shortcut with task instructions. If a user has asked you to do a task that requires this work, follow the instructions below carefully.

---
title: Welcome User
description: Welcome message for users after tbd installation or setup
? 0
```

* * *

## Docs Command

# Test: Manual section listing with --color=never produces clean output

```console
$ tbd --color=never docs show tbd-docs --sections | head -3
Sections in tbd-docs:

[..]
? 0
```

* * *

## Template Output

# Test: Template --list produces clean output

```console
$ tbd --color=never template --list | head -3
[..]-doc [..]
   [..]: Template for [..]
[..]
? 0
```

* * *

## Piped Output (Non-TTY)

Note: In tryscript sandbox, we test with NO_COLOR=1 which ensures no ANSI codes.
In real usage, piping (e.g., `tbd guidelines foo | cat`) sets isTTY=false, which also
disables colors and pagination.

# Test: Output piped through cat has no ANSI escape codes

```console
$ tbd guidelines commit-conventions 2>&1 | cat | head -5
Agent instructions: You have activated a guidelines document. If a user has asked you to apply these rules, read them carefully and apply them. Use beads to track each step.

---
title: [..]Commit[..]
description: Conventional Commits format with extensions for agentic workflows
? 0
```
