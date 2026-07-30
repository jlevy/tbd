---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd with test prefix
  tbd init --prefix=test
---
# tbd CLI: Multi-Name Doc Readers

Tests for variadic `tbd guidelines` / `tbd template` / `tbd shortcut` / `tbd docs show`
(agent CLI ergonomics round 2, tbd-hy6b). Loading a guideline group is one call: names
resolve all-or-nothing before any content prints, the agent preamble appears once,
duplicates render once, and `--json` emits an array.
Single-name behavior is unchanged (covered by cli-doc-output).

* * *

## Guidelines

# Test: Two guidelines load in one call with the agent preamble printed once

```console
$ tbd guidelines general-coding-rules general-testing-rules | grep -c "Agent instructions:"
1
? 0
```

# Test: Both docs are present, in argument order

```console
$ tbd guidelines general-testing-rules general-coding-rules | grep "^title:"
title: General Testing Rules
title: General Coding Rules
? 0
```

# Test: One bad name fails the whole batch before any content prints

```console
$ tbd guidelines general-coding-rules totally-bogus-name-xyz 2>&1
Error: No guideline found matching: totally-bogus-name-xyz
Run `tbd guidelines --list` to see available guidelines.
? 1
```

# Test: Duplicate names render once

```console
$ tbd guidelines general-coding-rules general-coding-rules | grep -c "^title:"
1
? 0
```

# Test: --json emits an array with per-doc content

```console
$ tbd guidelines general-coding-rules general-testing-rules --json | jq -r '[type, (length | tostring), (.[0].content != null | tostring)] | join("|")'
array|2|true
? 0
```

* * *

## Templates

# Test: Two templates load in one call

```console
$ tbd template plan-spec research-brief | grep -c "^title:"
2
? 0
```

# Test: A bad template name fails the whole batch

```console
$ tbd template plan-spec totally-bogus-name-xyz 2>&1
Error: No template found matching: totally-bogus-name-xyz
Run `tbd templates --list` to see available templates.
? 1
```

* * *

## Shortcuts

# Test: Two shortcuts load in one call with the agent preamble printed once

```console
$ tbd shortcut agent-handoff code-review-and-commit | grep -c "Agent instructions:"
1
? 0
```

# Test: Both shortcut docs are present

```console
$ tbd shortcut agent-handoff code-review-and-commit | grep -c "^title:"
2
? 0
```

# Test: A bad shortcut name fails the whole batch

```console
$ tbd shortcut agent-handoff totally-bogus-name-xyz 2>&1
Error: No shortcut found matching: totally-bogus-name-xyz
Run `tbd shortcut --list` to see available shortcuts.
? 1
```

# Test: --json emits an array of the per-shortcut shape

```console
$ tbd shortcut agent-handoff code-review-and-commit --json | jq -r '[type, (length | tostring), .[0].name] | join("|")'
array|2|agent-handoff
? 0
```

* * *

## docs show

# Test: Two managed docs (across kinds) load in one call

```console
$ tbd docs show general-coding-rules plan-spec | grep -c "^title:"
2
? 0
```

# Test: A bad doc name fails the whole batch

```console
$ tbd docs show general-coding-rules no-such-doc-xyz 2>&1
Error: Doc not found: no-such-doc-xyz (run `tbd docs list` to see names)
? 1
```

# Test: Duplicate names in a docs show batch render once

```console
$ tbd docs show general-coding-rules general-coding-rules | grep -c "^title:"
1
? 0
```

# Test: Section navigation stays single-doc (usage error with several names)

```console
$ tbd docs show general-coding-rules plan-spec --sections 2>&1
Error: --section/--sections apply to a single doc; pass one name
? 2
```
