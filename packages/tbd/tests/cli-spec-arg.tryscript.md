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
  # Set up a test git repository with a Speculate-style docs tree
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  mkdir -p docs/project/specs/active docs/project/specs/done
  echo "# Widget plan" > docs/project/specs/active/plan-2026-01-01-widget.md
  echo "# Dupe A" > docs/project/specs/active/plan-dupe.md
  echo "# Dupe B" > docs/project/specs/done/plan-dupe.md
  git add -A
  git commit -m "Initial commit"
  # Initialize tbd with test prefix
  tbd init --prefix=test
---
# tbd CLI: --spec Filename Resolution

Tests for write-side `--spec` suffix/filename matching on `create`/`update` (agent CLI
ergonomics round 2, tbd-1der): the filename form the `new-plan-spec` shortcut documents
now works, with the same matcher `list --spec` uses.

* * *

# Test: create --spec resolves a bare filename to the full repo path

```console
$ tbd create "Widget work" --spec plan-2026-01-01-widget.md --json | jq -r '.id' | tee a.txt
test-[SHORTID]
? 0
```

```console
$ tbd show $(cat a.txt) --json | jq -r '.spec_path'
docs/project/specs/active/plan-2026-01-01-widget.md
? 0
```

# Test: the resolved link round-trips through list --spec

```console
$ tbd list --spec plan-2026-01-01-widget.md | grep -c "Widget work"
1
? 0
```

# Test: update --spec resolves a path suffix

```console
$ tbd create "Suffix case" --json | jq -r '.id' | tee b.txt
test-[SHORTID]
? 0
```

```console
$ tbd update $(cat b.txt) --spec active/plan-2026-01-01-widget.md
✓ Updated test-[SHORTID]
? 0
```

```console
$ tbd show $(cat b.txt) --json | jq -r '.spec_path'
docs/project/specs/active/plan-2026-01-01-widget.md
? 0
```

# Test: an ambiguous filename errors and names every candidate

```console
$ tbd create "Ambiguous" --spec plan-dupe.md 2>&1
Error: Ambiguous spec path "plan-dupe.md" matches: docs/project/specs/active/plan-dupe.md, docs/project/specs/done/plan-dupe.md
? 2
```

# Test: a suffix disambiguates the duplicated filename

```console
$ tbd create "Disambiguated" --spec done/plan-dupe.md --json | jq -r '.id' | tee c.txt
test-[SHORTID]
? 0
```

```console
$ tbd show $(cat c.txt) --json | jq -r '.spec_path'
docs/project/specs/done/plan-dupe.md
? 0
```

# Test: a filename that matches nothing keeps the not-found error

```console
$ tbd create "No spec" --spec plan-no-such.md 2>&1
Error: File not found: plan-no-such.md
? 2
```
