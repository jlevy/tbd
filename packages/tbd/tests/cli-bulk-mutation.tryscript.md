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
# tbd CLI: Bulk Mutation

Tests for variadic `tbd close` (Phase 1 agent CLI ergonomics).
Single-ID behavior is covered by cli-crud; this file covers the multi-target (bulk)
paths.

* * *

## Bulk close

# Test: Seed three open issues

```console
$ tbd create "Bulk A" --json | jq -r '.id' | tee a.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Bulk B" --json | jq -r '.id' | tee b.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Bulk C" --json | jq -r '.id' | tee c.txt
test-[SHORTID]
? 0
```

# Test: Close two issues at once (one summary line + visible sync hint)

```console
$ tbd close $(cat a.txt) $(cat b.txt)
✓ Closed 2: test-[SHORTID] test-[SHORTID]
• Unsynced changes[..]
? 0
```

# Test: Closing again reports both as skipped (bulk idempotent)

```console
$ tbd close $(cat a.txt) $(cat b.txt)
✓ Closed 0, skipped 2 (already closed): test-[SHORTID] test-[SHORTID]
? 0
```

# Test: An unknown ID fails closed and changes nothing

```console
$ tbd close $(cat c.txt) test-zzzz 2>&1
[..]
? 1
```

# Test: c is still open after the aborted batch

```console
$ tbd show $(cat c.txt) --json | jq -r '.status'
open
? 0
```

# Test: --ignore-missing closes the known ID and reports the unknown

```console
$ tbd close $(cat c.txt) test-zzzz --ignore-missing
✓ Closed 1, not found 1: test-[SHORTID] test-zzzz
• Unsynced changes[..]
? 0
```

# Test: --json emits a structured results array and summary

```console
$ tbd create "Bulk D" --json | jq -r '.id' | tee d.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Bulk E" --json | jq -r '.id' | tee e.txt
test-[SHORTID]
? 0
```

```console
$ tbd close $(cat d.txt) $(cat e.txt) --json | jq -r '.summary.changed'
2
? 0
```

# Test: --quiet is silent on success (bulk)

```console
$ tbd create "Bulk F" --json | jq -r '.id' | tee f.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Bulk G" --json | jq -r '.id' | tee g.txt
test-[SHORTID]
? 0
```

```console
$ tbd close $(cat f.txt) $(cat g.txt) --quiet
? 0
```
