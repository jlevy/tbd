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

Tests for variadic `tbd close` and `tbd reopen` (Phase 1 agent CLI ergonomics).
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

The full machine contract in one line: the per-item `results` actions, the complete
`summary` key set, and the `sync.pending` flag.

```console
$ tbd close $(cat d.txt) $(cat e.txt) --json | jq -r '[(.summary | keys | join(",")), (.results | map(.action) | join(",")), (.sync.pending | tostring), (.summary.changed | tostring)] | join("|")'
changed,failed,missing,skipped,total|closed,closed|true|2
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

* * *

## Bulk reopen

# Test: Seed two issues and close them

```console
$ tbd create "Reopen A" --json | jq -r '.id' | tee ra.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Reopen B" --json | jq -r '.id' | tee rb.txt
test-[SHORTID]
? 0
```

```console
$ tbd close $(cat ra.txt) $(cat rb.txt) --quiet
? 0
```

# Test: Reopen two issues at once (one summary line + visible sync hint)

```console
$ tbd reopen $(cat ra.txt) $(cat rb.txt)
✓ Reopened 2: test-[SHORTID] test-[SHORTID]
• Unsynced changes[..]
? 0
```

# Test: Reopening again reports both as skipped (bulk idempotent)

```console
$ tbd reopen $(cat ra.txt) $(cat rb.txt)
✓ Reopened 0, skipped 2 (not closed): test-[SHORTID] test-[SHORTID]
? 0
```

# Test: An unknown ID fails closed and changes nothing

```console
$ tbd reopen $(cat ra.txt) test-zzzz 2>&1
[..]
? 1
```

# Test: --ignore-missing reopens the known ID and reports the unknown

Re-close `ra` so there is something to reopen:

```console
$ tbd close $(cat ra.txt) --quiet
? 0
```

```console
$ tbd reopen $(cat ra.txt) test-zzzz --ignore-missing
✓ Reopened 1, not found 1: test-[SHORTID] test-zzzz
• Unsynced changes[..]
? 0
```

# Test: --json emits a structured results array and summary

```console
$ tbd create "Reopen C" --json | jq -r '.id' | tee rc.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Reopen D" --json | jq -r '.id' | tee rd.txt
test-[SHORTID]
? 0
```

```console
$ tbd close $(cat rc.txt) $(cat rd.txt) --quiet
? 0
```

```console
$ tbd reopen $(cat rc.txt) $(cat rd.txt) --json | jq -r '.summary.changed'
2
? 0
```

# Test: --quiet is silent on success (bulk)

```console
$ tbd create "Reopen E" --json | jq -r '.id' | tee re.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Reopen F" --json | jq -r '.id' | tee rf.txt
test-[SHORTID]
? 0
```

```console
$ tbd close $(cat re.txt) $(cat rf.txt) --quiet
? 0
```

```console
$ tbd reopen $(cat re.txt) $(cat rf.txt) --quiet
? 0
```

* * *

## Bulk update

# Test: Seed two open issues

```console
$ tbd create "Update A" --json | jq -r '.id' | tee ua.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Update B" --json | jq -r '.id' | tee ub.txt
test-[SHORTID]
? 0
```

# Test: Bulk-set shared fields (priority + label) on both

```console
$ tbd update $(cat ua.txt) $(cat ub.txt) --priority 0 --add-label delivered
✓ Updated 2: test-[SHORTID] test-[SHORTID]
• Unsynced changes[..]
? 0
```

# Test: The shared label was applied

```console
$ tbd show $(cat ua.txt) --json | jq -r '.labels[0]'
delivered
? 0
```

# Test: A per-ID-only flag (--title) is rejected for multiple IDs

```console
$ tbd update $(cat ua.txt) $(cat ub.txt) --title "Nope" 2>&1
[..]
? 1
```

# Test: --status is rejected for bulk (no bulk-close bypass)

```console
$ tbd update $(cat ua.txt) $(cat ub.txt) --status closed 2>&1
[..]
? 1
```

# Test: Both are still open (the rejected bulk close changed nothing)

```console
$ tbd show $(cat ua.txt) --json | jq -r '.status'
open
? 0
```

# Test: An unknown ID fails closed and changes nothing

```console
$ tbd update $(cat ua.txt) test-zzzz --priority 1 2>&1
[..]
? 1
```

# Test: --ignore-missing updates the known ID and reports the unknown

```console
$ tbd update $(cat ua.txt) test-zzzz --assignee alice --ignore-missing
✓ Updated 1, not found 1: test-[SHORTID] test-zzzz
• Unsynced changes[..]
? 0
```

# Test: --json emits a structured results array and summary

```console
$ tbd update $(cat ua.txt) $(cat ub.txt) --add-label shipped --json | jq -r '.summary.changed'
2
? 0
```

# Test: Updating with no fields is a usage error (exit 2)

```console
$ tbd update $(cat ua.txt) $(cat ub.txt) 2>&1
[..]
? 2
```

# Test: --quiet is silent on success (bulk)

```console
$ tbd update $(cat ua.txt) $(cat ub.txt) --priority 2 --quiet
? 0
```

* * *

## Removed `--no-sync`

The legacy global `--no-sync` was a no-op (it set a context flag no mutator read) and is
gone; issue writes always stage locally and `tbd sync` publishes.
Passing it now errors as an unknown option rather than silently doing nothing.

# Test: `close` rejects the removed `--no-sync`

```console
$ tbd close test-zzzz --no-sync 2>&1
error: unknown option '--no-sync'
? 1
```

# Test: `reopen` rejects the removed `--no-sync`

```console
$ tbd reopen test-zzzz --no-sync 2>&1
error: unknown option '--no-sync'
? 1
```

# Test: `update` rejects the removed `--no-sync`

```console
$ tbd update test-zzzz --priority 1 --no-sync 2>&1
error: unknown option '--no-sync'
? 1
```
