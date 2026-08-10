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
  SHORTID: '[0-9a-z]{4,5}'
before: |
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd init --prefix=test
---
# Parent Cycle and Depth Guards

A `parent_id` cycle makes every ancestor walk non-terminating, so the write path refuses
one rather than letting it reach storage.

## Setup: a two-level chain

# Test: Create the root epic

```console
$ tbd create "Root epic" --type=epic --json | jq -r '.id' | tee root.txt
test-[SHORTID]
? 0
```

# Test: Create a child under it

```console
$ tbd create "Child task" --parent "$(cat root.txt)" --json | jq -r '.id' | tee child.txt
test-[SHORTID]
? 0
```

## Cycle rejection

# Test: An issue cannot be its own parent

```console
$ tbd update "$(cat root.txt)" --parent "$(cat root.txt)" 2>&1 | grep -c "cycle"
1
? 0
```

# Test: Parenting an ancestor to its descendant is refused

```console
$ tbd update "$(cat root.txt)" --parent "$(cat child.txt)" 2>&1 | grep -c "cycle"
1
? 0
```

# Test: The refused update left the parent unchanged

```console
$ tbd show "$(cat root.txt)" --json | jq -r '.parent_id // "none"'
none
? 0
```

## Legal nesting still works

# Test: A deeper legal parent assignment is accepted

```console
$ tbd create "Grandchild" --json | jq -r '.id' | tee grand.txt
test-[SHORTID]
? 0
```

```console
$ tbd update "$(cat grand.txt)" --parent "$(cat child.txt)" >/dev/null 2>&1; tbd show "$(cat grand.txt)" --json | jq -r '.parent_id != null'
true
? 0
```

## Kind filter is shared with list

# Test: list --type filters to epics

```console
$ tbd list --type epic --json | jq -r '[.[] | select(.kind != "epic")] | length'
0
? 0
```
