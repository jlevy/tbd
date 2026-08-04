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
# tbd CLI: Bulk Dependency Wiring

Tests for variadic `tbd dep add`/`tbd dep remove` and `tbd create --depends-on` (agent
CLI ergonomics round 2, tbd-lunb).
One call declares “this bead is blocked by these N”; blockers can be wired at creation.
Single-edge behavior is covered by cli-crud and stays unchanged.

* * *

## Seeding

```console
$ tbd create "Dep A" --json | jq -r '.id' | tee a.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Dep B" --json | jq -r '.id' | tee b.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Dep C" --json | jq -r '.id' | tee c.txt
test-[SHORTID]
? 0
```

* * *

## Bulk dep add / remove

# Test: One call adds several blockers to one issue

```console
$ tbd dep add $(cat a.txt) $(cat b.txt) $(cat c.txt)
✓ test-[SHORTID] now depends on: test-[SHORTID] test-[SHORTID]
? 0
```

# Test: The issue is blocked by both

```console
$ tbd dep list $(cat a.txt)
Blocked by: test-[SHORTID], test-[SHORTID]
? 0
```

# Test: Re-adding reports the existing edges instead of failing

```console
$ tbd dep add $(cat a.txt) $(cat b.txt) $(cat c.txt)
✓ test-[SHORTID] now depends on: test-[SHORTID] test-[SHORTID] (2 already existed)
? 0
```

# Test: An unknown blocker fails the whole call (nothing written)

```console
$ tbd dep add $(cat b.txt) $(cat c.txt) test-zzzzzzz test-yyyyyyy 2>&1
Error: Issue not found: test-zzzzzzz, test-yyyyyyy
? 1
```

```console
$ tbd dep list $(cat b.txt)
Blocks: test-[SHORTID]
? 0
```

# Test: Self-dependency in a batch is rejected

```console
$ tbd dep add $(cat a.txt) $(cat b.txt) $(cat a.txt) 2>&1
Error: Issue cannot depend on itself
? 2
```

# Test: One call removes several blockers

```console
$ tbd dep remove $(cat a.txt) $(cat b.txt) $(cat c.txt)
✓ test-[SHORTID] no longer depends on: test-[SHORTID] test-[SHORTID]
? 0
```

```console
$ tbd dep list $(cat a.txt)
No dependencies
? 0
```

# Test: Removing edges that are not present reports them (multi form)

```console
$ tbd dep add $(cat a.txt) $(cat c.txt)
✓ test-[SHORTID] now depends on test-[SHORTID]
? 0
```

```console
$ tbd dep remove $(cat a.txt) $(cat b.txt) $(cat c.txt)
✓ test-[SHORTID] no longer depends on: test-[SHORTID] test-[SHORTID] (1 not present)
? 0
```

* * *

## create --depends-on

# Test: Blockers can be declared at creation (repeatable flag)

```console
$ tbd create "Wired at birth" --depends-on $(cat a.txt) --depends-on $(cat b.txt) --json | jq -r '.id' | tee wired.txt
test-[SHORTID]
? 0
```

```console
$ tbd dep list $(cat wired.txt)
Blocked by: test-[SHORTID], test-[SHORTID]
? 0
```

# Test: The new issue shows up as blocked

```console
$ tbd blocked | grep -c "Wired at birth"
1
? 0
```

# Test: An unknown --depends-on ID aborts before the issue is created

```console
$ tbd list --count | tee count.txt
[..]
? 0
```

```console
$ tbd create "Never created" --depends-on test-zzzzzzz 2>&1
Error: Invalid --depends-on ID: test-zzzzzzz
? 2
```

```console
$ tbd list --count
[..]
? 0
```

```console
$ test "$(tbd list --count)" = "$(cat count.txt)"
? 0
```
