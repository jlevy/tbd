---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  SHORTID: '[0-9a-z]{4,5}'
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
# tbd CLI: Recoverable Errors

Tests for did-you-mean ID suggestions, ID matching in `tbd search`, and
argument-overflow tips (agent CLI ergonomics round 2, tbd-xgge).
Errors should redirect the agent to the right next call instead of stranding it.

This sandbox seeds exactly one issue so near-miss suggestions are deterministic.

* * *

# Test: Seed one issue

```console
$ tbd create "Recovery target" --json | jq -r '.id' | tee a.txt
test-[SHORTID]
? 0
```

# Test: A one-typo ID gets a did-you-mean pointing at the real bead

```console
$ tbd show "$(cat a.txt)x" 2>&1
Error: Issue not found: test-[SHORTID]x
Did you mean: test-[SHORTID]? (`tbd search <text>` finds issues by content or ID)
? 1
```

# Test: The same hint appears on a bulk mutator’s fail-closed error

```console
$ tbd close "$(cat a.txt)x" 2>&1
Error: Issue not found: test-[SHORTID]x
Did you mean: test-[SHORTID]? (`tbd search <text>` finds issues by content or ID)
? 1
```

# Test: A distant garbage ID keeps the plain error (no wrong guesses)

```console
$ tbd show test-zzzzzzz 2>&1
Error: Issue not found: test-zzzzzzz
? 1
```

# Test: search matches the display ID itself (native partial-ID lookup)

```console
$ tbd search "$(cat a.txt)" | grep -c "\[id\]"
1
? 0
```

# Test: search matches a partial ID (short portion without prefix)

```console
$ tbd search "$(cut -d- -f2 a.txt)" | grep "Recovery target" | head -1
[..]Recovery target
? 0
```

# Test: create overflow points at the one-title contract

```console
$ tbd create "One" "Two" 2>&1 | head -2
error: too many arguments for 'create'. Expected 1 argument but got 2.
tip: create takes one title; run one create per bead (--parent/--depends-on wire it in the same call)
? 0
```
